/**
 * hotel-booking-backend/src/routes/hotels.ts
 *
 * ── Route registration order (Express specificity — MUST NOT reorder) ─────────
 *   GET /search          ← must be before /:id
 *   GET /                ← list all DB hotels
 *   GET /details/:id     ← NEW: aggregator-enriched detail (both DB and external)
 *   GET /external/:id    ← existing: raw RapidAPI detail for external hotels
 *   GET /:id             ← existing: DB hotel by _id (detects booking_ prefix)
 *   POST /:id/bookings/payment-intent
 *   POST /:id/bookings
 *
 * ── New route: GET /api/hotels/details/:id ───────────────────────────────────
 *   Merges RapidAPI + Google Places + Unsplash in parallel.
 *   Returns EnrichedHotel:
 *     - 8–20 deduplicated images (API + Google + Unsplash)
 *     - Reviews from Google (authentic) + Booking.com + generated fallback
 *     - Nearby places: restaurants, attractions, transport
 *     - Coordinates for map display
 *     - 20+ amenities (normalised + enriched)
 *     - Grouped facilities
 *     - Full policies
 *   Works for BOTH external hotels (booking_<id>) and DB hotels (_id).
 *   Results are cached for 10 minutes to avoid repeated API calls.
 *
 * ── All existing routes: UNCHANGED ────────────────────────────────────────────
 */

import express, { Request, Response } from "express";
import Hotel       from "../models/hotel";
import Booking     from "../models/booking";
import User        from "../models/user";
import { BookingType } from "../../../shared/types";
import { param, validationResult } from "express-validator";
import Stripe      from "stripe";
import verifyToken from "../middleware/auth";
import {
  fetchExternalHotels,
  getHotelDetails,
} from "../services/externalHotelService";
import {
  getEnrichedHotelDetails,
  enrichDBHotel,
} from "../services/aggregatorService";

const stripe = new Stripe(process.env.STRIPE_API_KEY as string);
const router  = express.Router();

// ─── GET /search — UNCHANGED ──────────────────────────────────────────────────

router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = constructSearchQuery(req.query);

    let sortOptions: Record<string, any> = { lastUpdated: -1 };
    switch (req.query.sortOption) {
      case "starRating":        sortOptions = { starRating: -1 };    break;
      case "pricePerNightAsc":  sortOptions = { pricePerNight: 1 };  break;
      case "pricePerNightDesc": sortOptions = { pricePerNight: -1 }; break;
    }

    const limit      = Math.min(Math.max(parseInt((req.query.limit as string) ?? "10", 10), 1), 50);
    const pageNumber = Math.max(parseInt((req.query.page  as string) ?? "1",  10), 1);

    const allDbHotels = await Hotel.find(query).sort(sortOptions).lean();
    const dbHotelsWithSource = allDbHotels.map((h) => ({ ...h, source: "db" as const }));

    const destination = (req.query.destination as string | undefined)?.trim();
    let checkIn: Date | undefined;
    let checkOut: Date | undefined;
    if (req.query.checkIn) {
      const d = new Date(req.query.checkIn as string);
      if (!isNaN(d.getTime())) checkIn = d;
    }
    if (req.query.checkOut) {
      const d = new Date(req.query.checkOut as string);
      if (!isNaN(d.getTime())) checkOut = d;
    }

    let externalHotels: any[] = [];
    if (destination) {
      externalHotels = await fetchExternalHotels(destination, 20, checkIn, checkOut);
    }

    // Source control: remove external hotels whose name matches a DB hotel
    const dbNames = new Set(allDbHotels.map((h) => h.name.toLowerCase()));
    externalHotels = externalHotels.filter(
      (h) => !dbNames.has(h.name.toLowerCase())
    );

    const allHotels = [...dbHotelsWithSource, ...externalHotels];

    if (req.query.sortOption === "pricePerNightAsc")
      allHotels.sort((a, b) => (a.pricePerNight ?? 0) - (b.pricePerNight ?? 0));
    else if (req.query.sortOption === "pricePerNightDesc")
      allHotels.sort((a, b) => (b.pricePerNight ?? 0) - (a.pricePerNight ?? 0));
    else if (req.query.sortOption === "starRating")
      allHotels.sort((a, b) => (b.starRating ?? 0) - (a.starRating ?? 0));

    const total     = allHotels.length;
    const pages     = Math.ceil(total / limit);
    const skip      = (pageNumber - 1) * limit;
    const pageSlice = allHotels.slice(skip, skip + limit);

    res.json({ data: pageSlice, pagination: { total, page: pageNumber, pages, limit } });
  } catch (error) {
    console.error("[hotels/search] error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// ─── GET / — UNCHANGED ────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  try {
    const hotels = await Hotel.find().sort("-lastUpdated");
    res.json(hotels);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching hotels" });
  }
});

// ─── GET /details/:id — NEW: aggregator-enriched detail ──────────────────────
// Handles BOTH external (booking_<id>) and DB (MongoDB _id) hotels.
// Returns EnrichedHotel with Google data, full image gallery, nearby places.
// MUST be registered before /:id to avoid Express treating "details" as a Mongo id.

