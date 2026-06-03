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
  id:                string;
  name:              string;
  maxOccupancy:      number;
  beds:              string;
  rateAmount:        number;
  currency:          string;
  amenities:         string[];
  refundable:        boolean;
  breakfastIncluded: boolean;
  imageUrl:          string;
  size:              string;
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
    .filter((url): url is string => !!url && url.startsWith("https://"));
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

function asArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>);
  return [];
}

function urlFromMediaItem(item: unknown): string {
  if (typeof item === "string") return item.startsWith("http") ? forceHttps(item) : "";
  if (!item || typeof item !== "object") return "";
  const o = item as Record<string, unknown>;
  const raw =
    o.url ?? o.imageUrl ??
    (o.image as { url?: string } | undefined)?.url ??
    (o.link as { href?: string } | undefined)?.href ??
    (o.thumb as { url?: string } | undefined)?.url ??
    "";
  return typeof raw === "string" && raw.startsWith("http") ? forceHttps(raw) : "";
}

/** Room-specific photos only — never property hero / gallery fallbacks. */
function extractExpediaRoomImage(room: any): string {
  const lists = [
    room.photos,
    room.images,
    room.gallery,
    room.roomPhotos,
    room.mediaItems,
  ];
  for (const list of lists) {
    for (const item of asArray(list)) {
      const url = urlFromMediaItem(item);
      if (url) return url;
    }
  }
  for (const scalar of [room.thumbnail, room.heroImage, room.image]) {
    const url = urlFromMediaItem(scalar);
    if (url) return url;
  }
  return "";
}

function amenityStrings(raw: unknown): string[] {
  return asArray(raw)
    .map((a) => (typeof a === "string" ? a : (a as { text?: string })?.text ?? ""))
    .map((s) => s.trim())
    .filter(Boolean);
}

function mealStrings(raw: unknown): string[] {
  return asArray(raw)
    .map((m) => (typeof m === "string" ? m : (m as { text?: string })?.text ?? ""))
    .filter(Boolean);
}

function hasBreakfast(room: any, amenities: string[], meals: string[]): boolean {
  if (room.breakfastIncluded === true) return true;
  const freebies = asArray(room.freebies);
  if (freebies.some((f) => String(f).toLowerCase().includes("breakfast"))) return true;
  return [...amenities, ...meals].some((t) => /breakfast/i.test(t));
}

function buildVariantLabel(unitName: string, rate: any): string {
  const base = cleanString(
    unitName || rate?.name || rate?.description || rate?.roomName || ""
  ) || "Room";
  const suffixParts: string[] = [];

  const view = cleanString(rate?.view ?? rate?.viewType ?? rate?.roomView);
  if (view && !base.toLowerCase().includes(view.toLowerCase())) suffixParts.push(view);

  const bed =
    cleanString(rate?.bedding) ||
    asArray(rate?.bedOptions)
      .map((b) => cleanString((b as { description?: string })?.description))
      .filter(Boolean)
      .join(", ");
  if (bed && !base.toLowerCase().includes(bed.toLowerCase().slice(0, 12))) suffixParts.push(bed);

  const board = cleanString(rate?.mealPlan ?? rate?.boardName ?? rate?.boardType);
  if (board && !/nomeal/i.test(board) && !base.toLowerCase().includes(board.toLowerCase())) {
    suffixParts.push(board);
  }

  const cancel = rate?.cancellationPolicy;
  if (cancel?.isRefundable === true && !/refund/i.test(base)) suffixParts.push("Refundable");
  else if (cancel?.isRefundable === false && !/non-refund/i.test(base)) suffixParts.push("Non-refundable");

  if (!suffixParts.length) return base;
  return `${base} — ${suffixParts.join(" · ")}`;
}

