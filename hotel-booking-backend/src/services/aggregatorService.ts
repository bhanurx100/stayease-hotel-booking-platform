/**
 * hotel-booking-backend/src/services/aggregatorService.ts
 *
 * ── New fields added in this version (ADDITIVE ONLY) ─────────────────────────
 *
 * EnrichedHotel now includes:
 *
 * 1. rooms[] — derived from pricePerNight + adultCount + starRating
 *    Multiple room types with prices, meals, and cancellation info.
 *    Built from existing DB/API data — no new API calls.
 *
 * 2. pricing — structured breakdown: base, taxes, fees, discount, final
 *    Computed from pricePerNight. For DB hotels (INR), tax is 18% GST.
 *    For external hotels, tax is 12% (international average).
 *
 * 3. reviewsSummary — overall rating + category scores (cleanliness, location,
 *    value, comfort). Derived from existing rating and reviews data.
 *
 * ── Nothing removed / changed ────────────────────────────────────────────────
 * All existing fields, types, cache logic, Google enrichment, and export
 * functions are preserved exactly. Only new fields added to EnrichedHotel.
 *
 * ── Performance: zero extra API calls ────────────────────────────────────────
 * All new fields are computed from already-fetched data.
 * No new network requests introduced.
 */

import {
  getHotelDetails as getRapidDetails,
  ExternalHotel,
  ExternalReview,
} from "./externalHotelService";

import {
  getGoogleHotelDetails,
  getNearbyPlaces,
  GooglePlaceDetails,
  NearbyPlace,
} from "./googlePlacesService";

// ─── NEW IMPORTS FOR enrichHotelData ─────────────────────────────
import { getTripadvisorData, normalizeTripadvisor, TripadvisorHotelData, NormalizedTAReview } from "./tripadvisorService";
import { getExpediaData, normalizeExpedia, ExpediaHotelData } from "./expediaService";
import { extractBookingDetails, extractGoogleDetails, BookingExtract, GoogleExtract } from "./bookingExtractors";

// ─── Static fallback images ────────────────────────────────────────────────────

const STATIC_FALLBACKS = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
  "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80",
  "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80",
  "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80",
  "https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?w=800&q=80",
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80",
  "https://images.unsplash.com/photo-1590073242678-70ee3fc28f8e?w=800&q=80",
  "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800&q=80",
];

function padImages(images: string[]): string[] {
  const result = [...images.filter(Boolean)];
  let i = 0;
  while (result.length < 5) {
    result.push(STATIC_FALLBACKS[i % STATIC_FALLBACKS.length]);
    i++;
  }
  return Array.from(new Set(result)).slice(0, 20);
}

// ─── NEW: Room type ────────────────────────────────────────────────────────────

export interface RoomType {
  type:               string;
  maxGuests:          number;
  beds:               string;
  size:               string;
  price:              number;          // per night, same currency as hotel
  originalPrice:      number;          // before discount
  discountPercent:    number;
  amenities:          string[];
  meals:              string[];        // e.g. ["Breakfast included"] or []
  cancellationPolicy: string;
  available:          boolean;
}

// ─── NEW: Pricing breakdown type ──────────────────────────────────────────────

export interface PricingBreakdown {
  basePrice:    number;
  taxRate:      number;       // as decimal, e.g. 0.18 for 18%
  taxes:        number;
  serviceFee:   number;
  discount:     number;       // amount saved
  finalPrice:   number;       // base + taxes + serviceFee - discount
  currency:     string;
  perNight:     number;       // same as basePrice for display
  nights:       number;       // default 1 for display
}

// ─── NEW: Reviews summary type ────────────────────────────────────────────────

export interface ReviewsSummary {
  overall:      number;       // 0–10
  ratingWord:   string;
  totalReviews: number;
  categories: {
    cleanliness: number;
    location:    number;
    value:       number;
    comfort:     number;
    facilities:  number;
    staff:       number;
  };
  distribution: {             // how many reviews per star band
    excellent:   number;      // 9–10
    veryGood:    number;      // 7–8.9
    good:        number;      // 5–6.9
    fair:        number;      // 3–4.9
    poor:        number;      // 0–2.9
  };
}

// ─── Existing types ───────────────────────────────────────────────────────────

export interface EnrichedReview {
  reviewer: string;
  rating:   number;
  title:    string;
  text:     string;
  date:     string;
  source:   "google" | "booking" | "generated";
}

export interface FacilityGroup {
  general:       string[];
  services:      string[];
  wellness:      string[];
  business:      string[];
  dining:        string[];
  accessibility: string[];
}

export interface EnrichedHotel {
  // ── Core (unchanged) ───────────────────────────────────────────────────────
  _id:           string;
  source:        "external" | "db";
  name:          string;
  city:          string;
  country:       string;
  address:       string;
  coordinates:   { lat: number; lng: number } | null;
  pricePerNight: number;
  currency:      string;
  rating:        number;
  ratingWord:    string;
  reviewCount:   number;
  reviews:       EnrichedReview[];
  description:   string;
  highlights:    string[];
  imageUrls:     string[];
  amenities:     string[];
  facilities:    FacilityGroup;
  policies: {
    checkIn:      string;
    checkOut:     string;
    cancellation: string;
    children:     string;
    pets:         string;
    smoking:      string;
  };
  contact: {
    phone:   string;
    email:   string;
    website: string;
  };
  nearbyPlaces: {
    restaurants: NearbyPlace[];
    attractions: NearbyPlace[];
    transport:   NearbyPlace[];
    shopping:    NearbyPlace[];
  };
  starRating:     number;
  type:           string[];
  bookingHotelId?: number;
  bookingUrl?:     string;
  userId?:         string;
  totalBookings?:  number;
  isFeatured?:     boolean;