router.get(
  "/details/:id",
  [param("id").notEmpty().withMessage("Hotel ID is required")],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const rawId = req.params.id.toString();

    try {
      // ── External hotel ──────────────────────────────────────────────────────
      if (rawId.startsWith("booking_")) {
        // For external hotels, we first get basic info (name/city) from cache or
        // externalHotelService, then pass it to the aggregator for enrichment.
        // This avoids a double RapidAPI call when cache is warm.
        const basic = await getHotelDetails(rawId).catch(() => null);
        const enriched = await getEnrichedHotelDetails(
          rawId,
          basic?.name,
          basic?.city
        );
        if (!enriched) {
          return res.status(404).json({ message: "Hotel details not found." });
        }
        return res.status(200).json(enriched);
      }

      // ── DB hotel ────────────────────────────────────────────────────────────
      const dbHotel = await Hotel.findById(rawId).lean();
      if (!dbHotel) {
        return res.status(404).json({ message: "Hotel not found." });
      }
      const enriched = await enrichDBHotel({ ...dbHotel, source: "db" });
      return res.status(200).json(enriched);

    } catch (error: any) {
      console.error("[hotels/details/:id] error:", error?.message ?? error);
      return res.status(500).json({ message: "Failed to fetch hotel details." });
    }
  }
);

// ─── GET /external/:id — UNCHANGED ───────────────────────────────────────────

router.get(
  "/external/:id",
  [param("id").notEmpty().withMessage("External hotel ID is required")],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const rawId = req.params.id.toString();

    if (!rawId.startsWith("booking_")) {
      return res.status(400).json({ message: "Invalid external hotel ID format. Expected booking_<id>." });
    }

    try {
      const hotel = await getHotelDetails(rawId);
      if (!hotel) {
        return res.status(404).json({ message: "External hotel details not found." });
      }
      return res.status(200).json(hotel);
    } catch (error: any) {
      console.error("[hotels/external/:id] error:", error?.message ?? error);
      return res.status(500).json({ message: "Failed to fetch external hotel details." });
    }
  }
);

// ─── GET /:id — UNCHANGED ─────────────────────────────────────────────────────

router.get(
  "/:id",
  [param("id").notEmpty().withMessage("Hotel ID is required")],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const id = req.params.id.toString();
    try {
      if (id.startsWith("booking_")) {
        return res.status(404).json({ message: "external_hotel", externalId: id });
      }
      const hotel = await Hotel.findById(id);
      if (!hotel) return res.status(404).json({ message: "Hotel not found" });
      res.json({ ...hotel.toObject(), source: "db" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error fetching hotel" });
    }
  }
);

// ─── POST /:hotelId/bookings/payment-intent — UNCHANGED ───────────────────────

router.post(
  "/:hotelId/bookings/payment-intent",
  verifyToken,
  async (req: Request, res: Response) => {
    const { numberOfNights } = req.body;
    const hotelId = req.params.hotelId;
    const hotel   = await Hotel.findById(hotelId);
    if (!hotel) return res.status(400).json({ message: "Hotel not found" });

    const totalCost = hotel.pricePerNight * numberOfNights;
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   totalCost * 100,
      currency: "gbp",
      metadata: { hotelId, userId: req.userId },
    });
    if (!paymentIntent.client_secret)
      return res.status(500).json({ message: "Error creating payment intent" });

    res.send({
      paymentIntentId: paymentIntent.id,
      clientSecret:    paymentIntent.client_secret.toString(),
      totalCost,
    });
  }
);

// ─── POST /:hotelId/bookings — UNCHANGED ──────────────────────────────────────

router.post(
  "/:hotelId/bookings",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const paymentIntentId = req.body.paymentIntentId;
      const paymentIntent   = await stripe.paymentIntents.retrieve(paymentIntentId as string);
      if (!paymentIntent)
        return res.status(400).json({ message: "payment intent not found" });
      if (
        paymentIntent.metadata.hotelId !== req.params.hotelId ||
        paymentIntent.metadata.userId  !== req.userId
      ) return res.status(400).json({ message: "payment intent mismatch" });
      if (paymentIntent.status !== "succeeded")
        return res.status(400).json({
          message: `payment intent not succeeded. Status: ${paymentIntent.status}`,
        });

      const newBooking: BookingType = {
        ...req.body,
        userId:        req.userId,
        hotelId:       req.params.hotelId,
        createdAt:     new Date(),
        status:        "confirmed",
        paymentStatus: "paid",
      };
      const booking = new Booking(newBooking);
      await booking.save();
      await Hotel.findByIdAndUpdate(req.params.hotelId, {
        $inc: { totalBookings: 1, totalRevenue: newBooking.totalCost },
      });
      await User.findByIdAndUpdate(req.userId, {
        $inc: { totalBookings: 1, totalSpent: newBooking.totalCost },
      });
      res.status(200).send();
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "something went wrong" });
    }
  }
);

// ─── constructSearchQuery — UNCHANGED ─────────────────────────────────────────

const constructSearchQuery = (queryParams: any) => {
  let constructedQuery: any = {};
  if (queryParams.destination && queryParams.destination.trim() !== "") {
    const destination = queryParams.destination.trim();
    constructedQuery.$or = [
      { city:    { $regex: destination, $options: "i" } },
      { country: { $regex: destination, $options: "i" } },
    ];
  }
  if (queryParams.adultCount)
    constructedQuery.adultCount = { $gte: parseInt(queryParams.adultCount) };
  if (queryParams.childCount)
    constructedQuery.childCount = { $gte: parseInt(queryParams.childCount) };
  if (queryParams.facilities) {
    constructedQuery.facilities = {
      $all: Array.isArray(queryParams.facilities)
        ? queryParams.facilities
        : [queryParams.facilities],
    };
  }
  if (queryParams.types) {
    constructedQuery.type = {
      $in: Array.isArray(queryParams.types)
        ? queryParams.types
        : [queryParams.types],
    };
  }
  if (queryParams.stars) {
    const starRatings = Array.isArray(queryParams.stars)
      ? queryParams.stars.map((star: string) => parseInt(star))
      : parseInt(queryParams.stars);
    constructedQuery.starRating = { $in: starRatings };
  }
  if (queryParams.maxPrice) {
    constructedQuery.pricePerNight = { $lte: parseInt(queryParams.maxPrice) };
  }
  return constructedQuery;
};

export default router;