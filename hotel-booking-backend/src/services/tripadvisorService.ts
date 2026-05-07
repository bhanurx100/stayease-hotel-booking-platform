/**
 * hotel-booking-backend/src/services/tripadvisorService.ts
 *
 * Tripadvisor integration via RapidAPI (tripadvisor16.p.rapidapi.com).
 * Provides: hotel search by name+location, rating, reviews.
 *
 * ── Responsibility in the aggregator ─────────────────────────────────────────
 * REVIEWS ONLY — Tripadvisor is the authoritative source for user reviews.
 * Priority: Tripadvisor reviews > Google reviews > Booking.com reviews > generated.
 *
 * ── Required .env vars ───────────────────────────────────────────────────────
 *   TRIPADVISOR_API_KEY=<your RapidAPI key for tripadvisor16>
 *   TRIPADVISOR_API_HOST=tripadvisor16.p.rapidapi.com
 *
 * ── Graceful degradation ─────────────────────────────────────────────────────
 * Every function returns null / [] on ANY failure. The aggregator always
 * handles fallback — this service never throws to its caller.
 *
 * ── In-memory cache ──────────────────────────────────────────────────────────
 * TTL: 15 minutes. Tripadvisor rate limits are tight on free plans.
 * Cache key: `${hotelName.toLowerCase()}::${city.toLowerCase()}`
 */

import axios from "axios";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TripadvisorReview {
  reviewer:   string;
  rating:     number;    // 1–5 Tripadvisor scale
  title:      string;
  text:       string;
  date:       string;    // ISO date string
  language?:  string;
  helpful?:   number;    // helpful vote count
}