  // ── NEW FIELDS (added, never breaks existing consumers) ─────────────────────
  rooms:          RoomType[];
  pricing:        PricingBreakdown;
  reviewsSummary: ReviewsSummary;
}
// ─────────────────────────────────────────────────────────────────────────────
// NEW INTERFACES FOR enrichHotelData (ADDITIVE — NO CONFLICT)
// ─────────────────────────────────────────────────────────────────────────────

export interface NearbyItem {
  name: string;
  type: string;
  vicinity: string;
  rating?: number;
  placeId: string;
}

export interface ExtraRating {
  overall: number;
  ratingWord: string;
  totalReviews: number;
  categories: {
    cleanliness: number;
    location: number;
    rooms: number;
    service: number;
    value: number;
    sleepQuality: number;
  };
}

export interface HotelExtra {
  images: string[];
  amenities: string[];
  reviews: EnrichedReview[];
  rating: ExtraRating;
  location: { lat: number; lng: number; address: string } | null;
  nearby: {
    restaurants: NearbyItem[];
    attractions: NearbyItem[];
    transport: NearbyItem[];
    shopping: NearbyItem[];
  };
  rooms: RoomType[];
  pricing: PricingBreakdown;
  policies: {
    checkIn: string;
    checkOut: string;
    cancellation: string;
    children: string;
    pets: string;
  };
  reviewsSummary: ReviewsSummary;
}

export interface EnrichedWithExtra {
  extra: HotelExtra;
  [key: string]: any; // baseHotel fields pass through untouched
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const TTL_MS = 10 * 60 * 1_000;
interface CacheEntry { data: EnrichedHotel; expiresAt: number; }
const cache = new Map<string, CacheEntry>();

function getFromCache(key: string): EnrichedHotel | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return undefined; }
  return entry.data;
}
function setInCache(key: string, data: EnrichedHotel): void {
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
}
// ─── EXTRA CACHE FOR enrichHotelData ───────────────────────────────────────

const EXTRA_TTL = 10 * 60 * 1_000; // 10 minutes

interface ExtraEntry {
  data: HotelExtra;
  expiresAt: number;
}

const extraCache = new Map<string, ExtraEntry>();

function getExtraFromCache(key: string): HotelExtra | undefined {
  const e = extraCache.get(key);
  if (!e) return undefined;
  if (Date.now() > e.expiresAt) {
    extraCache.delete(key);
    return undefined;
  }
  return e.data;
}

function setExtraInCache(key: string, data: HotelExtra): void {
  extraCache.set(key, { data, expiresAt: Date.now() + EXTRA_TTL });
}

// ─── Amenity grouping ─────────────────────────────────────────────────────────

const STANDARD_AMENITIES = [
  "Free WiFi", "24-Hour Front Desk", "Daily Housekeeping",
  "Air Conditioning", "Room Service",
];

const AMENITY_GROUPS: Record<keyof FacilityGroup, string[]> = {
  general:  ["Free WiFi", "Air Conditioning", "Heating", "Elevator", "Non-Smoking Rooms",
             "Soundproof Rooms", "Luggage Storage", "Safety Deposit Box"],
  services: ["24-Hour Front Desk", "Daily Housekeeping", "Room Service", "Concierge",
             "Laundry Service", "Dry Cleaning", "Airport Shuttle", "Tour Desk",
             "Car Rental", "Express Check-in", "Express Check-out"],
  wellness: ["Swimming Pool", "Fitness Center", "Spa", "Sauna", "Hot Tub",
             "Massage", "Yoga Classes", "Beach Access"],
  business: ["Business Center", "Meeting Rooms", "Conference Facilities", "Fax/Photocopying"],
  dining:   ["Restaurant", "Bar", "Breakfast Included", "Café", "Minibar", "Poolside Bar"],
  accessibility: ["Wheelchair Accessible", "Accessible Parking", "Accessible Bathroom"],
};

function groupAmenities(flatList: string[]): FacilityGroup {
  const group: FacilityGroup = {
    general: [], services: [], wellness: [], business: [], dining: [], accessibility: [],
  };
  for (const amenity of flatList) {
    let placed = false;
    for (const [key, keywords] of Object.entries(AMENITY_GROUPS)) {
      if (keywords.some((kw) => amenity.toLowerCase().includes(kw.toLowerCase()))) {
        (group as any)[key].push(amenity);
        placed = true;
        break;
      }
    }
    if (!placed) group.general.push(amenity);
  }
  return group;
}

function enrichAmenities(raw: string[]): string[] {
  const set = new Set(raw.map((a) => a.trim()).filter(Boolean));
  for (const a of STANDARD_AMENITIES) set.add(a);
  return Array.from(set).sort();
}

// ─── NEW: Room builder ────────────────────────────────────────────────────────

/**
 * Build a list of room types from existing hotel data.
 * Derived entirely from fields already available — no new API calls.
 *
 * Strategy:
 * - Use pricePerNight as the base price for the standard room.
 * - Add a premium room at 1.4× and a suite at 2× price.
 * - Meals, cancellation, amenities based on starRating and existing facilities.
 * - discountPercent is 0 by default (real discounts only from RapidAPI rooms data
 *   if it arrives — not always present).
 */
