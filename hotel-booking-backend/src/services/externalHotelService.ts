/**
 * hotel-booking-backend/src/services/externalHotelService.ts
 *
 * ── Currency & Price fixes (this version) ────────────────────────────────────
 *
 * ROOT CAUSE OF WRONG CURRENCY / SYMBOL:
 *   The API returns currency in composite_price_breakdown.gross_amount_per_night.currency
 *   (e.g. "INR", "USD", "EUR"). We were ignoring that field completely and
 *   defaulting every price to GBP, then the frontend would multiply it by a
 *   GBP→INR rate, producing a wildly wrong number.
 *
 * FIX:
 *   1. `extractPriceAndCurrency()` — reads BOTH value AND currency from the API.
 *      If currency is missing, falls back to "INR" for Indian cities, "GBP" otherwise.
 *   2. `ExternalHotel` interface now carries `currency: string` (e.g. "INR", "GBP").
 *   3. `getHotelDetails()` uses the same `extractPriceAndCurrency()` for consistency.
 *   4. The frontend `CurrencyContext` uses the hotel's own `currency` field for
 *      external hotels instead of assuming GBP base — see CurrencyContext.tsx.
 *
 * RULE: DO NOT multiply or divide the price. Return the exact API value.
 *       Only apply conversion if the user has selected a different display currency
 *       AND the hotel's native currency differs from that selection.
 *
 * ── Two public exports ───────────────────────────────────────────────────────
 *   fetchExternalHotels(city, limit?, checkIn?, checkOut?)
 *     → Used by GET /api/hotels/search  and  POST /api/ai/chat
 *
 *   getHotelDetails(rawId)
 *     → Used by GET /api/hotels/external/:id
 *
 * ── Required .env vars ───────────────────────────────────────────────────────
 *   RAPID_API_KEY=<your key>
 *   RAPID_API_HOST=booking-com.p.rapidapi.com
 */

import axios, { AxiosInstance } from "axios";

// ─── Axios factory ────────────────────────────────────────────────────────────

function buildClient(): AxiosInstance {
  const apiKey  = process.env.RAPID_API_KEY ?? "";
  const apiHost = process.env.RAPID_API_HOST ?? "booking-com.p.rapidapi.com";
  return axios.create({
    baseURL: `https://${apiHost}/v1`,
    timeout: 12_000,
    headers: {
      "x-rapidapi-key":  apiKey,
      "x-rapidapi-host": apiHost,
    },
  });
}

function apiCredentialsPresent(): boolean {
  if (!process.env.RAPID_API_KEY) {
    console.warn("[externalHotelService] RAPID_API_KEY not set — skipping.");
    return false;
  }
  return true;
}

// ─── RapidAPI Booking.com response shapes ─────────────────────────────────────

interface BookingLocation {
  dest_id:    string;
  dest_type:  string;
  label:      string;
  city_name?: string;
  country?:   string;
}

/**
 * A single hotel entry from /v1/hotels/search.
 * Added `currency` to `composite_price_breakdown.gross_amount_per_night`
 * because that field always exists in real API responses and is the
 * authoritative currency for the price displayed.
 */
interface BookingHotel {
  hotel_id:      number;
  hotel_name:    string;
  address:       string;
  city:          string;
  country_trans: string;
  main_photo_url?: string;
  max_photo_url?:  string;
  review_score?:      number;
  review_score_word?: string;
  review_nr?:         number;
  // ── Primary price source ──────────────────────────────────────────────────
  min_total_price?: number;
  composite_price_breakdown?: {
    gross_amount_per_night?: {
      value:    number;
      currency: string; // ← e.g. "INR", "GBP", "USD", "EUR" — USE THIS
    };
    // Some API plans also include all_inclusive_amount or strikethrough_amount
    all_inclusive_amount?: { value: number; currency: string };
  };
  class?:    number;
  url?:      string;
  checkin?:  { from?: string; until?: string };
  checkout?: { from?: string; until?: string };
  district?: string;
  zip?:      string;
}

interface BookingSearchResponse {
  result: BookingHotel[];
  count?: number;
}