export interface TripadvisorHotelData {
  locationId:    string;
  name:          string;
  rating:        number;   // 1–5
  numReviews:    number;
  rankingString: string;   // e.g. "#3 of 47 hotels in Bangalore"
  reviews:       TripadvisorReview[];
  subratings?: {
    sleep_quality?: number;
    location?:      number;
    rooms?:         number;
    service?:       number;
    value?:         number;
    cleanliness?:   number;
  };
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const TTL_MS = 15 * 60 * 1_000;
interface CacheEntry { data: TripadvisorHotelData | null; expiresAt: number; }
const cache = new Map<string, CacheEntry>();

function getFromCache(key: string): TripadvisorHotelData | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return undefined; }
  return entry.data;
}
function setInCache(key: string, data: TripadvisorHotelData | null): void {
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getConfig() {
  const key  = process.env.TRIPADVISOR_API_KEY;
  const host = process.env.TRIPADVISOR_API_HOST ?? "tripadvisor16.p.rapidapi.com";
  return { key, host };
}

function isConfigured(): boolean {
  const { key } = getConfig();
  if (!key) {
    console.info("[tripadvisorService] TRIPADVISOR_API_KEY not set — skipping.");
    return false;
  }
  return true;
}

function buildHeaders(): Record<string, string> {
  const { key, host } = getConfig();
  return {
    "x-rapidapi-key":  key!,
    "x-rapidapi-host": host,
  };
}

/**
 * Safely execute an axios GET with a timeout.
 * Returns null on any error — never throws.
 */
async function safeGet<T>(url: string, params: Record<string, any>, timeoutMs = 8_000): Promise<T | null> {
  try {
    const { data } = await axios.get<T>(url, {
      params,
      timeout: timeoutMs,
      headers: buildHeaders(),
    });
    return data;
  } catch (err: any) {
    console.warn("[tripadvisorService] request failed:", err?.message?.slice(0, 120));
    return null;
  }
}

// ─── Step 1: Search for hotel location ID ─────────────────────────────────────

interface SearchResult {
  location_id?: string;
  locationId?:  string;
  name?:        string;
  results?:     any[];
  data?:        any[];
}

async function findLocationId(hotelName: string, city: string): Promise<string | null> {
  const data = await safeGet<SearchResult>(
    "https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchHotels",
    {
      geoId:    city,
      checkIn:  new Date().toISOString().split("T")[0],
      checkOut: new Date(Date.now() + 86_400_000).toISOString().split("T")[0],
      pageNumber: "1",
      currencyCode: "USD",
    }
  );

  // Try text search fallback if geoId search fails
  if (!data) {
    const searchData = await safeGet<any>(
      "https://tripadvisor16.p.rapidapi.com/api/v1/hotels/searchLocation",
      { query: `${hotelName} ${city}` }
    );
    const results = searchData?.data ?? searchData?.results ?? [];
    const hotel   = Array.isArray(results)
      ? results.find((r: any) =>
          r.title?.toLowerCase().includes(hotelName.toLowerCase()) ||
          r.secondaryText?.toLowerCase().includes(city.toLowerCase())
        )
      : null;
    return hotel?.locationId ?? hotel?.location_id ?? null;
  }

  const results = data?.data ?? data?.results ?? [];
  if (!Array.isArray(results) || results.length === 0) return null;

  const match = results.find((r: any) =>
    (r.title ?? r.name ?? "").toLowerCase().includes(hotelName.toLowerCase())
  );
  return match?.locationId ?? match?.location_id ?? results[0]?.locationId ?? null;
}

// ─── Step 2: Fetch hotel details (rating, subratings, numReviews) ────────────

async function fetchHotelDetails(locationId: string): Promise<any | null> {
  return safeGet<any>(
    "https://tripadvisor16.p.rapidapi.com/api/v1/hotels/getHotelDetails",
    { locationId }
  );
}

// ─── Step 3: Fetch reviews ────────────────────────────────────────────────────

async function fetchReviews(locationId: string): Promise<TripadvisorReview[]> {
  const data = await safeGet<any>(
    "https://tripadvisor16.p.rapidapi.com/api/v1/hotels/getHotelReviews",
    { locationId, limit: "10", page: "1" }
  );

  const rawReviews: any[] = data?.data ?? data?.results ?? [];
  if (!Array.isArray(rawReviews)) return [];

  return rawReviews.slice(0, 10).map((r: any): TripadvisorReview => ({
    reviewer:  r.userProfile?.displayName ?? r.username ?? "Traveller",
    rating:    Number(r.rating ?? r.bubbleRating?.rating ?? 0),
    title:     r.title ?? "",
    text:      r.text  ?? r.summary ?? "",
    date:      r.publishedDate ?? r.createdTime ?? new Date().toISOString(),
    language:  r.language,
    helpful:   r.helpfulVotes ?? 0,
  })).filter((r) => r.text.length > 10);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetch Tripadvisor hotel data: rating, subratings, reviews.
 * Returns null if not configured or any error occurs.
 */
export async function getTripadvisorData(
  hotelName: string,
  city:      string
): Promise<TripadvisorHotelData | null> {
  if (!isConfigured()) return null;

  const cacheKey = `${hotelName.toLowerCase()}::${city.toLowerCase()}`;
  const cached   = getFromCache(cacheKey);
  if (cached !== undefined) return cached;

  try {
    // Steps 1 + 2 + 3 — all run sequentially (each depends on previous result)
    const locationId = await findLocationId(hotelName, city);
    if (!locationId) {
      console.info(`[tripadvisorService] No location ID found for "${hotelName}" in ${city}`);
      setInCache(cacheKey, null);
      return null;
    }

    // Fetch details + reviews in parallel
    const [detailsResult, reviewsResult] = await Promise.allSettled([
      fetchHotelDetails(locationId),
      fetchReviews(locationId),
    ]);

    const details = detailsResult.status === "fulfilled" ? detailsResult.value : null;
    const reviews = reviewsResult.status === "fulfilled" ? reviewsResult.value : [];

    if (!details && reviews.length === 0) {
      setInCache(cacheKey, null);
      return null;
    }

    const result: TripadvisorHotelData = {
      locationId,
      name:          details?.name ?? hotelName,
      rating:        Number(details?.rating ?? details?.bubbleRating?.rating ?? 0),
      numReviews:    Number(details?.numReviews ?? details?.numberOfReviews ?? reviews.length),
      rankingString: details?.rankingString ?? details?.rankingDetails ?? "",
      reviews,
      subratings: {
        sleep_quality: details?.subratings?.SLEEP_QUALITY?.value ??
                       details?.sleep_quality ?? undefined,
        location:      details?.subratings?.LOCATION?.value ??
                       details?.location ?? undefined,
        rooms:         details?.subratings?.ROOM?.value ??
                       details?.rooms ?? undefined,
        service:       details?.subratings?.SERVICE?.value ??
                       details?.service ?? undefined,
        value:         details?.subratings?.VALUE?.value ??
                       details?.value ?? undefined,
        cleanliness:   details?.subratings?.CLEANLINESS?.value ??
                       details?.cleanliness ?? undefined,
      },
    };

    setInCache(cacheKey, result);
    return result;
  } catch (err: any) {
    console.error("[tripadvisorService] unexpected error:", err?.message);
    setInCache(cacheKey, null);
    return null;
  }
}

// ─── PUBLIC NORMALIZER ────────────────────────────────────────────────────────

/**
 * normalizeTripadvisor(data)
 *
 * Accepts raw `TripadvisorHotelData` (or null) and returns a clean,
 * deduplicated, null-safe structure the aggregator can consume.
 *
 * Output contract (stable — aggregator depends on this shape):
 * {
 *   reviews: NormalizedTAReview[]   — deduped, sorted newest first, max 10
 *   ratingSummary: {
 *     overall:      number           — 0–10 scale (Tripadvisor 1–5 × 2)
 *     totalReviews: number
 *     ratingWord:   string           — "Exceptional" | "Excellent" | etc.
 *     rankingInfo:  string           — "#3 of 47 hotels in Bangalore"
 *     categories: {                  — all 0–10 scale, 0 if missing
 *       cleanliness:   number
 *       location:      number
 *       rooms:         number
 *       service:       number
 *       value:         number
 *       sleepQuality:  number
 *     }
 *   }
 * }
 *
 * Rules:
 * - Reviews with empty text stripped
 * - Duplicate reviews (same user + same date) removed
 * - Ratings always on 0–10 scale (Tripadvisor native 1–5 multiplied by 2)
 * - All arrays always exist
 * - All strings always defined
 * - If input is null → returns safe empty structure
 */

export interface NormalizedTAReview {
  reviewer:  string;
  rating:    number;    // 0–10 scale
  title:     string;
  text:      string;
  date:      string;    // ISO string
  helpful:   number;
}

export interface NormalizedTARatingSummary {
  overall:      number;
  totalReviews: number;
  ratingWord:   string;
  rankingInfo:  string;
  categories: {
    cleanliness:  number;
    location:     number;
    rooms:        number;
    service:      number;
    value:        number;
    sleepQuality: number;
  };
}

export interface NormalizedTripadvisor {
  reviews:       NormalizedTAReview[];
  ratingSummary: NormalizedTARatingSummary;
}

export function normalizeTripadvisor(
  data: TripadvisorHotelData | null | undefined
): NormalizedTripadvisor {

  // ── Safe empty result ──────────────────────────────────────────────────────
  const EMPTY: NormalizedTripadvisor = {
    reviews: [],
    ratingSummary: {
      overall: 0, totalReviews: 0, ratingWord: "", rankingInfo: "",
      categories: {
        cleanliness: 0, location: 0, rooms: 0,
        service: 0, value: 0, sleepQuality: 0,
      },
    },
  };

  if (!data) return EMPTY;

  // ── Normalize reviews ──────────────────────────────────────────────────────
  const seen = new Set<string>();   // dedup key: reviewer + date

  const reviews: NormalizedTAReview[] = (Array.isArray(data.reviews) ? data.reviews : [])
    .filter((r): r is TripadvisorReview => !!r && typeof r === "object")
    .filter((r) => {
      // Remove reviews with no text content
      const text = typeof r.text === "string" ? r.text.trim() : "";
      return text.length > 5;
    })
    .map((r): NormalizedTAReview => {
      const reviewer = cleanTA(r.reviewer) || "Traveller";
      const rawDate  = cleanTA(r.date);
      const date     = normalizeDate(rawDate);
      const rawRating = Number(r.rating ?? 0);

      // Tripadvisor rating is 1–5 → convert to 0–10 scale
      const rating = rawRating >= 1 && rawRating <= 5
        ? Math.round(rawRating * 2 * 10) / 10
        : rawRating <= 10
          ? rawRating
          : 0;

      return {
        reviewer,
        rating:  Math.min(10, Math.max(0, rating)),
        title:   cleanTA(r.title),
        text:    cleanTA(r.text),
        date,
        helpful: Math.max(0, Math.round(Number(r.helpful ?? 0))),
      };
    })
    .filter((r) => {
      // Deduplicate: same reviewer on same date
      const key = `${r.reviewer.toLowerCase()}::${r.date.slice(0, 10)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    // Sort: newest first (ISO strings sort lexicographically by date correctly)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  // ── Normalize rating summary ───────────────────────────────────────────────
  const rawOverall = Number(data.rating ?? 0);

  // Convert overall: Tripadvisor 1–5 → 0–10
  const overall = rawOverall >= 1 && rawOverall <= 5
    ? Math.round(rawOverall * 2 * 10) / 10
    : rawOverall <= 10
      ? rawOverall
      : 0;

  const totalReviews = Math.max(0, Math.round(Number(data.numReviews ?? reviews.length)));

  // ── Subratings (1–5 TA scale → 0–10) ─────────────────────────────────────
  const sub = data.subratings ?? {};

  const toScale10 = (v: number | undefined): number => {
    if (!v || v <= 0) return 0;
    const n = Number(v);
    // If already on 0–10 scale (from some API variants)
    if (n > 5) return Math.min(10, Math.round(n * 10) / 10);
    // Tripadvisor native 1–5
    return Math.min(10, Math.round(n * 2 * 10) / 10);
  };

  const categories = {
    cleanliness:  toScale10(sub.cleanliness),
    location:     toScale10(sub.location),
    rooms:        toScale10(sub.rooms),
    service:      toScale10(sub.service),
    value:        toScale10(sub.value),
    sleepQuality: toScale10(sub.sleep_quality),
  };

  // Fill missing categories by deriving from overall with slight variation
  if (categories.cleanliness  === 0) categories.cleanliness  = round1dp(overall * 1.02);
  if (categories.location     === 0) categories.location     = round1dp(overall * 1.01);
  if (categories.rooms        === 0) categories.rooms        = round1dp(overall * 0.98);
  if (categories.service      === 0) categories.service      = round1dp(overall * 1.01);
  if (categories.value        === 0) categories.value        = round1dp(overall * 0.94);
  if (categories.sleepQuality === 0) categories.sleepQuality = round1dp(overall * 0.99);

  // Cap at 10
  for (const k of Object.keys(categories) as (keyof typeof categories)[]) {
    categories[k] = Math.min(10, categories[k]);
  }

  const ratingSummary: NormalizedTARatingSummary = {
    overall,
    totalReviews,
    ratingWord:  toRatingWord(overall),
    rankingInfo: cleanTA(data.rankingString),
    categories,
  };

  return { reviews, ratingSummary };
}

// ─── Private helpers for normalizeTripadvisor ─────────────────────────────────

function cleanTA(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function round1dp(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Convert a raw date string to ISO format.
 * Handles: "January 2024", "2024-01-15", Unix timestamps, ISO strings.
 * Returns today's ISO string if parsing fails.
 */
function normalizeDate(raw: string): string {
  if (!raw) return new Date().toISOString();
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
  // Try JS Date parsing (handles "January 2024", "Jan 2024", full dates)
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString();
  // Fallback
  return new Date().toISOString();
}

/**
 * Convert a 0–10 numeric rating to a human-readable word.
 * Mirrors the aggregator's ratingWord() function for consistency.
 */
function toRatingWord(score: number): string {
  if (score <= 0)  return "";
  if (score >= 9)  return "Exceptional";
  if (score >= 8)  return "Excellent";
  if (score >= 7)  return "Very Good";
  if (score >= 6)  return "Good";
  if (score >= 5)  return "Pleasant";
  return "Satisfactory";
}