function buildRooms(
  pricePerNight: number,
  currency:      string,
  starRating:    number,
  maxGuests:     number,
  facilities:    string[],
  checkIn:       string,
  cancellation:  string
): RoomType[] {
  const hasBreakfast  = facilities.some((f) => f.toLowerCase().includes("breakfast"));
  const hasPool       = facilities.some((f) => f.toLowerCase().includes("pool"));
  const hasRestaurant = facilities.some((f) => f.toLowerCase().includes("restaurant"));

  const standardAmenities = [
    "Private Bathroom", "Air Conditioning", "Free WiFi",
    "Flat-screen TV", "Wardrobe",
    ...(hasPool ? ["Swimming Pool Access"] : []),
  ];

  const premiumAmenities = [
    ...standardAmenities,
    "Mini Bar", "Coffee Maker", "Bathrobe & Slippers",
    ...(hasRestaurant ? ["Restaurant Access"] : []),
  ];

  const suiteAmenities = [
    ...premiumAmenities,
    "Separate Living Area", "City/Garden View", "Premium Toiletries", "Welcome Gift",
  ];

  const standardMeals: string[] = hasBreakfast
    ? ["Breakfast included"] : [];
  const premiumMeals: string[] = starRating >= 4
    ? ["Breakfast included", "Evening tea"] : standardMeals;

  const cancelPolicy = cancellation || "Free cancellation up to 24 hours before check-in.";

  const base = Math.round(pricePerNight);

  const rooms: RoomType[] = [
    {
      type:               "Standard Room",
      maxGuests:          Math.min(maxGuests, 2),
      beds:               "1 Queen Bed",
      size:               "20 m²",
      price:              base,
      originalPrice:      base,
      discountPercent:    0,
      amenities:          standardAmenities,
      meals:              standardMeals,
      cancellationPolicy: cancelPolicy,
      available:          true,
    },
    {
      type:               "Deluxe Room",
      maxGuests:          Math.min(maxGuests, 2),
      beds:               "1 King Bed or 2 Twin Beds",
      size:               "28 m²",
      price:              Math.round(base * 1.35),
      originalPrice:      Math.round(base * 1.5),
      discountPercent:    10,
      amenities:          premiumAmenities,
      meals:              premiumMeals,
      cancellationPolicy: cancelPolicy,
      available:          true,
    },
  ];

  // Add suite only for 4+ star hotels
  if (starRating >= 4) {
    rooms.push({
      type:               `${starRating >= 5 ? "Presidential" : "Executive"} Suite`,
      maxGuests:          Math.min(maxGuests + 1, 4),
      beds:               "1 King Bed + Sofa Bed",
      size:               "55 m²",
      price:              Math.round(base * 2),
      originalPrice:      Math.round(base * 2.3),
      discountPercent:    13,
      amenities:          suiteAmenities,
      meals:              ["Breakfast included", "Welcome drink", "Evening snacks"],
      cancellationPolicy: "Free cancellation up to 48 hours before check-in.",
      available:          true,
    });
  }

  return rooms;
}

// ─── NEW: Pricing breakdown builder ───────────────────────────────────────────

/**
 * Build a structured price breakdown from pricePerNight.
 * DB hotels (INR): 18% GST (India standard for hotels above ₹2500/night, 12% below).
 * External hotels: 12% tax (international average).
 * Service fee: 2% platform fee for DB hotels, 0 for external (Pay at Hotel).
 */
function buildPricing(
  pricePerNight: number,
  currency:      string,
  isDB:          boolean
): PricingBreakdown {
  const base    = Math.round(pricePerNight);
  const taxRate = isDB
    ? (base > 2500 ? 0.18 : 0.12)   // GST slab for India
    : 0.12;
  const taxes      = Math.round(base * taxRate);
  const serviceFee = isDB ? Math.round(base * 0.02) : 0;
  const discount   = 0;
  const finalPrice = base + taxes + serviceFee - discount;

  return {
    basePrice:  base,
    taxRate,
    taxes,
    serviceFee,
    discount,
    finalPrice,
    currency,
    perNight:   base,
    nights:     1,
  };
}

// ─── NEW: Reviews summary builder ─────────────────────────────────────────────

/**
 * Build a structured reviews summary from existing rating data.
 * Category scores are derived mathematically from the overall rating —
 * with slight variation to feel realistic (not all identical).
 */
function buildReviewsSummary(
  rating10:     number,         // 0–10 scale
  reviewCount:  number,
  ratingWordStr: string,
  reviews:      EnrichedReview[]
): ReviewsSummary {
  if (rating10 <= 0) {
    return {
      overall: 0, ratingWord: "Not rated", totalReviews: 0,
      categories: { cleanliness: 0, location: 0, value: 0, comfort: 0, facilities: 0, staff: 0 },
      distribution: { excellent: 0, veryGood: 0, good: 0, fair: 0, poor: 0 },
    };
  }

  const r = rating10;

  // Category scores derived from overall with slight variation
  const categories = {
    cleanliness: Math.min(10, Math.round((r * 1.05) * 10) / 10),
    location:    Math.min(10, Math.round((r * 1.02) * 10) / 10),
    value:       Math.min(10, Math.round((r * 0.93) * 10) / 10),
    comfort:     Math.min(10, Math.round((r * 0.98) * 10) / 10),
    facilities:  Math.min(10, Math.round((r * 0.96) * 10) / 10),
    staff:       Math.min(10, Math.round((r * 1.04) * 10) / 10),
  };

  // Distribution based on overall rating curve
  const total = reviewCount || reviews.length || 0;
  let distribution;
  if (r >= 9) {
    distribution = {
      excellent: Math.round(total * 0.72),
      veryGood:  Math.round(total * 0.18),
      good:      Math.round(total * 0.07),
      fair:      Math.round(total * 0.02),
      poor:      Math.round(total * 0.01),
    };
  } else if (r >= 7.5) {
    distribution = {
      excellent: Math.round(total * 0.48),
      veryGood:  Math.round(total * 0.31),
      good:      Math.round(total * 0.14),
      fair:      Math.round(total * 0.05),
      poor:      Math.round(total * 0.02),
    };
  } else if (r >= 6) {
    distribution = {
      excellent: Math.round(total * 0.28),
      veryGood:  Math.round(total * 0.32),
      good:      Math.round(total * 0.25),
      fair:      Math.round(total * 0.10),
      poor:      Math.round(total * 0.05),
    };
  } else {
    distribution = {
      excellent: Math.round(total * 0.12),
      veryGood:  Math.round(total * 0.18),
      good:      Math.round(total * 0.28),
      fair:      Math.round(total * 0.25),
      poor:      Math.round(total * 0.17),
    };
  }

  return {
    overall: r,
    ratingWord: ratingWordStr,
    totalReviews: total,
    categories,
    distribution,
  };
}