// Shape from /v1/hotels/data
interface BookingHotelData {
  hotel_id?:    number;
  name?:        string;
  address?:     string;
  city?:        string;
  country?:     string;
  country_trans?: string;
  zip?:         string;
  district?:    string;
  description_translations?: Array<{ languagecode: string; description: string }>;
  hotel_description?: string;
  review_score?:      number;
  review_score_word?: string;
  review_nr?:         number;
  class?:             number;
  class_is_estimated?: boolean;
  checkin?:  { from?: string; until?: string };
  checkout?: { from?: string; until?: string };
  // ── Price fields on data endpoint ─────────────────────────────────────────
  // The data endpoint may return gross_price with currency; not always present.
  price_breakdown?: {
    gross_price?: { value: number; currency?: string };
  };
  rooms?: Record<string, any>;
  facilities_block?: Array<{ name: string; facilities: Array<{ name: string; icon?: string }> }>;
}

// Shape from /v1/hotels/reviews
interface BookingReview {
  reviewer_name?:   string;
  reviewer_score?:  number;
  title?:           string;
  pros?:            string;
  cons?:            string;
  date?:            string;
  average_score?:   number;
  travel_purpose?:  string;
}

// Shape from /v1/hotels/photos
interface BookingPhoto {
  photo_id?:     number;
  url_max?:      string;
  url_1440?:     string;
  url_square60?: string;
}

// ─── Normalised types ─────────────────────────────────────────────────────────

export interface ExternalReview {
  reviewer: string;
  score:    number;
  title:    string;
  text:     string;
  date:     string;
}

export interface ExternalHotel {
  // ── HotelType-compatible ──────────────────────────────────────────────────
  _id:           string;
  userId:        string;
  name:          string;
  city:          string;
  country:       string;
  description:   string;
  type:          string[];
  adultCount:    number;
  childCount:    number;
  facilities:    string[];
  pricePerNight: number;   // EXACT value from API — do NOT multiply
  starRating:    number;
  imageUrls:     string[];
  lastUpdated:   Date;
  totalBookings: number;
  totalRevenue:  number;
  averageRating: number;
  reviewCount:   number;
  isActive:      boolean;
  isFeatured:    boolean;
  // ── NEW: native currency of the price from the API ────────────────────────
  // e.g. "INR" for Indian hotels, "GBP" for UK, "USD" for US, "EUR" for Europe
  // Frontend must use THIS to decide which symbol to show, not the user's
  // selected display currency.
  currency:      string;
  // ── Rich detail fields ────────────────────────────────────────────────────
  reviews?:  ExternalReview[];
  contact?: {
    phone:   string;
    email:   string;
    website: string;
  };
  policies?: {
    checkInTime:        string;
    checkOutTime:       string;
    cancellationPolicy: string;
    petPolicy:          string;
    smokingPolicy:      string;
  };
  // ── Source discriminator ──────────────────────────────────────────────────
  source:         "external";
  bookingHotelId: number;
  bookingUrl:     string;
}

// ─── Currency helpers ─────────────────────────────────────────────────────────

/**
 * INDIAN_COUNTRIES: Booking.com returns country name in English for Indian cities.
 * We use this to default currency to INR when the API omits the currency field.
 */
const INDIAN_COUNTRIES = new Set([
  "india", "in", "bharat",
]);

/**
 * Determine default currency when the API omits it.
 * India → INR. Everything else → GBP (the filter_by_currency we request).
 */
function defaultCurrencyForCountry(country: string): string {
  return INDIAN_COUNTRIES.has(country.toLowerCase().trim()) ? "INR" : "GBP";
}

/**
 * Get the correct currency symbol for a currency code.
 * Used only for logging / description building — NOT for display
 * (the frontend handles display via CurrencyContext).
 */
function currencySymbol(code: string): string {
  switch (code.toUpperCase()) {
    case "INR": return "₹";
    case "USD": return "$";
    case "EUR": return "€";
    case "AED": return "AED ";
    case "SGD": return "S$";
    case "AUD": return "A$";
    case "CAD": return "C$";
    case "GBP":
    default:    return "£";
  }
}

