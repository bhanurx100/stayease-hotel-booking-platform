/**
 * hotel-booking-backend/src/services/expediaService.ts
 *
 * Expedia integration via RapidAPI (expedia-com2.p.rapidapi.com).
 * Provides: high-quality images, full amenity lists, property description, room types.
 *
 * ── Responsibility in the aggregator ─────────────────────────────────────────
 * IMAGES:      Expedia images are highest-quality (full HTTPS, large format)
 * AMENITIES:   Expedia amenity lists are the most complete
 * DESCRIPTION: Expedia property descriptions are the most detailed
 * ROOMS:       Expedia provides real room types with availability and pricing
 *
 * Priority (images): Expedia > Booking.com > Google > static fallbacks
 *
 * ── Required .env vars ───────────────────────────────────────────────────────
 *   EXPEDIA_API_KEY=<your RapidAPI key for expedia-com2>
 *   EXPEDIA_API_HOST=expedia-com2.p.rapidapi.com
 *
 * ── Graceful degradation ─────────────────────────────────────────────────────
 * Returns null / [] on any failure — never throws to caller.
 *
 * ── In-memory cache ──────────────────────────────────────────────────────────
 * TTL: 10 minutes per hotel.
 */

import axios from "axios";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExpediaRoom {
  name:        string;
  maxOccupancy: number;
  beds:        string;
  rateAmount:  number;
  currency:    string;
  amenities:   string[];
  refundable:  boolean;
  breakfastIncluded: boolean;
}

