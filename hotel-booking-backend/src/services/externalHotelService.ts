/**
 * hotel-booking-backend/src/services/externalHotelService.ts
 *
 * Fetches live hotel data from the Booking.com API via RapidAPI.
 *
 * ── Two-step flow required by Booking.com RapidAPI ──────────────────────────
 *   Step 1  GET /v1/hotels/locations   →  city name resolves to dest_id + dest_type
 *   Step 2  GET /v1/hotels/search      →  dest_id + dates returns hotel list
 *
 * All network / API errors are caught and return [].
 * The existing MongoDB search result is ALWAYS returned to the client,
 * even when this service fails completely.
 *
 * ── Required .env vars ───────────────────────────────────────────────────────
 *   RAPID_API_KEY=<your RapidAPI key>
 *   RAPID_API_HOST=booking-com.p.rapidapi.com
 */

import axios, { AxiosInstance } from "axios";

// ─── Shared axios client factory ──────────────────────────────────────────────

function buildClient(apiKey: string, apiHost: string): AxiosInstance {
  return axios.create({
    baseURL: `https://${apiHost}/v1`,
    timeout: 10_000, // 10 s — never stall the main search response
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": apiHost,
    },
  });
}

// ─── RapidAPI Booking.com response shapes (only fields we actually use) ───────

/** Single entry returned by GET /v1/hotels/locations */
interface BookingLocation {
  dest_id: string;   // numeric string, e.g. "-553173"
  dest_type: string; // "city" | "country" | "region" | "airport" …
  label: string;     // human-readable e.g. "Dublin, County Dublin, Ireland"
  city_name?: string;
  country?: string;
}

/** Single hotel entry inside the `result` array of GET /v1/hotels/search */
interface BookingHotel {
  hotel_id: number;
  hotel_name: string;
  address: string;
  city: string;
  country_trans: string;   // full country name, e.g. "Ireland"
  main_photo_url?: string; // main photo, may be http
  max_photo_url?: string;  // higher-res version, may be http
  review_score?: number;   // 0–10 Booking.com scale
  review_score_word?: string; // "Superb", "Good", "Okay" …
  review_nr?: number;      // total number of reviews
  min_total_price?: number; // total price for the searched stay
  composite_price_breakdown?: {
    gross_amount_per_night?: { value: number; currency: string };
  };
  class?: number;          // official star class 0–5
  url?: string;            // deep-link to the property page on Booking.com
  checkin?: { from?: string; until?: string };
  checkout?: { from?: string; until?: string };
}

interface BookingSearchResponse {
  result: BookingHotel[];
  count?: number;
}

// ─── Normalised shape returned by this service ────────────────────────────────

/**
 * Compatible with HotelType in shared/types.ts.
 * Only `source`, `bookingHotelId`, and `bookingUrl` are new additions;
 * the frontend uses them for the badge and "View on Booking.com" button.
 */