// ─── Price extraction — THE CORE FIX ─────────────────────────────────────────

/**
 * Extract price AND currency from a search-result hotel.
 *
 * Priority order:
 *   1. composite_price_breakdown.gross_amount_per_night  (per-night, most reliable)
 *   2. all_inclusive_amount (some API plans return this instead)
 *   3. min_total_price / nights  (total ÷ nights — same currency as gross_amount)
 *   4. { price: 0, currency: fallback }  (unknown — UI shows "Price on request")
 *
 * Currency comes from the same field as value.
 * If currency is absent: fall back to countryHint → default mapping.
 *
 * NEVER multiplies or divides the value for conversion.
 * NEVER defaults to a hardcoded wrong currency.
 */
function extractPriceAndCurrency(
  hotel:       BookingHotel,
  nights:      number,
  countryHint: string
): { price: number; currency: string } {
  const fallbackCurrency = defaultCurrencyForCountry(countryHint);

  // ── Priority 1: per-night explicit ────────────────────────────────────────
  const perNight = hotel.composite_price_breakdown?.gross_amount_per_night;
  if (perNight?.value && perNight.value > 0) {
    return {
      price:    Math.round(perNight.value),
      currency: (perNight.currency || fallbackCurrency).toUpperCase(),
    };
  }

  // ── Priority 2: all-inclusive amount (some response variants) ─────────────
  const allInclusive = hotel.composite_price_breakdown?.all_inclusive_amount;
  if (allInclusive?.value && allInclusive.value > 0 && nights > 0) {
    return {
      price:    Math.round(allInclusive.value / nights),
      currency: (allInclusive.currency || fallbackCurrency).toUpperCase(),
    };
  }

  // ── Priority 3: min_total_price ÷ nights ──────────────────────────────────
  // min_total_price is always in the filter_by_currency we sent (GBP for non-India,
  // but if user searched India we send INR — so currency is still consistent).
  if (hotel.min_total_price && hotel.min_total_price > 0 && nights > 0) {
    return {
      price:    Math.round(hotel.min_total_price / nights),
      currency: fallbackCurrency,
    };
  }

  // ── Priority 4: unknown ───────────────────────────────────────────────────
  return { price: 0, currency: fallbackCurrency };
}

/**
 * Extract price AND currency from a /hotels/data response.
 * Same logic, different field names.
 */
function extractPriceAndCurrencyFromData(
  data:        BookingHotelData,
  countryHint: string
): { price: number; currency: string } {
  const fallbackCurrency = defaultCurrencyForCountry(countryHint);

  const gross = data.price_breakdown?.gross_price;
  if (gross?.value && gross.value > 0) {
    return {
      price:    Math.round(gross.value),
      currency: (gross.currency || fallbackCurrency).toUpperCase(),
    };
  }
  return { price: 0, currency: fallbackCurrency };
}

// ─── Other shared helpers ─────────────────────────────────────────────────────

function toYMD(date: Date): string {
  return date.toISOString().split("T")[0];
}

function toStarRating(hotelClass?: number, reviewScore?: number): number {
  if (hotelClass && hotelClass >= 1 && hotelClass <= 5) return Math.round(hotelClass);
  if (reviewScore && reviewScore > 0)
    return Math.min(5, Math.max(1, Math.round(reviewScore / 2)));
  return 3;
}

function forceHttps(url?: string | null): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\//i, "https://");
}

function buildBookingUrl(hotel: BookingHotel): string {
  if (hotel.url) {
    const raw = hotel.url.trim();
    return raw.startsWith("http") ? raw : `https://www.booking.com${raw}`;
  }
  return `https://www.booking.com/hotel/search.html?hotel_id=${hotel.hotel_id}`;
}

function bookingUrlFromId(hotelId: number): string {
  return `https://www.booking.com/hotel/search.html?hotel_id=${hotelId}`;
}

