/**
 * hotel-booking-backend/src/services/googlePlacesService.ts
 *
 * Google Places API v1 (new) integration.
 * Provides: place search, place details (reviews, rating, photos),
 *           and nearby places (restaurants, attractions, transport).
 *
 * ── Required .env vars ───────────────────────────────────────────────────────
 *   GOOGLE_PLACES_API_KEY=<your key>
 *   (same key as Google Maps — just add Places API in Google Cloud console)
 *
 * ── Caching ──────────────────────────────────────────────────────────────────
 * In-memory TTL cache (5 min) to avoid repeated API calls for the same hotel.
 * Cache key: `${hotelName}::${city}` for search, `${placeId}` for details.
 *
 * ── Graceful degradation ─────────────────────────────────────────────────────
 * Every function returns null / [] on failure — the aggregator handles fallback.
 * No function throws to the caller.
 */

import axios from "axios";

const PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place";
const NEARBY_SEARCH   = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
const PLACE_DETAILS   = "https://maps.googleapis.com/maps/api/place/details/json";
const PLACE_FIND      = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoogleReview {
  reviewer:  string;
  rating:    number;     // 1–5 Google scale
  text:      string;
  time:      string;     // ISO date string
  language?: string;
}

export interface GooglePhoto {
  url:          string;
  width:        number;
  height:       number;
  attribution?: string;
}

export interface NearbyPlace {
  name:        string;
  type:        string;   // "restaurant" | "attraction" | "transport" | "landmark"
  vicinity:    string;
  rating?:     number;
  distance?:   string;
  placeId:     string;
  icon?:       string;
}