export interface ExternalHotel {
  // ── HotelType-compatible ──────────────────────────────────────────────────
  _id: string;
  userId: string;
  name: string;
  city: string;
  country: string;
  description: string;
  type: string[];
  adultCount: number;
  childCount: number;
  facilities: string[];
  pricePerNight: number;  // 0 means unknown; frontend shows "Contact for price"
  starRating: number;     // 1-5
  imageUrls: string[];
  lastUpdated: Date;
  totalBookings: number;
  totalRevenue: number;
  averageRating: number;  // mapped from Booking.com's 0-10 score to 0-5
  reviewCount: number;
  isActive: boolean;
  isFeatured: boolean;
  // ── Discriminator + Booking.com extras ───────────────────────────────────
  source: "external";
  bookingHotelId: number;
  bookingUrl: string;
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Format Date as YYYY-MM-DD — the format required by Booking.com API */
function toYMD(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Derive a 1-5 star rating.
 * Priority: official hotel class → mapping of 0-10 review score → default 3.
 */
function toStarRating(hotelClass?: number, reviewScore?: number): number {
  if (hotelClass && hotelClass >= 1 && hotelClass <= 5) {
    return Math.round(hotelClass);
  }
  if (reviewScore && reviewScore > 0) {
    return Math.min(5, Math.max(1, Math.round(reviewScore / 2)));
  }
  return 3;
}

/**
 * Extract per-night GBP price.
 * Sources in priority order:
 *   1. gross_amount_per_night (explicit)
 *   2. min_total_price / nights (derived)
 *   3. 0 (unknown)
 */
function toPerNightPrice(hotel: BookingHotel, nights: number): number {
  const explicit =
    hotel.composite_price_breakdown?.gross_amount_per_night?.value;
  if (explicit && explicit > 0) return Math.round(explicit);

  if (hotel.min_total_price && hotel.min_total_price > 0 && nights > 0) {
    return Math.round(hotel.min_total_price / nights);
  }
  return 0;
}

/**
 * Force an HTTP URL to HTTPS.
 * Booking.com CDN supports HTTPS on the same paths.
 */
function forceHttps(url?: string): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\//i, "https://");
}

/**
 * Build a direct Booking.com deep-link from the hotel's own `url` field,
 * or fall back to a stable search URL using the hotel_id.
 */
function buildBookingUrl(hotel: BookingHotel): string {
  if (hotel.url) {
    const raw = hotel.url.trim();
    return raw.startsWith("http") ? raw : `https://www.booking.com${raw}`;
  }
  return `https://www.booking.com/hotel/search.html?hotel_id=${hotel.hotel_id}&aid=304142`;
}

/**
 * Build a human-readable description from available Booking.com fields.
 */
function buildDescription(
  hotel: BookingHotel,
  fallbackCity: string,
  fallbackCountry: string
): string {
  const parts: string[] = [];

  const city    = hotel.city    || fallbackCity;
  const country = hotel.country_trans || fallbackCountry;

  parts.push(`${hotel.hotel_name} is located in ${city}, ${country}.`);

  if (hotel.review_score_word && hotel.review_score) {
    parts.push(
      `Guests rate it "${hotel.review_score_word}" (${hotel.review_score}/10 on Booking.com).`
    );
  }

  if (hotel.address) {
    parts.push(`Address: ${hotel.address}.`);
  }

  return parts.join(" ");
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetch hotels for `city` from Booking.com via RapidAPI.
 *
 * @param city      Destination string typed by the user.
 * @param limit     Max external results to merge with DB results (default 5).
 * @param checkIn   Optional check-in date (defaults to tomorrow).
 * @param checkOut  Optional check-out date (defaults to the day after check-in).
 * @returns         Array of ExternalHotel — or [] on any error / missing key.
 */
export async function fetchExternalHotels(
  city: string,
  limit = 5,
  checkIn?: Date,
  checkOut?: Date
): Promise<ExternalHotel[]> {
  // ── Guard: env vars must be present ────────────────────────────────────────
  const apiKey  = process.env.RAPID_API_KEY;
  const apiHost = process.env.RAPID_API_HOST ?? "booking-com.p.rapidapi.com";

  if (!apiKey) {
    console.warn(
      "[externalHotelService] RAPID_API_KEY is not set — skipping external hotel search."
    );
    return [];
  }

  const client = buildClient(apiKey, apiHost);

  // ── Compute dates ───────────────────────────────────────────────────────────
  const today     = new Date();
  const defIn     = new Date(today); defIn.setDate(today.getDate() + 1);
  const defOut    = new Date(defIn);  defOut.setDate(defIn.getDate() + 1);

  const inDate    = checkIn  ?? defIn;
  const outDate   = checkOut ?? defOut;

  const checkinDate  = toYMD(inDate);
  const checkoutDate = toYMD(outDate);

  const msPerDay = 1_000 * 60 * 60 * 24;
  const nights   = Math.max(1, Math.round((outDate.getTime() - inDate.getTime()) / msPerDay));

  // ── STEP 1: Resolve city name → Booking.com dest_id + dest_type ────────────
  let destId: string;
  let destType: string;
  let resolvedCity    = city;
  let resolvedCountry = "";

  try {
    const { data: locations } = await client.get<BookingLocation[]>(
      "/hotels/locations",
      { params: { name: city, locale: "en-gb" } }
    );

    if (!Array.isArray(locations) || locations.length === 0) {
      console.warn(
        `[externalHotelService] Booking.com returned no location for "${city}".`
      );
      return [];
    }

    // Prefer an exact city-type match, otherwise take the first result
    const best =
      locations.find((l) => l.dest_type === "city") ?? locations[0];

    destId   = best.dest_id;
    destType = best.dest_type;

    // Parse label: "Dublin, County Dublin, Ireland" → city, country
    const parts     = best.label.split(",").map((p) => p.trim());
    resolvedCity    = best.city_name ?? parts[0] ?? city;
    resolvedCountry = best.country   ?? parts[parts.length - 1] ?? "";
  } catch (err: any) {
    console.error(
      "[externalHotelService] Location lookup failed:",
      err?.response?.data ?? err?.message ?? String(err)
    );
    return [];
  }

  // ── STEP 2: Search hotels for the resolved destination ─────────────────────
  let raw: BookingHotel[] = [];

  try {
    const { data } = await client.get<BookingSearchResponse>(
      "/hotels/search",
      {
        params: {
          dest_id:              destId,
          dest_type:            destType,
          checkin_date:         checkinDate,
          checkout_date:        checkoutDate,
          adults_number:        "2",
          room_number:          "1",
          order_by:             "popularity",
          units:                "metric",
          filter_by_currency:   "GBP",
          locale:               "en-gb",
          page_number:          "0",
          // include_adjacency keeps results when city has fewer hotels
          include_adjacency:    "true",
        },
      }
    );

    if (!Array.isArray(data?.result) || data.result.length === 0) {
      console.warn(
        `[externalHotelService] No hotels found for dest_id="${destId}" (${resolvedCity}).`
      );
      return [];
    }

    raw = data.result;
  } catch (err: any) {
    console.error(
      "[externalHotelService] Hotel search failed:",
      err?.response?.data ?? err?.message ?? String(err)
    );
    return [];
  }

  // ── STEP 3: Normalise + return ─────────────────────────────────────────────
  return raw.slice(0, limit).map((h): ExternalHotel => {
    // Prefer higher-res photo; force https
    const photo =
      forceHttps(h.max_photo_url) ??
      forceHttps(h.main_photo_url) ??
      "https://via.placeholder.com/800x600?text=No+Image";

    const pricePerNight = toPerNightPrice(h, nights);
    const starRating    = toStarRating(h.class, h.review_score);
    // Map 0-10 Booking.com score → 0-5 for our averageRating field
    const averageRating = h.review_score
      ? parseFloat((h.review_score / 2).toFixed(1))
      : 0;

    return {
      // ── HotelType-compatible fields ─────────────────────────────────────
      _id:          `booking_${h.hotel_id}`,  // "booking_" prefix avoids any MongoDB _id collision
      userId:       "",
      name:         h.hotel_name,
      city:         h.city         || resolvedCity,
      country:      h.country_trans || resolvedCountry,
      description:  buildDescription(h, resolvedCity, resolvedCountry),
      type:         ["Hotel"],
      adultCount:   2,
      childCount:   0,
      facilities:   ["Free WiFi"],  // universal baseline; Booking.com facility IDs are numeric — not mapped
      pricePerNight,
      starRating,
      imageUrls:    [photo],
      lastUpdated:  new Date(),
      totalBookings: 0,
      totalRevenue:  0,
      averageRating,
      reviewCount:  h.review_nr ?? 0,
      isActive:     true,
      isFeatured:   false,
      // ── Booking.com-specific extras ─────────────────────────────────────
      source:           "external",
      bookingHotelId:   h.hotel_id,
      bookingUrl:       buildBookingUrl(h),
    };
  });
}