function buildDescription(
  name:    string,
  city:    string,
  country: string,
  data: {
    starClass?:      number;
    address?:        string;
    district?:       string;
    reviewScore?:    number;
    reviewWord?:     string;
    reviewCount?:    number;
    checkinFrom?:    string;
    checkoutUntil?:  string;
    rawDescription?: string;
    price?:          number;
    currency?:       string;
  }
): string {
  const parts: string[] = [];
  const starLabel = data.starClass ? `${data.starClass}-star ` : "";
  parts.push(`${name} is a ${starLabel}hotel in ${city}, ${country}.`);

  if (data.rawDescription && data.rawDescription.trim().length > 20) {
    parts.push(data.rawDescription.trim());
  } else {
    if (data.address)   parts.push(`Address: ${data.address}.`);
    if (data.district)  parts.push(`Located in the ${data.district} district.`);
    if (data.reviewScore && data.reviewScore > 0) {
      const word    = data.reviewWord ?? "Reviewed";
      const reviews = data.reviewCount ? ` by ${data.reviewCount.toLocaleString()} guests` : "";
      parts.push(`Rated "${word}" — ${data.reviewScore}/10${reviews}.`);
    }
  }

  if (data.price && data.price > 0 && data.currency) {
    parts.push(`Prices from ${currencySymbol(data.currency)}${data.price.toLocaleString()} per night.`);
  }

  if (data.checkinFrom || data.checkoutUntil) {
    const ci  = data.checkinFrom   ? `Check-in from ${data.checkinFrom}`   : "";
    const co  = data.checkoutUntil ? `check-out by ${data.checkoutUntil}`  : "";
    const sep = ci && co ? "; " : "";
    parts.push(`${ci}${sep}${co}.`);
  }

  return parts.filter(Boolean).join(" ");
}

function normaliseFacilities(
  facilitiesBlock?: Array<{ name: string; facilities: Array<{ name: string }> }>,
  checkinFrom?:     string,
  checkoutUntil?:   string
): string[] {
  const defaults = ["Free WiFi", "24-Hour Front Desk", "Daily Housekeeping"];
  if (facilitiesBlock && facilitiesBlock.length > 0) {
    const names = new Set<string>(defaults);
    for (const block of facilitiesBlock) {
      for (const f of block.facilities) {
        if (f.name?.trim()) names.add(f.name.trim());
      }
    }
    return Array.from(names).slice(0, 20);
  }
  if (checkinFrom)   defaults.push("Early Check-in Available");
  if (checkoutUntil) defaults.push("Late Checkout Available");
  return defaults;
}

function normaliseReviews(raw: BookingReview[]): ExternalReview[] {
  return raw
    .filter((r) => r.reviewer_score && (r.pros || r.title))
    .slice(0, 10)
    .map((r): ExternalReview => ({
      reviewer: r.reviewer_name ?? "Guest",
      score:    r.reviewer_score ?? r.average_score ?? 0,
      title:    r.title ?? "",
      text:     [r.pros, r.cons].filter(Boolean).join(" | ") || (r.title ?? ""),
      date:     r.date ?? "",
    }));
}

function defaultDates(): {
  inDate: Date; outDate: Date;
  checkinDate: string; checkoutDate: string; nights: number;
} {
  const today   = new Date();
  const inDate  = new Date(today); inDate.setDate(today.getDate() + 1);
  const outDate = new Date(inDate); outDate.setDate(inDate.getDate() + 1);
  return {
    inDate, outDate,
    checkinDate:  toYMD(inDate),
    checkoutDate: toYMD(outDate),
    nights: 1,
  };
}

// ─── Determine which currency to request from Booking.com ─────────────────────
/**
 * If the search city is in India we should request INR prices so that the
 * API returns native INR values (not a GBP-converted amount which is then
 * shown with a ₹ symbol — that would be wrong).
 * Otherwise use GBP as the base (consistent with our DB hotel prices).
 */
function filterCurrencyForCity(resolvedCountry: string): string {
  return INDIAN_COUNTRIES.has(resolvedCountry.toLowerCase().trim()) ? "INR" : "GBP";
}

// ─── EXPORT 1: fetchExternalHotels ────────────────────────────────────────────