export interface GooglePlaceDetails {
  placeId:       string;
  name:          string;
  formattedAddress: string;
  rating:        number;   // 1–5
  userRatingsTotal: number;
  reviews:       GoogleReview[];
  photos:        GooglePhoto[];
  coordinates:   { lat: number; lng: number };
  phone?:        string;
  website?:      string;
  openingHours?: string[];
  types:         string[];
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

const TTL_MS = 5 * 60 * 1_000; // 5 minutes

interface CacheEntry<T> {
  data:      T;
  expiresAt: number;
}

const placeIdCache   = new Map<string, CacheEntry<string | null>>();
const detailsCache   = new Map<string, CacheEntry<GooglePlaceDetails | null>>();
const nearbyCache    = new Map<string, CacheEntry<NearbyPlace[]>>();

function getFromCache<T>(map: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = map.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { map.delete(key); return undefined; }
  return entry.data;
}

function setInCache<T>(map: Map<string, CacheEntry<T>>, key: string, data: T): void {
  map.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function apiKey(): string {
  return process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? "";
}

function apiKeyPresent(): boolean {
  if (!apiKey()) {
    console.warn("[googlePlacesService] GOOGLE_PLACES_API_KEY not set — Google enrichment disabled.");
    return false;
  }
  return true;
}

/** Build a Google Maps Static image URL for photos (no client-side JS required). */
function buildPhotoUrl(photoReference: string, maxWidth = 800): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${apiKey()}`;
}

/** Safe axios GET with timeout */
async function safeGet<T>(url: string, params: Record<string, string>, timeoutMs = 8_000): Promise<T | null> {
  try {
    const { data } = await axios.get<T>(url, { params, timeout: timeoutMs });
    return data;
  } catch (err: any) {
    console.warn("[googlePlacesService] request failed:", err?.message?.slice(0, 120));
    return null;
  }
}

// ─── Step 1: Find Place ID ────────────────────────────────────────────────────

/**
 * Find the Google Place ID for a hotel given its name and city.
 * Uses findplacefromtext — most reliable for named establishments.
 */
export async function findPlaceId(hotelName: string, city: string): Promise<string | null> {
  if (!apiKeyPresent()) return null;

  const cacheKey = `${hotelName.toLowerCase()}::${city.toLowerCase()}`;
  const cached   = getFromCache(placeIdCache, cacheKey);
  if (cached !== undefined) return cached;

  const data = await safeGet<any>(PLACE_FIND, {
    input:          `${hotelName} hotel ${city}`,
    inputtype:      "textquery",
    fields:         "place_id,name,geometry",
    key:            apiKey(),
  });

  const placeId = data?.candidates?.[0]?.place_id ?? null;
  setInCache(placeIdCache, cacheKey, placeId);
  return placeId;
}

// ─── Step 2: Place Details ────────────────────────────────────────────────────

/**
 * Fetch full place details from Google Places API.
 * Returns reviews, photos, rating, coordinates, phone, website.
 */
export async function getPlaceDetails(placeId: string): Promise<GooglePlaceDetails | null> {
  if (!apiKeyPresent() || !placeId) return null;

  const cached = getFromCache(detailsCache, placeId);
  if (cached !== undefined) return cached;

  const data = await safeGet<any>(PLACE_DETAILS, {
    place_id: placeId,
    fields:   [
      "place_id", "name", "formatted_address", "rating",
      "user_ratings_total", "reviews", "photos", "geometry",
      "international_phone_number", "website", "opening_hours", "types",
    ].join(","),
    language: "en",
    key:      apiKey(),
  });

  if (!data?.result) {
    setInCache(detailsCache, placeId, null);
    return null;
  }

  const r = data.result;
  const photos: GooglePhoto[] = (r.photos ?? []).slice(0, 15).map((p: any) => ({
    url:         buildPhotoUrl(p.photo_reference),
    width:       p.width,
    height:      p.height,
    attribution: p.html_attributions?.[0] ?? "",
  }));

  const reviews: GoogleReview[] = (r.reviews ?? []).slice(0, 10).map((rev: any) => ({
    reviewer: rev.author_name ?? "Guest",
    rating:   rev.rating ?? 0,
    text:     rev.text ?? "",
    time:     new Date((rev.time ?? 0) * 1000).toISOString(),
    language: rev.language,
  }));

  const result: GooglePlaceDetails = {
    placeId:          r.place_id,
    name:             r.name,
    formattedAddress: r.formatted_address ?? "",
    rating:           r.rating ?? 0,
    userRatingsTotal: r.user_ratings_total ?? 0,
    reviews,
    photos,
    coordinates:      {
      lat: r.geometry?.location?.lat ?? 0,
      lng: r.geometry?.location?.lng ?? 0,
    },
    phone:   r.international_phone_number,
    website: r.website,
    openingHours: r.opening_hours?.weekday_text ?? [],
    types:   r.types ?? [],
  };

  setInCache(detailsCache, placeId, result);
  return result;
}

// ─── Step 3: Nearby Places ────────────────────────────────────────────────────

const NEARBY_CATEGORIES: Array<{
  type:  string;
  label: string;
  radius: number;
}> = [
  { type: "restaurant",        label: "restaurant",   radius: 500  },
  { type: "tourist_attraction", label: "attraction",   radius: 2000 },
  { type: "subway_station",    label: "transport",    radius: 1000 },
  { type: "shopping_mall",     label: "shopping",     radius: 1000 },
];

/**
 * Fetch nearby places for each category in parallel.
 * Returns a flat array of NearbyPlace with type label.
 */
export async function getNearbyPlaces(
  lat: number,
  lng: number
): Promise<NearbyPlace[]> {
  if (!apiKeyPresent() || !lat || !lng) return [];

  const cacheKey = `nearby::${lat.toFixed(4)}::${lng.toFixed(4)}`;
  const cached   = getFromCache(nearbyCache, cacheKey);
  if (cached !== undefined) return cached;

  const results = await Promise.allSettled(
    NEARBY_CATEGORIES.map(({ type, label, radius }) =>
      safeGet<any>(NEARBY_SEARCH, {
        location: `${lat},${lng}`,
        radius:   String(radius),
        type,
        key:      apiKey(),
      }).then((data) =>
        (data?.results ?? []).slice(0, 5).map((p: any): NearbyPlace => ({
          name:     p.name,
          type:     label,
          vicinity: p.vicinity ?? "",
          rating:   p.rating,
          placeId:  p.place_id,
          icon:     p.icon,
        }))
      )
    )
  );

  const all: NearbyPlace[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  setInCache(nearbyCache, cacheKey, all);
  return all;
}

// ─── Composite: find + detail in one call ─────────────────────────────────────

/**
 * Convenience function: find place ID then fetch full details.
 * Returns null gracefully if either step fails.
 */
export async function getGoogleHotelDetails(
  hotelName: string,
  city:       string
): Promise<GooglePlaceDetails | null> {
  const placeId = await findPlaceId(hotelName, city);
  if (!placeId) return null;
  return getPlaceDetails(placeId);
}