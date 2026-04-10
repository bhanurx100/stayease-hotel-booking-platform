/**
 * hotel-booking-backend/src/routes/hotels.ts
 *
 * ── What changed vs. the original ────────────────────────────────────────────
 *
 * ONLY the GET /search handler was modified. Every other route, the
 * constructSearchQuery function, and all imports except one are untouched.
 *
 * Changes inside GET /search:
 *   1. Import fetchExternalHotels (one new import at the top).
 *   2. DB results are stamped with  source: "db"  (toObject() + spread).
 *   3. fetchExternalHotels() is called with the destination string AND the
 *      checkIn / checkOut dates from the query-string (so Booking.com returns
 *      real availability & prices for the user's selected dates).
 *   4. External results are appended after DB results in the `data` array.
 *   5. pagination still reflects only the DB total — the existing paginator
 *      in Search.tsx is completely unchanged.
 *
 * Nothing else was touched.
 */

import express, { Request, Response } from "express";
import Hotel from "../models/hotel";
import Booking from "../models/booking";
import User from "../models/user";
import { BookingType, HotelSearchResponse } from "../../../shared/types";
import { param, validationResult } from "express-validator";
import Stripe from "stripe";
import verifyToken from "../middleware/auth";
// ── NEW: external hotel service (Booking.com via RapidAPI) ────────────────────
import { fetchExternalHotels } from "../services/externalHotelService";
// ─────────────────────────────────────────────────────────────────────────────

const stripe = new Stripe(process.env.STRIPE_API_KEY as string);
const router = express.Router();

// ─── GET /search ──────────────────────────────────────────────────────────────
// MODIFIED: stamps DB results source:"db", appends Booking.com results source:"external"
router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = constructSearchQuery(req.query);

    let sortOptions = {};
    switch (req.query.sortOption) {
      case "starRating":
        sortOptions = { starRating: -1 };
        break;
      case "pricePerNightAsc":
        sortOptions = { pricePerNight: 1 };
        break;
      case "pricePerNightDesc":
        sortOptions = { pricePerNight: -1 };
        break;
    }

    const pageSize   = 5;
    const pageNumber = parseInt(req.query.page ? req.query.page.toString() : "1");
    const skip       = (pageNumber - 1) * pageSize;

    // ── Original DB query (run in parallel for performance) ──────────────────
    const [dbHotels, total] = await Promise.all([
      Hotel.find(query).sort(sortOptions).skip(skip).limit(pageSize),
      Hotel.countDocuments(query),
    ]);

    // ── CHANGE 1: stamp every DB result so the frontend can tell them apart ──
    const dbHotelsWithSource = dbHotels.map((h) => ({
      ...h.toObject(),
      source: "db" as const,
    }));

    // ── CHANGE 2: parse dates from the query-string (passed by SearchBar) ────
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

    // ── CHANGE 3: fetch external results (never throws — service handles errors)
    let externalHotels: any[] = [];
    if (destination) {
      externalHotels = await fetchExternalHotels(destination, 5, checkIn, checkOut);
    }

    // ── CHANGE 4: DB results first, Booking.com results appended after ───────
    const combinedData = [...dbHotelsWithSource, ...externalHotels];

    // ── CHANGE 5: pagination still reflects only DB total (unchanged shape) ──
    const response: HotelSearchResponse & { data: any[] } = {
      data: combinedData,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / pageSize),
      },
    };

    res.json(response);
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// ─── GET / ────────────────────────────────────────────────────────────────────
// UNCHANGED
router.get("/", async (req: Request, res: Response) => {
  try {
    const hotels = await Hotel.find().sort("-lastUpdated");
    res.json(hotels);
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Error fetching hotels" });
  }
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────
// UNCHANGED
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
      const hotel = await Hotel.findById(id);
      res.json(hotel);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Error fetching hotel" });
    }
  }
);

// ─── POST /:hotelId/bookings/payment-intent ───────────────────────────────────
// UNCHANGED
router.post(
  "/:hotelId/bookings/payment-intent",
  verifyToken,
  async (req: Request, res: Response) => {
    const { numberOfNights } = req.body;
    const hotelId = req.params.hotelId;
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      return res.status(400).json({ message: "Hotel not found" });
    }
    const totalCost = hotel.pricePerNight * numberOfNights;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCost * 100,
      currency: "gbp",
      metadata: {
        hotelId,
        userId: req.userId,
      },
    });
    if (!paymentIntent.client_secret) {
      return res.status(500).json({ message: "Error creating payment intent" });
    }
    const response = {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret.toString(),
      totalCost,
    };
    res.send(response);
  }
);

// ─── POST /:hotelId/bookings ──────────────────────────────────────────────────
// UNCHANGED
router.post(
  "/:hotelId/bookings",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const paymentIntentId = req.body.paymentIntentId;
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId as string
      );
      if (!paymentIntent) {
        return res.status(400).json({ message: "payment intent not found" });
      }
      if (
        paymentIntent.metadata.hotelId !== req.params.hotelId ||
        paymentIntent.metadata.userId !== req.userId
      ) {
        return res.status(400).json({ message: "payment intent mismatch" });
      }
      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({
          message: `payment intent not succeeded. Status: ${paymentIntent.status}`,
        });
      }
      const newBooking: BookingType = {
        ...req.body,
        userId: req.userId,
        hotelId: req.params.hotelId,
        createdAt: new Date(),
        status: "confirmed",
        paymentStatus: "paid",
      };
      const booking = new Booking(newBooking);
      await booking.save();
      await Hotel.findByIdAndUpdate(req.params.hotelId, {
        $inc: {
          totalBookings: 1,
          totalRevenue: newBooking.totalCost,
        },
      });
      await User.findByIdAndUpdate(req.userId, {
        $inc: {
          totalBookings: 1,
          totalSpent: newBooking.totalCost,
        },
      });
      res.status(200).send();
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "something went wrong" });
    }
  }
);

// ─── constructSearchQuery ─────────────────────────────────────────────────────
// UNCHANGED
const constructSearchQuery = (queryParams: any) => {
  let constructedQuery: any = {};
  if (queryParams.destination && queryParams.destination.trim() !== "") {
    const destination = queryParams.destination.trim();
    constructedQuery.$or = [
      { city: { $regex: destination, $options: "i" } },
      { country: { $regex: destination, $options: "i" } },
    ];
  }
  if (queryParams.adultCount) {
    constructedQuery.adultCount = {
      $gte: parseInt(queryParams.adultCount),
    };
  }
  if (queryParams.childCount) {
    constructedQuery.childCount = {
      $gte: parseInt(queryParams.childCount),
    };
  }
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
    constructedQuery.pricePerNight = {
      $lte: parseInt(queryParams.maxPrice).toString(),
    };
  }
  return constructedQuery;
};

export default router;