export async function fetchExternalHotels(
  city:      string,
  limit      = 20,
  checkIn?:  Date,
  checkOut?: Date
): Promise<ExternalHotel[]> {
  if (!apiCredentialsPresent()) return [];

  const client = buildClient();
  const def    = defaultDates();
  const inDate  = checkIn  ?? def.inDate;
  const outDate = checkOut ?? def.outDate;
  const checkinDate  = toYMD(inDate);
  const checkoutDate = toYMD(outDate);
  const nights = Math.max(1, Math.round((outDate.getTime() - inDate.getTime()) / 86_400_000));

  // ── Step 1: Location resolution ────────────────────────────────────────────
  let destId: string, destType: string;
  let resolvedCity = city, resolvedCountry = "";

  try {
    const { data: locations } = await client.get<BookingLocation[]>(
      "/hotels/locations",
      { params: { name: city, locale: "en-gb" } }
    );
    if (!Array.isArray(locations) || locations.length === 0) {
      console.warn(`[externalHotelService] No location for "${city}".`);
      return [];
    }
    const best      = locations.find((l) => l.dest_type === "city") ?? locations[0];
    destId          = best.dest_id;
    destType        = best.dest_type;
    const parts     = best.label.split(",").map((p) => p.trim());
    resolvedCity    = best.city_name ?? parts[0] ?? city;
    resolvedCountry = best.country   ?? parts[parts.length - 1] ?? "";
  } catch (err: any) {
    console.error("[externalHotelService] Location lookup failed:", err?.message);
    return [];
  }

  // Decide which currency to request prices in
  const requestCurrency = filterCurrencyForCity(resolvedCountry);

  // ── Step 2: Hotel search ───────────────────────────────────────────────────
  let raw: BookingHotel[] = [];
  try {
    const { data } = await client.get<BookingSearchResponse>("/hotels/search", {
      params: {
        dest_id:            destId!,
        dest_type:          destType!,
        checkin_date:       checkinDate,
        checkout_date:      checkoutDate,
        adults_number:      "2",
        room_number:        "1",
        order_by:           "popularity",
        units:              "metric",
        filter_by_currency: requestCurrency,   // ← INR for India, GBP elsewhere
        locale:             "en-gb",
        page_number:        "0",
        include_adjacency:  "true",
      },
    });
    if (!Array.isArray(data?.result) || data.result.length === 0) {
      console.warn(`[externalHotelService] No hotels for "${resolvedCity}".`);
      return [];
    }
    raw = data.result;
  } catch (err: any) {
    console.error("[externalHotelService] Hotel search failed:", err?.message);
    return [];
  }

  // ── Step 3: Normalise ──────────────────────────────────────────────────────
  return raw.slice(0, limit).map((h): ExternalHotel => {
    // ── CURRENCY FIX: extract price AND currency together ──────────────────
    const { price: pricePerNight, currency } = extractPriceAndCurrency(
      h, nights, resolvedCountry
    );

    const starRating    = toStarRating(h.class, h.review_score);
    const averageRating = h.review_score ? parseFloat((h.review_score / 2).toFixed(1)) : 0;
    const photo = forceHttps(h.max_photo_url) ?? forceHttps(h.main_photo_url) ??
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80";

    return {
      _id:     `booking_${h.hotel_id}`,
      userId:  "",
      name:    h.hotel_name,
      city:    h.city || resolvedCity,
      country: h.country_trans || resolvedCountry,
      description: buildDescription(
        h.hotel_name, h.city || resolvedCity, h.country_trans || resolvedCountry,
        {
          starClass:     h.class,
          address:       h.address,
          district:      h.district,
          reviewScore:   h.review_score,
          reviewWord:    h.review_score_word,
          reviewCount:   h.review_nr,
          checkinFrom:   h.checkin?.from,
          checkoutUntil: h.checkout?.until,
          price:         pricePerNight,
          currency,
        }
      ),
      type:          ["Hotel"],
      adultCount:    2,
      childCount:    0,
      facilities:    normaliseFacilities(undefined, h.checkin?.from, h.checkout?.until),
      pricePerNight, // ← EXACT value from API, never multiplied
      currency,      // ← EXACT currency from API (e.g. "INR", "GBP")
      starRating,
      imageUrls:     [photo],
      lastUpdated:   new Date(),
      totalBookings: 0,
      totalRevenue:  0,
      averageRating,
      reviewCount:   h.review_nr ?? 0,
      isActive:      true,
      isFeatured:    false,
      contact: {
        phone:   "",
        email:   "",
        website: buildBookingUrl(h),
      },
      policies: {
        checkInTime:        h.checkin?.from   ?? "From 15:00",
        checkOutTime:       h.checkout?.until ?? "Until 11:00",
        cancellationPolicy: "Cancellation policy varies — contact the property.",
        petPolicy:          "Please contact the property regarding pet policy.",
        smokingPolicy:      "Please check with the property for smoking policy.",
      },
      source:         "external",
      bookingHotelId: h.hotel_id,
      bookingUrl:     buildBookingUrl(h),
    };
  });
}