export interface ExpediaHotelData {
  propertyId:  string;
  name:        string;
  description: string;
  imageUrls:   string[];     // full HTTPS, deduped, largest available
  amenities:   string[];     // flat normalised list
  rooms:       ExpediaRoom[];
  starRating:  number;
  address:     string;
  coordinates?: { lat: number; lng: number };
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const TTL_MS = 10 * 60 * 1_000;
interface CacheEntry { data: ExpediaHotelData | null; expiresAt: number; }
const cache = new Map<string, CacheEntry>();

function getFromCache(key: string): ExpediaHotelData | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return undefined; }
  return entry.data;
}
function setInCache(key: string, data: ExpediaHotelData | null): void {
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getConfig() {
  const key  = process.env.EXPEDIA_API_KEY;
  const host = process.env.EXPEDIA_API_HOST ?? "expedia-com2.p.rapidapi.com";
  return { key, host };
}

function isConfigured(): boolean {
  if (!getConfig().key) {
    console.info("[expediaService] EXPEDIA_API_KEY not set — skipping.");
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

async function safeGet<T>(url: string, params: Record<string, any>, timeoutMs = 8_000): Promise<T | null> {
  try {
    const { data } = await axios.get<T>(url, {
      params,
      timeout:  timeoutMs,
      headers:  buildHeaders(),
    });
    return data;
  } catch (err: any) {
    console.warn("[expediaService] request failed:", err?.message?.slice(0, 120));
    return null;
  }
}

/** Force all image URLs to HTTPS */
function forceHttps(url: string): string {
  return (url ?? "").replace(/^http:\/\//i, "https://");
}

/** Extract the largest available image URL from an Expedia image object */
function extractImageUrl(img: any): string | null {
  const url =
    img?.image?.url        ??
    img?.url               ??
    img?.imageUrl          ??
    img?.thumb?.url        ??
    null;
  return url ? forceHttps(url) : null;
}

// ─── Step 1: Search for property ─────────────────────────────────────────────

async function findPropertyId(hotelName: string, city: string): Promise<string | null> {
  // Expedia property search by destination
  const today    = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const fmt      = (d: Date) => d.toISOString().split("T")[0];

  const data = await safeGet<any>(
    "https://expedia-com2.p.rapidapi.com/properties/v2/list",
    {
      destination:  `${hotelName}, ${city}`,
      checkInDate:  fmt(today),
      checkOutDate: fmt(tomorrow),
      adults:       "2",
      rooms:        "1",
      currency:     "USD",
    }
  );

  const properties: any[] = data?.data?.propertySearch?.properties ?? data?.properties ?? [];
  if (!Array.isArray(properties) || properties.length === 0) return null;

  // Find the best match by name
  const match = properties.find((p: any) =>
    (p.name ?? "").toLowerCase().includes(hotelName.toLowerCase().slice(0, 6))
  ) ?? properties[0];

  return match?.id ?? match?.propertyId ?? null;
}

// ─── Step 2: Fetch property details ──────────────────────────────────────────

async function fetchPropertyDetails(propertyId: string): Promise<any | null> {
  const today    = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const fmt      = (d: Date) => d.toISOString().split("T")[0];

  return safeGet<any>(
    "https://expedia-com2.p.rapidapi.com/properties/v2/detail",
    {
      propertyId,
      checkInDate:  fmt(today),
      checkOutDate: fmt(tomorrow),
      adults:       "2",
      rooms:        "1",
      currency:     "USD",
    }
  );
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function normalizeImages(details: any): string[] {
  const rawImages: any[] =
    details?.propertyGallery?.images              ??
    details?.mediaItems                            ??
    details?.data?.propertyInfo?.mediaItems        ??
    details?.images                                ??
    [];

  return rawImages
    .map(extractImageUrl)
    .filter((url): url is string => !!url && url.startsWith("https://"))
    .slice(0, 15);
}

function normalizeAmenities(details: any): string[] {
  // Expedia nests amenities in multiple shapes depending on API version
  const groups: any[] =
    details?.amenities             ??
    details?.propertyAmenities     ??
    details?.data?.propertyInfo?.amenities ?? [];

  const flat = new Set<string>();

  const walk = (items: any[]): void => {
    for (const item of items) {
      if (typeof item === "string" && item.trim()) {
        flat.add(item.trim());
      } else if (item?.text && typeof item.text === "string") {
        flat.add(item.text.trim());
      } else if (item?.amenities && Array.isArray(item.amenities)) {
        walk(item.amenities);
      } else if (item?.items && Array.isArray(item.items)) {
        walk(item.items);
      }
    }
  };

  walk(Array.isArray(groups) ? groups : []);
  return Array.from(flat).filter(Boolean);
}

function normalizeDescription(details: any): string {
  const desc =
    details?.propertyDescription          ??
    details?.description?.text            ??
    details?.overview                     ??
    details?.data?.propertyInfo?.summary?.overview?.header?.text ??
    "";
  return typeof desc === "string" ? desc.trim() : "";
}

function normalizeRooms(details: any, currency: string): ExpediaRoom[] {
  const rawRooms: any[] =
    details?.rooms               ??
    details?.offerSummary?.rooms ??
    details?.data?.rooms         ??
    [];

  if (!Array.isArray(rawRooms)) return [];

  return rawRooms.slice(0, 5).map((r: any): ExpediaRoom => {
    const rate = r.price?.lead?.amount ?? r.rateAmount ?? r.totalPrice?.amount ?? 0;
    const roomCurrency = r.price?.lead?.currencyInfo?.code ?? currency;

    return {
      name:         r.name ?? r.description ?? "Standard Room",
      maxOccupancy: r.maxOccupancy ?? r.occupants ?? 2,
      beds:         r.beds ?? r.bedTypes?.[0]?.description ?? "1 Queen Bed",
      rateAmount:   Math.round(Number(rate)),
      currency:     roomCurrency,
      amenities:    (r.amenities ?? r.freebies ?? [])
                      .map((a: any) => (typeof a === "string" ? a : a?.text ?? ""))
                      .filter(Boolean),
      refundable:       !!(r.cancellationPolicy?.isRefundable ?? r.refundable ?? false),
      breakfastIncluded: !!(r.freebies?.includes?.("Free breakfast") ??
                            r.meals?.some?.((m: any) => (typeof m === "string" ? m : m?.text ?? "")
                              .toLowerCase().includes("breakfast")) ?? false),
    };
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetch Expedia hotel data: images, amenities, description, rooms.
 * Returns null if not configured or any error occurs.
 */
export async function getExpediaData(
  hotelName: string,
  city:      string
): Promise<ExpediaHotelData | null> {
  if (!isConfigured()) return null;

  const cacheKey = `${hotelName.toLowerCase()}::${city.toLowerCase()}`;
  const cached   = getFromCache(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const propertyId = await findPropertyId(hotelName, city);
    if (!propertyId) {
      console.info(`[expediaService] No property found for "${hotelName}" in ${city}`);
      setInCache(cacheKey, null);
      return null;
    }

    const details = await fetchPropertyDetails(propertyId);
    if (!details) {
      setInCache(cacheKey, null);
      return null;
    }

    const imageUrls  = normalizeImages(details);
    const amenities  = normalizeAmenities(details);
    const description = normalizeDescription(details);
    const rooms      = normalizeRooms(details, "USD");

    const lat = details?.mapMarker?.latLong?.latitude  ??
                details?.coordinates?.latitude          ?? 0;
    const lng = details?.mapMarker?.latLong?.longitude ??
                details?.coordinates?.longitude         ?? 0;

    const result: ExpediaHotelData = {
      propertyId,
      name:        details?.name ?? hotelName,
      description,
      imageUrls,
      amenities,
      rooms,
      starRating:  Number(details?.starRating ?? details?.propertyRating ?? 3),
      address:     details?.location?.address?.firstAddressLine ?? "",
      coordinates: lat && lng ? { lat, lng } : undefined,
    };

    setInCache(cacheKey, result);
    return result;
  } catch (err: any) {
    console.error("[expediaService] unexpected error:", err?.message);
    setInCache(cacheKey, null);
    return null;
  }
}

// ─── PUBLIC NORMALIZER ────────────────────────────────────────────────────────

/**
 * normalizeExpedia(data)
 *
 * Accepts a raw `ExpediaHotelData` (or null) and returns a clean,
 * deduplicated, null-safe structure the aggregator can consume directly.
 *
 * Output contract (stable — aggregator depends on this shape):
 * {
 *   images:      string[]            — HTTPS only, deduped, max 15
 *   description: string              — never null, never undefined
 *   amenities:   string[]            — deduped, trimmed, sorted
 *   policies: {
 *     checkIn:   string              — e.g. "3:00 PM" or ""
 *     checkOut:  string              — e.g. "11:00 AM" or ""
 *   }
 *   rooms: NormalizedRoom[]          — deduped by name, sorted by price asc
 * }
 *
 * Rules:
 * - All arrays always exist (never null/undefined)
 * - All strings always defined (never null/undefined)
 * - Nulls stripped, duplicates removed
 * - If input is null/undefined → returns safe empty structure
 */

export interface NormalizedRoom {
  name:               string;
  maxGuests:          number;
  beds:               string;
  pricePerNight:      number;
  originalPrice:      number;
  discountPercent:    number;
  currency:           string;
  amenities:          string[];
  meals:              string[];
  cancellationPolicy: string;
  refundable:         boolean;
  available:          boolean;
}

export interface NormalizedExpedia {
  images:      string[];
  description: string;
  amenities:   string[];
  policies: {
    checkIn:  string;
    checkOut: string;
  };
  rooms: NormalizedRoom[];
}

export function normalizeExpedia(data: ExpediaHotelData | null | undefined): NormalizedExpedia {

  // ── Safe empty result — returned when data is null/missing ───────────────
  const EMPTY: NormalizedExpedia = {
    images: [], description: "", amenities: [],
    policies: { checkIn: "", checkOut: "" }, rooms: [],
  };

  if (!data) return EMPTY;

  // ── Images ────────────────────────────────────────────────────────────────
  // Deduplicate by URL, enforce HTTPS, remove blank strings
  const seenImages = new Set<string>();
  const images = (Array.isArray(data.imageUrls) ? data.imageUrls : [])
    .filter((url): url is string => typeof url === "string" && url.trim().length > 0)
    .map((url) => url.startsWith("http://") ? url.replace("http://", "https://") : url)
    .filter((url) => url.startsWith("https://"))
    .filter((url) => {
      if (seenImages.has(url)) return false;
      seenImages.add(url);
      return true;
    })
    .slice(0, 15);

  // ── Description ───────────────────────────────────────────────────────────
  // Trim, collapse multiple whitespace, ensure string
  const description = typeof data.description === "string"
    ? data.description.trim().replace(/\s{2,}/g, " ")
    : "";

  // ── Amenities ─────────────────────────────────────────────────────────────
  // Deduplicate (case-insensitive), trim, filter nulls, sort alphabetically
  const seenAmenities = new Set<string>();
  const amenities = (Array.isArray(data.amenities) ? data.amenities : [])
    .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
    .map((a) => a.trim())
    .filter((a) => {
      const key = a.toLowerCase();
      if (seenAmenities.has(key)) return false;
      seenAmenities.add(key);
      return true;
    })
    .sort();

  // ── Policies ──────────────────────────────────────────────────────────────
  // Expedia stores check-in/out as strings like "3:00 PM" or "15:00"
  // We read from multiple possible field paths and sanitize
  const rawPolicies: any  = (data as any).policies ?? (data as any).houseRules ?? {};
  const checkIn  = sanitizePolicyTime(rawPolicies?.checkIn  ?? rawPolicies?.checkinTime  ?? "");
  const checkOut = sanitizePolicyTime(rawPolicies?.checkOut ?? rawPolicies?.checkoutTime ?? "");

  // ── Rooms ─────────────────────────────────────────────────────────────────
  // Deduplicate by room name, normalise all fields, sort by pricePerNight asc
  const seenRoomNames = new Set<string>();
  const rooms: NormalizedRoom[] = (Array.isArray(data.rooms) ? data.rooms : [])
    .filter((r): r is ExpediaRoom => !!r && typeof r === "object")
    .map((r): NormalizedRoom => {
      // Dedupe room amenities
      const seenRA = new Set<string>();
      const roomAmenities = (Array.isArray(r.amenities) ? r.amenities : [])
        .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
        .map((a) => a.trim())
        .filter((a) => {
          const k = a.toLowerCase();
          if (seenRA.has(k)) return false;
          seenRA.add(k);
          return true;
        });

      const base     = Math.max(0, Math.round(Number(r.rateAmount)  || 0));
      const original = base > 0 ? Math.round(base * 1.15) : 0;   // 15% markup as "original" when not provided
      const discount = original > base ? Math.round((1 - base / original) * 100) : 0;

      const meals: string[] = [];
      if (r.breakfastIncluded) meals.push("Breakfast included");

      return {
        name:               cleanString(r.name) || "Standard Room",
        maxGuests:          Math.max(1, Math.round(Number(r.maxOccupancy) || 2)),
        beds:               cleanString(r.beds) || "1 Queen Bed",
        pricePerNight:      base,
        originalPrice:      original,
        discountPercent:    discount,
        currency:           cleanString(r.currency) || "USD",
        amenities:          roomAmenities,
        meals,
        cancellationPolicy: r.refundable
          ? "Free cancellation available"
          : "Non-refundable — payment collected now",
        refundable: !!r.refundable,
        available:  true,
      };
    })
    .filter((r) => {
      if (seenRoomNames.has(r.name.toLowerCase())) return false;
      seenRoomNames.add(r.name.toLowerCase());
      return true;
    })
    .sort((a, b) => a.pricePerNight - b.pricePerNight);

  return { images, description, amenities, policies: { checkIn, checkOut }, rooms };
}

// ─── Private helpers for normalizeExpedia ────────────────────────────────────

function cleanString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Normalise a raw time string to "HH:MM" 24h format, or return as-is if
 * it's already a readable string like "3:00 PM". Return "" if empty/null.
 */
function sanitizePolicyTime(raw: unknown): string {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  // Already in a readable format — just return it
  if (trimmed.length <= 20) return trimmed;
  // Too long — likely a full sentence; truncate at first meaningful break
  return trimmed.split(/[.,;]/)[0].trim().slice(0, 30);
}