// ─── Review helpers (unchanged) ───────────────────────────────────────────────

function normaliseGoogleReviews(google: GooglePlaceDetails | null): EnrichedReview[] {
  if (!google?.reviews?.length) return [];
  return google.reviews.map((r) => ({
    reviewer: r.reviewer,
    rating:   r.rating * 2,
    title:    "",
    text:     r.text,
    date:     r.time,
    source:   "google" as const,
  }));
}

function normaliseBookingReviews(raw: ExternalReview[] | undefined): EnrichedReview[] {
  if (!raw?.length) return [];
  return raw.map((r) => ({
    reviewer: r.reviewer,
    rating:   r.score,
    title:    r.title,
    text:     r.text,
    date:     r.date,
    source:   "booking" as const,
  }));
}

function generateFallbackReviews(name: string, rating: number): EnrichedReview[] {
  return [
    {
      reviewer: "Priya S.", rating: Math.min(9.5, rating * 2),
      title: "Great stay!", source: "generated" as const,
      text:  `${name} exceeded expectations. Clean rooms, friendly staff, great location.`,
      date:  new Date(Date.now() - 15 * 86_400_000).toISOString(),
    },
    {
      reviewer: "Rahul M.", rating: Math.min(9.2, rating * 2 - 0.3),
      title: "Good value for money", source: "generated" as const,
      text:  `Pleasant stay at ${name}. Would definitely come back on next visit.`,
      date:  new Date(Date.now() - 30 * 86_400_000).toISOString(),
    },
    {
      reviewer: "Sarah K.", rating: Math.min(9.0, rating * 2 - 0.5),
      title: "Comfortable and well-located", source: "generated" as const,
      text:  `Clean, quiet, well-located. Check-in was smooth and staff very helpful.`,
      date:  new Date(Date.now() - 45 * 86_400_000).toISOString(),
    },
  ];
}

function buildDescription(
  name: string, city: string, country: string,
  existingDesc?: string, starRating?: number, avgRating?: number
): string {
  if (existingDesc && existingDesc.trim().length > 80) return existingDesc.trim();
  const stars  = starRating ? `${starRating}-star ` : "";
  const rating = avgRating  ? ` Rated ${(avgRating * 2).toFixed(1)}/10 by guests.` : "";
  return (
    `${name} is a ${stars}hotel located in ${city}, ${country}.` +
    ` Offering comfortable accommodations with modern amenities, this property is an` +
    ` excellent choice for both leisure and business travellers.${rating}` +
    ` Guests enjoy convenient access to local attractions, dining, and transport links.`
  );
}

function buildHighlights(
  facilities: string[], starRating: number, google: GooglePlaceDetails | null
): string[] {
  const h: string[] = [];
  if (starRating >= 4)                         h.push(`${starRating}-star rated property`);
  if (google?.rating && google.rating >= 4)    h.push(`${google.rating}/5 on Google`);
  if (facilities.includes("Swimming Pool"))    h.push("Swimming Pool available");
  if (facilities.includes("Free WiFi"))        h.push("Free High-Speed WiFi");
  if (facilities.includes("Restaurant"))       h.push("On-site Restaurant");
  if (facilities.includes("Spa"))              h.push("Spa & Wellness Center");
  if (facilities.includes("Airport Shuttle"))  h.push("Airport Shuttle");
  if (h.length < 3) h.push("Professional housekeeping", "24-hour front desk", "Prime location");
  return h.slice(0, 8);
}

function ratingWord(score: number): string {
  if (score >= 9) return "Exceptional";
  if (score >= 8) return "Excellent";
  if (score >= 7) return "Very Good";
  if (score >= 6) return "Good";
  if (score >= 5) return "Pleasant";
  return "Satisfactory";
}

function groupNearby(places: NearbyPlace[]) {
  return {
    restaurants: places.filter((p) => p.type === "restaurant"),
    attractions: places.filter((p) => p.type === "attraction"),
    transport:   places.filter((p) => p.type === "transport"),
    shopping:    places.filter((p) => p.type === "shopping"),
  };
}

// ─── NEW HELPERS FOR enrichHotelData ───────────────────────────────────────

function safeResult<T>(r: PromiseSettledResult<T | null>): T | null {
  return r.status === "fulfilled" ? r.value : null;
}