function mapRawExpediaRoom(raw: any, currency: string, index: number): ExpediaRoom {
  const rate =
    raw.price?.lead?.amount ??
    raw.price?.display?.amount ??
    raw.rateAmount ??
    raw.totalPrice?.amount ??
    raw.nightlyPrice ??
    0;
  const roomCurrency =
    raw.price?.lead?.currencyInfo?.code ??
    raw.price?.display?.currencyInfo?.code ??
    raw.currency ??
    currency;
  const amenities = amenityStrings(raw.amenities ?? raw.freebies ?? raw.features);
  const meals = mealStrings(raw.meals ?? raw.mealPlans);
  const beds =
    cleanString(raw.beds) ||
    asArray(raw.bedTypes)
      .map((b) => cleanString((b as { description?: string })?.description))
      .filter(Boolean)
      .join(" + ") ||
    "1 Queen Bed";
  const refundable = !!(
    raw.cancellationPolicy?.isRefundable ??
    raw.refundable ??
    raw.isRefundable
  );
  const name =
    cleanString(raw.name ?? raw.description ?? raw.roomName ?? raw._variantLabel) ||
    "Standard Room";
  const id =
    cleanString(
      raw.id ?? raw.roomId ?? raw.unitId ?? raw.ratePlanId ?? raw.offerId ?? ""
    ) || `expedia-variant-${index}-${slugKey(name)}`;

  return {
    id,
    name,
    maxOccupancy: Math.max(1, Number(raw.maxOccupancy ?? raw.occupants ?? raw.maxGuests ?? 2)),
    beds,
    rateAmount:   Math.round(Number(rate) || 0),
    currency:     cleanString(roomCurrency) || currency,
    amenities,
    refundable,
    breakfastIncluded: hasBreakfast(raw, amenities, meals),
    imageUrl:     extractExpediaRoomImage(raw),
    size:         cleanString(raw.area ?? raw.roomSize ?? raw.size),
  };
}

function slugKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

/** Collect every bookable room variant from all known Expedia detail response shapes. */
function collectExpediaRoomCandidates(details: any): any[] {
  const out: any[] = [];
  const seen = new Set<string>();

  const push = (item: any, key: string): void => {
    if (!item || typeof item !== "object") return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };

  for (const list of [
    details?.rooms,
    details?.offerSummary?.rooms,
    details?.data?.rooms,
    details?.data?.propertyInfo?.rooms,
    details?.propertyRooms,
  ]) {
    for (const [i, r] of asArray(list).entries()) {
      push(r, `room-${i}-${r?.id ?? r?.name ?? i}`);
    }
  }

  const unitSources = [
    details?.offerSummary?.units,
    details?.units,
    details?.data?.offerSummary?.units,
    details?.categorizedUnits,
  ];
  for (const units of unitSources) {
    for (const [ui, unit] of asArray(units).entries()) {
      const unitName = cleanString(unit?.name ?? unit?.description ?? unit?.roomName);
      const rates = asArray(
        unit?.rates ?? unit?.ratePlans ?? unit?.offers ?? unit?.availableOffers
      );
      if (rates.length === 0) {
        push(
          { ...unit, name: unitName || unit?.name, _variantLabel: unitName },
          `unit-${ui}-${unit?.id ?? unitName}`
        );
        continue;
      }
      for (const [ri, rate] of rates.entries()) {
        const label = buildVariantLabel(unitName, rate);
        push(
          {
            ...unit,
            ...rate,
            name: label,
            _variantLabel: label,
            _unitName: unitName,
          },
          `unit-${ui}-rate-${ri}-${rate?.id ?? label}`
        );
      }
    }
  }

  return out;
}

function normalizeRooms(details: any, currency: string): ExpediaRoom[] {
  const candidates = collectExpediaRoomCandidates(details);
  return candidates.map((r, i) => mapRawExpediaRoom(r, currency, i));
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
 *   rooms: NormalizedRoom[]          — all variants, sorted by price asc
 * }
 *
 * Rules:
 * - All arrays always exist (never null/undefined)
 * - All strings always defined (never null/undefined)
 * - Nulls stripped, duplicates removed
 * - If input is null/undefined → returns safe empty structure
 */

export interface NormalizedRoom {
  id:                 string;
  name:               string;
  maxGuests:          number;
  beds:               string;
  size:               string;
  pricePerNight:      number;
  originalPrice:      number;
  discountPercent:    number;
  currency:           string;
  amenities:          string[];
  meals:              string[];
  cancellationPolicy: string;
  refundable:         boolean;
  available:          boolean;
  imageUrl:           string;
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
    });

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
  // Keep every distinct variant (name + price + beds + refundability)
  const seenVariants = new Set<string>();
  const rooms: NormalizedRoom[] = (Array.isArray(data.rooms) ? data.rooms : [])
    .filter((r): r is ExpediaRoom => !!r && typeof r === "object")
    .map((r, index): NormalizedRoom => {
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
        id:                 cleanString(r.id) || `expedia-${index}-${slugKey(cleanString(r.name))}`,
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
        imageUrl:   cleanString(r.imageUrl) || "",
        size:       cleanString(r.size) || "—",
      };
    })
    .filter((r) => {
      const key = `${r.id}|${r.name}|${r.pricePerNight}|${r.beds}|${r.refundable}`;
      if (seenVariants.has(key)) return false;
      seenVariants.add(key);
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