// ─── EXPORT 2: getHotelDetails ────────────────────────────────────────────────

export async function getHotelDetails(rawId: string): Promise<ExternalHotel | null> {
  if (!apiCredentialsPresent()) return null;

  const numericId = rawId.replace(/^booking_/, "");
  const hotelId   = parseInt(numericId, 10);
  if (!hotelId || isNaN(hotelId)) {
    console.error(`[externalHotelService] Invalid id: "${rawId}"`);
    return null;
  }

  const client = buildClient();
  const def    = defaultDates();

  let hotelData:  BookingHotelData | null = null;
  let reviewsRaw: BookingReview[]         = [];
  let photosRaw:  BookingPhoto[]          = [];

  try {
    const [dataRes, reviewsRes, photosRes] = await Promise.allSettled([
      client.get<BookingHotelData>("/hotels/data", {
        params: { hotel_id: String(hotelId), locale: "en-gb" },
      }),
      client.get<{ result: BookingReview[] }>("/hotels/reviews", {
        params: {
          hotel_id:      String(hotelId),
          locale:        "en-gb",
          sort_type:     "SORT_MOST_RELEVANT",
          customer_type: "solo_traveller,review_category_group_of_friends",
        },
      }),
      client.get<BookingPhoto[]>("/hotels/photos", {
        params: { hotel_id: String(hotelId), locale: "en-gb" },
      }),
    ]);

    if (dataRes.status === "fulfilled")    hotelData  = dataRes.value.data;
    if (reviewsRes.status === "fulfilled") reviewsRaw = reviewsRes.value.data?.result ?? [];
    if (photosRes.status === "fulfilled")
      photosRaw = Array.isArray(photosRes.value.data) ? photosRes.value.data : [];

    if (dataRes.status    === "rejected") console.warn("[externalHotelService] /hotels/data failed:", dataRes.reason?.message);
    if (reviewsRes.status === "rejected") console.warn("[externalHotelService] /hotels/reviews failed:", reviewsRes.reason?.message);
    if (photosRes.status  === "rejected") console.warn("[externalHotelService] /hotels/photos failed:", photosRes.reason?.message);
  } catch (err: any) {
    console.error("[externalHotelService] parallel fetch failed:", err?.message);
    return null;
  }

  if (!hotelData) {
    console.error(`[externalHotelService] No data for hotel_id=${hotelId}`);
    return null;
  }

  const country = hotelData.country_trans ?? hotelData.country ?? "";

  // ── Price — consistent with fetchExternalHotels ────────────────────────────
  // First try the data endpoint's price_breakdown field
  let { price: pricePerNight, currency } = extractPriceAndCurrencyFromData(hotelData, country);

  // If detail endpoint didn't have price, re-run a one-night search
  if (pricePerNight === 0) {
    try {
      const cityHint = hotelData.city ?? country;
      if (cityHint) {
        const requestCurrency = filterCurrencyForCity(country);
        const { data: locs } = await client.get<BookingLocation[]>("/hotels/locations", {
          params: { name: cityHint, locale: "en-gb" },
        });
        const best = Array.isArray(locs) && locs.length > 0
          ? (locs.find((l) => l.dest_type === "city") ?? locs[0]) : null;

        if (best) {
          const { data: searchData } = await client.get<BookingSearchResponse>("/hotels/search", {
            params: {
              dest_id:            best.dest_id,
              dest_type:          best.dest_type,
              checkin_date:       def.checkinDate,
              checkout_date:      def.checkoutDate,
              adults_number:      "2",
              room_number:        "1",
              order_by:           "popularity",
              filter_by_currency: requestCurrency,
              locale:             "en-gb",
              page_number:        "0",
            },
          });
          const match = (searchData?.result ?? []).find((h) => h.hotel_id === hotelId);
          if (match) {
            const extracted = extractPriceAndCurrency(match, 1, country);
            pricePerNight   = extracted.price;
            currency        = extracted.currency;
          }
        }
      }
    } catch (priceErr: any) {
      console.warn("[externalHotelService] Price re-fetch failed:", priceErr?.message);
    }
  }

  // ── Description ───────────────────────────────────────────────────────────
  const rawDescription = (() => {
    if (hotelData.description_translations?.length) {
      const en = hotelData.description_translations.find((t) => t.languagecode === "en");
      return en?.description ?? hotelData.description_translations[0]?.description ?? "";
    }
    return hotelData.hotel_description ?? "";
  })();

  // ── Images ────────────────────────────────────────────────────────────────
  const imageUrls = photosRaw
    .slice(0, 10)
    .map((p) => forceHttps(p.url_max) ?? forceHttps(p.url_1440) ?? null)
    .filter((u): u is string => u !== null);
  if (imageUrls.length === 0)
    imageUrls.push("https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80");

  // ── Facilities ────────────────────────────────────────────────────────────
  const facilities = normaliseFacilities(
    hotelData.facilities_block,
    hotelData.checkin?.from,
    hotelData.checkout?.until
  );

  const city          = hotelData.city ?? "";
  const name          = hotelData.name ?? `Hotel ${hotelId}`;
  const starRating    = toStarRating(hotelData.class, hotelData.review_score);
  const averageRating = hotelData.review_score
    ? parseFloat((hotelData.review_score / 2).toFixed(1)) : 0;

  return {
    _id:     `booking_${hotelId}`,
    userId:  "",
    name,
    city,
    country,
    description: buildDescription(name, city, country, {
      starClass:      hotelData.class,
      address:        hotelData.address,
      district:       hotelData.district,
      reviewScore:    hotelData.review_score,
      reviewWord:     hotelData.review_score_word,
      reviewCount:    hotelData.review_nr,
      checkinFrom:    hotelData.checkin?.from,
      checkoutUntil:  hotelData.checkout?.until,
      rawDescription: rawDescription || undefined,
      price:          pricePerNight,
      currency,
    }),
    type:          ["Hotel"],
    adultCount:    2,
    childCount:    0,
    facilities,
    pricePerNight, // ← from API, never hardcoded
    currency,      // ← from API (e.g. "INR" for Indian hotels)
    starRating,
    imageUrls,
    lastUpdated:   new Date(),
    totalBookings: 0,
    totalRevenue:  0,
    averageRating,
    reviewCount:   hotelData.review_nr ?? reviewsRaw.length,
    isActive:      true,
    isFeatured:    false,
    reviews:       normaliseReviews(reviewsRaw),
    contact: {
      phone:   "",
      email:   "",
      website: bookingUrlFromId(hotelId),
    },
    policies: {
      checkInTime:        hotelData.checkin?.from   ?? "From 15:00",
      checkOutTime:       hotelData.checkout?.until ?? "Until 11:00",
      cancellationPolicy: "Cancellation policy varies — verify with the property.",
      petPolicy:          "Please contact the property regarding pets.",
      smokingPolicy:      "Non-smoking rooms may be available — check with the property.",
    },
    source:         "external",
    bookingHotelId: hotelId,
    bookingUrl:     bookingUrlFromId(hotelId),
  };
}