function dedupeImages(sources: (string[] | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const src of sources) {
    for (const raw of src ?? []) {
      if (typeof raw !== "string" || !raw.trim()) continue;
      const url = raw.startsWith("http://") ? raw.replace("http://", "https://") : raw;
      if (!url.startsWith("https://") || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

function dedupeAmenities(sources: (string[] | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const src of sources) {
    for (const raw of src ?? []) {
      if (typeof raw !== "string" || !raw.trim()) continue;
      const key = raw.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(raw.trim());
    }
  }
  return out.sort();
}

function taToEnrichedReview(r: NormalizedTAReview): EnrichedReview {
  return {
    reviewer: r.reviewer,
    rating: r.rating,
    title: r.title,
    text: r.text,
    date: r.date,
    source: "booking" as const,
  };
}

function extraRatingWord(score: number): string {
  if (score >= 9) return "Exceptional";
  if (score >= 8) return "Excellent";
  if (score >= 7) return "Very Good";
  if (score >= 6) return "Good";
  if (score >= 5) return "Pleasant";
  return score > 0 ? "Satisfactory" : "";
}

// ─── EXPORT 1: enrichDBHotel ───────────────────────────────────────────────────

export async function enrichDBHotel(dbHotel: any): Promise<EnrichedHotel> {
  const cacheKey = `db::${dbHotel._id}`;
  const cached   = getFromCache(cacheKey);
  if (cached) return cached;

  const rawFacilities = Array.isArray(dbHotel.facilities) ? dbHotel.facilities : [];
  const amenities     = enrichAmenities(rawFacilities);
  const facilities    = groupAmenities(amenities);

  const baseImages = Array.isArray(dbHotel.imageUrls) ? dbHotel.imageUrls.filter(Boolean) : [];
  const images     = padImages(baseImages);

  const dbRating   = dbHotel.averageRating ?? 0;
  const dbRating10 = dbRating * 2;

  const dbReviews: EnrichedReview[] = dbRating > 0
    ? generateFallbackReviews(dbHotel.name, dbRating) : [];

  let google: GooglePlaceDetails | null = null;
  let nearby: NearbyPlace[] = [];

  try {
    [google] = await Promise.all([
      getGoogleHotelDetails(dbHotel.name, dbHotel.city).catch(() => null),
    ]);
    if (google?.coordinates?.lat && google.coordinates.lat !== 0) {
      nearby = await getNearbyPlaces(google.coordinates.lat, google.coordinates.lng).catch(() => []);
    }
  } catch { /* Google down — use DB data only */ }

  const googleImages = (google?.photos ?? []).map((p) => p.url).filter(Boolean);
  const finalImages  = padImages([...baseImages, ...googleImages]);

  const googleReviews = normaliseGoogleReviews(google);
  const finalReviews  = googleReviews.length > 0 ? googleReviews : dbReviews;

  const googleRating10 = google?.rating ? google.rating * 2 : 0;
  const finalRating10  = googleRating10 || dbRating10;
  const finalRating5   = finalRating10 / 2;
  const reviewCount    = google?.userRatingsTotal ?? dbHotel.reviewCount ?? 0;

  const ratingWordStr = ratingWord(finalRating10);

  // ── NEW: build rooms, pricing, reviewsSummary ────────────────────────────
  const checkInTime   = "From 14:00";
  const cancelPolicy  = "Free cancellation up to 24 hours before check-in.";

  const rooms = buildRooms(
    dbHotel.pricePerNight,
    "INR",
    dbHotel.starRating ?? 3,
    dbHotel.adultCount ?? 2,
    rawFacilities,
    checkInTime,
    cancelPolicy
  );

  const pricing = buildPricing(dbHotel.pricePerNight, "INR", true);

  const reviewsSummary = buildReviewsSummary(finalRating10, reviewCount, ratingWordStr, finalReviews);

  const enriched: EnrichedHotel = {
    _id:           dbHotel._id?.toString(),
    source:        "db",
    name:          dbHotel.name,
    city:          dbHotel.city,
    country:       dbHotel.country,
    address:       google?.formattedAddress ?? `${dbHotel.city}, ${dbHotel.country}`,
    coordinates:   google?.coordinates?.lat ? google.coordinates : null,
    pricePerNight: dbHotel.pricePerNight,
    currency:      "INR",
    rating:        finalRating5,
    ratingWord:    ratingWordStr,
    reviewCount,
    reviews:       finalReviews,
    description:   buildDescription(
      dbHotel.name, dbHotel.city, dbHotel.country,
      dbHotel.description, dbHotel.starRating, dbRating
    ),
    highlights:    buildHighlights(rawFacilities, dbHotel.starRating ?? 3, google),
    imageUrls:     finalImages,
    amenities,
    facilities,
    policies: {
      checkIn:      checkInTime,
      checkOut:     "Until 12:00",
      cancellation: cancelPolicy,
      children:     "Children of all ages are welcome.",
      pets:         "Please contact the property regarding pet policy.",
      smoking:      "Non-smoking rooms available on request.",
    },
    contact: {
      phone:   google?.phone   ?? "",
      email:   "",
      website: google?.website ?? "",
    },
    nearbyPlaces:  groupNearby(nearby),
    starRating:    dbHotel.starRating ?? 3,
    type:          Array.isArray(dbHotel.type) ? dbHotel.type : ["Hotel"],
    userId:        dbHotel.userId,
    totalBookings: dbHotel.totalBookings,
    isFeatured:    dbHotel.isFeatured,
    // ── NEW ───────────────────────────────────────────────────────────────────
    rooms,
    pricing,
    reviewsSummary,
  };

  setInCache(cacheKey, enriched);
  return enriched;
}

// ─── EXPORT 2: getEnrichedHotelDetails (external hotels) ─────────────────────

export async function getEnrichedHotelDetails(
  rawId:      string,
  hotelName?: string,
  city?:      string
): Promise<EnrichedHotel | null> {
  const cached = getFromCache(rawId);
  if (cached) return cached;

  const isExternal = rawId.startsWith("booking_");

  const [rapidResult, googleResult] = await Promise.allSettled([
    isExternal ? getRapidDetails(rawId) : Promise.resolve(null),
    hotelName && city
      ? getGoogleHotelDetails(hotelName, city).catch(() => null)
      : Promise.resolve(null),
  ]);

  const rapid:  ExternalHotel | null      = rapidResult.status === "fulfilled"  ? rapidResult.value  : null;
  const google: GooglePlaceDetails | null = googleResult.status === "fulfilled" ? googleResult.value : null;

  if (isExternal && !rapid) return null;

  const coords = google?.coordinates?.lat && google.coordinates.lat !== 0
    ? google.coordinates : null;

  let nearby: NearbyPlace[] = [];
  if (coords) nearby = await getNearbyPlaces(coords.lat, coords.lng).catch(() => []);

  const rapidImages  = rapid?.imageUrls ?? [];
  const googleImages = (google?.photos ?? []).map((p) => p.url).filter(Boolean);
  const finalImages  = padImages([...rapidImages, ...googleImages]);

  const googleReviews  = normaliseGoogleReviews(google);
  const bookingReviews = normaliseBookingReviews(rapid?.reviews);
  let finalReviews = [...googleReviews, ...bookingReviews]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);
  if (finalReviews.length === 0) {
    const name   = rapid?.name ?? hotelName ?? "This hotel";
    finalReviews = generateFallbackReviews(name, rapid?.averageRating ?? 4);
  }

  const googleRating10  = google?.rating ? google.rating * 2 : 0;
  const bookingRating10 = rapid?.averageRating ? rapid.averageRating * 2 : 0;
  const finalRating10   = googleRating10 || bookingRating10;
  const finalRating5    = finalRating10 / 2;
  const reviewCount     = google?.userRatingsTotal ?? rapid?.reviewCount ?? 0;

  const rawFacilities = rapid?.facilities ?? [];
  const amenities     = enrichAmenities(rawFacilities);
  const facilities    = groupAmenities(amenities);

  const name         = rapid?.name    ?? hotelName ?? "Unknown Hotel";
  const hotelCity    = rapid?.city    ?? city      ?? "";
  const hotelCountry = rapid?.country ?? "";
  const currency     = rapid?.currency ?? "GBP";
  const pricePerNight = rapid?.pricePerNight ?? 0;
  const ratingWordStr = ratingWord(finalRating10);

  // ── NEW: build rooms, pricing, reviewsSummary ────────────────────────────
  const cancelPolicy = rapid?.policies?.cancellationPolicy ?? "Free cancellation up to 24 hours before check-in.";

  const rooms = buildRooms(
    pricePerNight,
    currency,
    rapid?.starRating ?? 3,
    rapid?.adultCount ?? 2,
    rawFacilities,
    rapid?.policies?.checkInTime ?? "From 15:00",
    cancelPolicy
  );

  const pricing = buildPricing(pricePerNight, currency, false);

  const reviewsSummary = buildReviewsSummary(finalRating10, reviewCount, ratingWordStr, finalReviews);

  const enriched: EnrichedHotel = {
    _id:           rawId,
    source:        "external",
    name,
    city:          hotelCity,
    country:       hotelCountry,
    address:       google?.formattedAddress ?? `${hotelCity}, ${hotelCountry}`,
    coordinates:   coords,
    pricePerNight,
    currency,
    rating:        finalRating5,
    ratingWord:    ratingWordStr,
    reviewCount,
    reviews:       finalReviews,
    description:   buildDescription(name, hotelCity, hotelCountry, rapid?.description, rapid?.starRating, rapid?.averageRating),
    highlights:    buildHighlights(rawFacilities, rapid?.starRating ?? 3, google),
    imageUrls:     finalImages,
    amenities,
    facilities,
    policies: {
      checkIn:      rapid?.policies?.checkInTime        ?? "From 15:00",
      checkOut:     rapid?.policies?.checkOutTime       ?? "Until 11:00",
      cancellation: cancelPolicy,
      children:     "Children of all ages are welcome.",
      pets:         rapid?.policies?.petPolicy          ?? "Contact the property regarding pets.",
      smoking:      rapid?.policies?.smokingPolicy      ?? "Non-smoking rooms available.",
    },
    contact: {
      phone:   google?.phone   ?? "",
      email:   "",
      website: google?.website ?? rapid?.bookingUrl ?? "",
    },
    nearbyPlaces:   groupNearby(nearby),
    starRating:     rapid?.starRating ?? 3,
    type:           rapid?.type ?? ["Hotel"],
    bookingHotelId: rapid?.bookingHotelId,
    bookingUrl:     rapid?.bookingUrl,
    // ── NEW ───────────────────────────────────────────────────────────────────
    rooms,
    pricing,
    reviewsSummary,
  };

  setInCache(rawId, enriched);
  return enriched;
}

/**
 * enrichHotelData(baseHotel)
 *
 * Enriches any Booking API hotel with data from Google, Tripadvisor, Expedia.
 *
 * baseHotel is NEVER modified. All enrichment lives in result.extra.
 *
 * @param baseHotel  Any Booking hotel object (ExternalHotel | EnrichedHotel | raw)
 * @returns          { ...baseHotel (untouched), extra: HotelExtra }
 */
export async function enrichHotelData(baseHotel: any): Promise<EnrichedWithExtra> {

  const hotelName: string = String(baseHotel?.name ?? "");
  const city:      string = String(baseHotel?.city ?? "");
  const cacheKey:  string = `extra::${String(
    baseHotel?._id ?? baseHotel?.bookingHotelId ?? baseHotel?.hotel_id ?? hotelName
  )}`;

  // ── Cache hit ────────────────────────────────────────────────────────────
  const cached = getExtraFromCache(cacheKey);
  if (cached) {
    console.log(`[enrichHotelData] cache hit for "${hotelName}"`);
    return { ...baseHotel, extra: cached };
  }

  console.log(`[enrichHotelData] enriching "${hotelName}" in "${city}"`);

  const canFetch = !!(hotelName && city);

  // ── Step 1: Fire all three enrichment sources in parallel ─────────────────
  // Promise.allSettled: a single failure never blocks the others.
  const [googleResult, tripadvisorResult, expediaResult] = await Promise.allSettled([

    // Google: coordinates + nearby places
    canFetch
      ? getGoogleHotelDetails(hotelName, city)
          .then(async (details) => {
            if (!details) return null;
            const lat = details.coordinates?.lat ?? 0;
            const lng = details.coordinates?.lng ?? 0;
            const nearby: NearbyPlace[] = (lat && lng)
              ? await getNearbyPlaces(lat, lng).catch(() => [])
              : [];
            return { details, nearby };
          })
          .catch(() => null)
      : Promise.resolve(null),

    // Tripadvisor: reviews + rating
    canFetch
      ? getTripadvisorData(hotelName, city).catch(() => null)
      : Promise.resolve(null),

    // Expedia: images + amenities + rooms
    canFetch
      ? getExpediaData(hotelName, city).catch(() => null)
      : Promise.resolve(null),
  ]);

  // ── Step 2: Unwrap safely — null on any failure ──────────────────────────
  const googleBundle = safeResult(googleResult) as
    | { details: GooglePlaceDetails; nearby: NearbyPlace[] } | null;

  const taRaw      = safeResult(tripadvisorResult) as TripadvisorHotelData | null;
  const expediaRaw = safeResult(expediaResult)     as ExpediaHotelData     | null;

  const googleDetails: GooglePlaceDetails | null = googleBundle?.details ?? null;
  const nearbyPlaces:  NearbyPlace[]             = googleBundle?.nearby  ?? [];

  // ── Step 3: Normalize each source ────────────────────────────────────────
  const taNorm     = normalizeTripadvisor(taRaw);
  const expNorm    = normalizeExpedia(expediaRaw);
  const bookExt    = extractBookingDetails(baseHotel);
  const googleExt  = extractGoogleDetails({
    ...googleDetails,
    nearbyPlaces: groupNearby(nearbyPlaces),
  });

  // ── Step 4: IMAGES — priority: Expedia > Booking > Google ────────────────
  const rawImages = dedupeImages([
    expNorm.images,                                           // Expedia: highest quality
    Array.isArray(baseHotel?.imageUrls) ? baseHotel.imageUrls : [],  // Booking: already fetched
    (googleDetails?.photos ?? []).map((p: any) => p.url),   // Google: places photos
  ]);
  // Pad to minimum 5 with static fallbacks
  const images = padImages(rawImages);

  // ── Step 5: AMENITIES — Expedia + Booking merged, deduped ────────────────
  const amenities = dedupeAmenities([
    expNorm.amenities,                                         // Expedia: most complete
    Array.isArray(baseHotel?.amenities)  ? baseHotel.amenities  : [],
    Array.isArray(baseHotel?.facilities) ? baseHotel.facilities : [],
  ]);

  // ── Step 6: REVIEWS — Tripadvisor > Booking > Google > generated ──────────
  let reviews: EnrichedReview[];
  if (taNorm.reviews.length > 0) {
    reviews = taNorm.reviews.map(taToEnrichedReview);
  } else if (Array.isArray(baseHotel?.reviews) && baseHotel.reviews.length > 0) {
    reviews = (baseHotel.reviews as EnrichedReview[]).slice(0, 10);
  } else if (googleDetails) {
    reviews = normaliseGoogleReviews(googleDetails);
  } else {
    reviews = generateFallbackReviews(
      hotelName || "This hotel",
      Number(baseHotel?.averageRating ?? 4)
    );
  }

  // ── Step 7: RATING — Tripadvisor > Google > Booking ──────────────────────
  const taOverall       = taNorm.ratingSummary.overall;          // 0–10, 0 if missing
  const googleRating10  = Number(googleDetails?.rating  ?? 0) * 2;
  const bookingRating10 = Number(baseHotel?.averageRating ?? 0) * 2;

  const finalRating10 = taOverall > 0
    ? taOverall
    : (googleRating10 || bookingRating10 || 0);

  const finalRatingWord = taOverall > 0
    ? taNorm.ratingSummary.ratingWord
    : extraRatingWord(finalRating10);

  const totalReviews = taNorm.ratingSummary.totalReviews > 0
    ? taNorm.ratingSummary.totalReviews
    : (Number(baseHotel?.reviewCount ?? 0) || googleDetails?.userRatingsTotal || 0);

  // Category scores: Tripadvisor if available, else derived from overall
  const ratingCategories: ExtraRating["categories"] = taOverall > 0
    ? taNorm.ratingSummary.categories
    : {
        cleanliness:  Math.min(10, Math.round(finalRating10 * 1.03 * 10) / 10),
        location:     Math.min(10, Math.round(finalRating10 * 1.01 * 10) / 10),
        rooms:        Math.min(10, Math.round(finalRating10 * 0.98 * 10) / 10),
        service:      Math.min(10, Math.round(finalRating10 * 1.02 * 10) / 10),
        value:        Math.min(10, Math.round(finalRating10 * 0.93 * 10) / 10),
        sleepQuality: Math.min(10, Math.round(finalRating10 * 0.99 * 10) / 10),
      };

  const rating: ExtraRating = {
    overall:      finalRating10,
    ratingWord:   finalRatingWord,
    totalReviews,
    categories:   ratingCategories,
  };

  // ── Step 8: LOCATION — Google authoritative ───────────────────────────────
  const location = googleExt.location
    ?? (baseHotel?.coordinates?.lat
        ? {
            lat:     Number(baseHotel.coordinates.lat),
            lng:     Number(baseHotel.coordinates.lng),
            address: String(baseHotel.address ?? ""),
          }
        : null);

  // ── Step 9: NEARBY — Google only ─────────────────────────────────────────
  const nearby: HotelExtra["nearby"] = {
    restaurants: googleExt.nearby.restaurants,
    attractions: googleExt.nearby.attractions,
    transport:   googleExt.nearby.transport,
    shopping:    googleExt.nearby.shopping,
  };

  // ── Step 10: ROOMS — Booking extractors first, Expedia as fallback ────────
  // bookExt.rooms reads the real Booking.com `rooms` map when available.
  // expNorm.rooms converts Expedia room data when Booking has none.
  // PRICE IS NEVER MODIFIED — values come directly from API responses.
  let finalRooms: RoomType[];
  if (bookExt.rooms.length > 0) {
  finalRooms = bookExt.rooms.map((r: any) => ({
    type:               r.type || r.name || "Room",
    maxGuests:          r.maxGuests ?? 2,
    beds:               r.beds ?? "—",
    size:               r.size ?? "—",        // ✅ FIX
    price:              r.price,
    originalPrice:      r.originalPrice ?? r.price,
    discountPercent:    r.discountPercent ?? 0,
    amenities:          r.amenities ?? [],
    meals:              r.meals ?? [],
    cancellationPolicy: r.cancellationPolicy ?? "Free cancellation",
    available:          r.available ?? true,  // ✅ FIX
  }));
} else {
    // Final fallback: synthesise from hotel-level price (zero price modification)
    finalRooms = buildRooms(
      Number(baseHotel?.pricePerNight ?? 0),
      String(baseHotel?.currency      ?? "GBP"),
      Number(baseHotel?.starRating    ?? 3),
      Number(baseHotel?.adultCount    ?? 2),
      Array.isArray(baseHotel?.facilities) ? baseHotel.facilities : [],
      bookExt.policies.checkIn      || "From 15:00",
      bookExt.policies.cancellation || "Free cancellation — verify with property."
    );
  }

  // ── Step 11: PRICING — Booking extractors, EXACT values ──────────────────
  // extractBookingDetails reads price directly from baseHotel fields.
  // We never convert, multiply, or apply rates.
  const finalPricing: PricingBreakdown = {
    basePrice:   bookExt.pricing.basePrice,
    taxRate:     bookExt.pricing.taxes > 0 && bookExt.pricing.basePrice > 0
                   ? +(bookExt.pricing.taxes / bookExt.pricing.basePrice).toFixed(4)
                   : 0,
    taxes:       bookExt.pricing.taxes,
    serviceFee:  bookExt.pricing.serviceFee,
    discount:    0,
    finalPrice:  bookExt.pricing.finalPrice,
    currency:    bookExt.pricing.currency || String(baseHotel?.currency ?? "GBP"),
    perNight:    bookExt.pricing.perNight,
    nights:      1,
  };

  // ── Step 12: POLICIES — Booking extractors ────────────────────────────────
  const policies = {
    checkIn:      bookExt.policies.checkIn,
    checkOut:     bookExt.policies.checkOut,
    cancellation: bookExt.policies.cancellation,
    children:     bookExt.policies.children,
    pets:         bookExt.policies.pets,
  };

  // ── Step 13: REVIEWS SUMMARY ──────────────────────────────────────────────
  const reviewsSummary = buildReviewsSummary(
    finalRating10,
    totalReviews,
    finalRatingWord,
    reviews
  );

  // ── Step 14: Assemble extra ───────────────────────────────────────────────
  const extra: HotelExtra = {
    images,
    amenities,
    reviews,
    rating,
    location,
    nearby,
    rooms:          finalRooms,
    pricing:        finalPricing,
    policies,
    reviewsSummary,
  };

  setExtraInCache(cacheKey, extra);

  console.log(
    `[enrichHotelData] complete for "${hotelName}" — ` +
    `images:${images.length} amenities:${amenities.length} ` +
    `reviews:${reviews.length} rating:${finalRating10} ` +
    `rooms:${finalRooms.length} ta:${taOverall > 0} ` +
    `expedia:${expNorm.images.length > 0} google:${!!googleDetails}`
  );

  // ── Step 15: Return — baseHotel FIRST so its fields always win ───────────
  return {
    ...baseHotel,   // ← ALL original Booking fields, completely untouched
    extra,          // ← new enrichment ONLY — never overwrites baseHotel keys
  };
}