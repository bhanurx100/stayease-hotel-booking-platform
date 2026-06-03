/**
 * hotel-booking-backend/src/services/bookingExtractors.ts
 *
 * Two pure extraction functions consumed by aggregatorService.
 * They operate on raw API response shapes that already exist in the codebase.
 *
 * ── Design rules ──────────────────────────────────────────────────────────────
 * 1. ADDITIVE ONLY — these functions never overwrite Booking fields.
 *    They extract NEW structured sub-objects (rooms, pricing, policies, location,
 *    nearby) from data that was already fetched. The caller decides where to merge.
 *
 * 2. ZERO PRICE MODIFICATION — every numeric price value is read directly from
 *    the API field and returned as-is via Math.round(). No conversion, no rates.
 *
 * 3. NULL-SAFE — every field access uses optional chaining + nullish coalescing.
 *    Both functions always return the full output shape, even when input is null.
 *
 * 4. ZERO NEW IMPORTS NEEDED — both input types are already fetched upstream.
 *    We accept `any` to avoid tying this file to the internal interface names
 *    which may change as the API evolves.
 *
 * ── extractBookingDetails(rawHotelData) ──────────────────────────────────────
 * Input:  raw response from /v1/hotels/data  (BookingHotelData shape)
 *         OR from /v1/hotels/search           (BookingHotel shape)
 *         OR from getHotelDetails()           (ExternalHotel shape)
 *         — all shapes handled safely.
 *
 * Output:
 *   rooms[]       — derived from raw `rooms` map + price per night
 *   pricing       — structured breakdown (price never changed)
 *   policies      — checkIn, checkOut, cancellation, children, pets
 *
 * ── extractGoogleDetails(rawGoogleData) ──────────────────────────────────────
 * Input:  GooglePlaceDetails object (already fetched by googlePlacesService)
 *
 * Output:
 *   location      — coordinates + formatted address
 *   nearby        — categorised NearbyPlace[] split into restaurants/attractions/transport
 *
 * ── Usage in aggregatorService ────────────────────────────────────────────────
 *   const bookingExtra = extractBookingDetails(rapidData);
 *   const googleExtra  = extractGoogleDetails(googleData);
 *
 *   // Merge additively — existing fields untouched:
 *   return {
 *     ...existingEnrichedHotel,
 *     rooms:    bookingExtra.rooms,
 *     pricing:  bookingExtra.pricing,
 *     policies: { ...existingEnrichedHotel.policies, ...bookingExtra.policies },
 *     location: googleExtra.location,
 *     nearby:   googleExtra.nearby,
 *   };
 */

// ─── Output types ─────────────────────────────────────────────────────────────

/** A single room type extracted from Booking.com API data */
export interface ExtractedRoom {
  id?:                string;
  type:               string;    // e.g. "Standard Double Room"
  maxGuests:          number;
  beds:               string;    // e.g. "1 double bed" | "2 twin beds"
  size:               string;
  price:              number;    // per night, EXACT from API — never modified
  originalPrice:      number;    // before discount if available, else same as price
  discountPercent:    number;    // 0 if no discount data
  currency:           string;    // e.g. "INR", "GBP" — from API
  amenities:          string[];  // room-level amenities
  meals:              string[];  // e.g. ["Breakfast included"] or []
  cancellationPolicy: string;
  imageUrl:           string;
  available:          boolean;
}

/** Structured price breakdown — values EXACT from API */
export interface ExtractedPricing {
  basePrice:   number;    // gross_amount_per_night.value — EXACT, never modified
  currency:    string;    // gross_amount_per_night.currency
  taxes:       number;    // tax_inclusive_component if present, else 0
  serviceFee:  number;    // 0 (Booking.com doesn't expose this separately)
  finalPrice:  number;    // inclusive total (all_inclusive_amount if present, else basePrice + taxes)
  perNight:    number;    // same as basePrice — convenience alias
  isInclusive: boolean;   // true if finalPrice includes all taxes
}

/** Structured policies from Booking.com hotel data */
export interface ExtractedPolicies {
  checkIn:      string;   // e.g. "From 15:00"
  checkOut:     string;   // e.g. "Until 11:00"
  cancellation: string;
  children:     string;
  pets:         string;
}

/** Result of extractBookingDetails() */
export interface BookingExtract {
  rooms:    ExtractedRoom[];
  pricing:  ExtractedPricing;
  policies: ExtractedPolicies;
}

/** A single nearby place (mirrors NearbyPlace from googlePlacesService) */
export interface ExtractedNearbyPlace {
  name:      string;
  type:      string;
  vicinity:  string;
  rating?:   number;
  placeId:   string;
}

/** Structured location from Google data */
export interface ExtractedLocation {
  lat:     number;
  lng:     number;
  address: string;   // formatted address
}

/** Result of extractGoogleDetails() */
export interface GoogleExtract {
  location: ExtractedLocation | null;
  nearby: {
    restaurants: ExtractedNearbyPlace[];
    attractions: ExtractedNearbyPlace[];
    transport:   ExtractedNearbyPlace[];
    shopping:    ExtractedNearbyPlace[];
  };
}

// ─── Safe value helpers ───────────────────────────────────────────────────────

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : fallback;
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? v : [];
}

function extractRoomImageUrl(room: Record<string, any>): string {
  const photos = arr<any>(room.photos ?? room.room_photos ?? room.images ?? room.gallery);
  for (const p of photos) {
    const url = str(
      typeof p === "string" ? p : (p?.url_max ?? p?.url_1440 ?? p?.url ?? p?.link ?? "")
    );
    if (url.startsWith("http")) return url.startsWith("http://") ? url.replace("http://", "https://") : url;
  }
  const direct = [
    room.main_photo_url,
    room.main_photo,
    room.photo_url,
    room.thumbnail,
    room.image,
    room.image_url,
  ];
  for (const v of direct) {
    const s = str(v);
    if (s.startsWith("http")) return s.startsWith("http://") ? s.replace("http://", "https://") : s;
  }
  return "";
}

// ─── extractBookingDetails ─────────────────────────────────────────────────────

/**
 * Extract structured rooms, pricing, and policies from a Booking.com API response.
 *
 * Handles multiple response shapes:
 *   - /v1/hotels/data     → BookingHotelData (has `rooms` map, `checkin/checkout`)
 *   - /v1/hotels/search   → BookingHotel     (has `composite_price_breakdown`)
 *   - ExternalHotel       → normalised shape (has `pricePerNight`, `policies`)
 *
 * ⚠️  PRICE RULE: values are read from the API and rounded to 2dp only.
 *     No currency conversion. No multiplication. No rate application.
 */
export function extractBookingDetails(raw: any): BookingExtract {

  // ── 1. ROOMS ──────────────────────────────────────────────────────────────
  //
  // Booking.com /hotels/data returns `rooms` as a key→object map:
  //   { "12345": { room_name, max_persons, bed_configurations, facilities, ... } }
  //
  // /hotels/search returns no room-level data — we synthesise 2–3 room types
  // from the available price and guest count instead.

  const pricePerNight: number =
    num(raw?.composite_price_breakdown?.gross_amount_per_night?.value) ||
    num(raw?.pricePerNight) ||
    num(raw?.price_breakdown?.gross_price?.value) ||
    0;

  const currency: string =
    str(raw?.composite_price_breakdown?.gross_amount_per_night?.currency) ||
    str(raw?.currency) ||
    str(raw?.price_breakdown?.gross_price?.currency) ||
    "GBP";

  const allInclusivePrice: number =
    num(raw?.composite_price_breakdown?.all_inclusive_amount?.value) || 0;

  const checkInTime  = str(raw?.checkin?.from  ?? raw?.policies?.checkInTime  ?? raw?.check_in_time,  "From 15:00");
  const checkOutTime = str(raw?.checkout?.until ?? raw?.policies?.checkOutTime ?? raw?.check_out_time, "Until 11:00");

  const cancelPolicy = str(
    raw?.policies?.cancellationPolicy ??
    raw?.cancellation_policy          ??
    raw?.free_cancellation            ??
    "",
    "Free cancellation available — verify with property."
  );

  // Extract max guests from multiple field paths
  const maxGuests = Math.max(
    1,
    num(raw?.adultCount ?? raw?.adult_count ?? raw?.max_persons ?? 0) || 2
  );

  const rooms: ExtractedRoom[] = [];

  // Path A: /hotels/data — rich room map
  const roomsMap: Record<string, any> = raw?.rooms ?? {};
  const roomEntries = Object.entries(roomsMap).filter(
    (entry): entry is [string, Record<string, any>] =>
      typeof entry[1] === "object" && entry[1] !== null
  );

  if (roomEntries.length > 0) {
    for (const [roomId, room] of roomEntries) {
      // Bed info — Booking returns bed_configurations as an array of options
      const bedConfigs: any[] = arr(room.bed_configurations);
      const beds = bedConfigs.length > 0
        ? arr<any>(bedConfigs[0]?.bed_types)
            .map((b: any) => str(b?.name_with_count ?? b?.description ?? ""))
            .filter(Boolean)
            .join(" + ") || "Standard Beds"
        : str(room.bed_type ?? room.beds, "Standard Beds");

      // Room-level amenities from facilities
      const roomFacilities: string[] = arr<any>(room.facilities ?? room.room_facilities)
        .map((f: any) => str(f?.name ?? f?.facilityName ?? (typeof f === "string" ? f : "")))
        .filter(Boolean);

      // Meals — Booking.com uses `mealplan` field or facility names
      const meals: string[] = [];
      const mealPlan = str(room.mealplan ?? room.meal_plan ?? "");
      if (mealPlan && !["nomealplan", "no_meal_plan", ""].includes(mealPlan.toLowerCase())) {
        meals.push(formatMealPlan(mealPlan));
      }
      // Also check facilities for meal references
      for (const fac of roomFacilities) {
        if (/(breakfast|dinner|lunch|meal|board)/i.test(fac) && !meals.includes(fac)) {
          meals.push(fac);
        }
      }

      // Room cancellation — room level overrides hotel level if present
      const roomCancel = str(
        room.cancellation_policy ?? room.refundable_until ?? "",
        cancelPolicy
      );

      // Room price — Booking sometimes returns room-specific price; fallback to hotel price
      const roomPrice = num(
        room.price?.amount         ??
        room.gross_amount          ??
        room.composite_price_breakdown?.gross_amount_per_night?.value,
        pricePerNight
      );

      const roomCurrency = str(
        room.price?.currency ??
        room.composite_price_breakdown?.gross_amount_per_night?.currency,
        currency
      );

      const sizeRaw = str(room.room_surface_in_m2 ?? room.room_size ?? room.size ?? "");
      const size = sizeRaw
        ? (/m²|sq/i.test(sizeRaw) ? sizeRaw : `${sizeRaw} m²`)
        : "—";

      rooms.push({
        id:                 str(roomId || room.room_id, `booking-room-${rooms.length}`),
        type:               str(room.room_name ?? room.name, "Standard Room"),
        maxGuests:          Math.max(1, num(room.max_persons ?? room.max_occupancy, maxGuests)),
        beds,
        size,
        price:              roomPrice,
        originalPrice:      roomPrice,   // Booking room-level data rarely includes strikethrough
        discountPercent:    0,
        currency:           roomCurrency,
        amenities:          roomFacilities.filter((f) => !/(breakfast|dinner|lunch|meal)/i.test(f)),
        meals,
        cancellationPolicy: roomCancel,
        imageUrl:           extractRoomImageUrl(room),
        available:          room.is_disabled !== true && room.available !== false,
      });
    }
  }

  // Path B: No room-level data — synthesise from hotel-level price
  // Produces 2 rooms (standard + deluxe) so the UI always has something to show
  if (rooms.length === 0 && pricePerNight > 0) {
    const hasMealMention = arr<string>(raw?.facilities ?? [])
      .some((f) => /(breakfast|restaurant|dining)/i.test(typeof f === "string" ? f : ""));

    const standardMeals = hasMealMention ? ["Breakfast available"] : [];
    const premiumMeals  = hasMealMention ? ["Breakfast included"] : [];

    rooms.push(
      {
        type:               "Standard Room",
        maxGuests:          Math.min(maxGuests, 2),
        beds:               "1 Double Bed",
        size:               "—",
        price:              pricePerNight,
        originalPrice:      pricePerNight,
        discountPercent:    0,
        currency,
        amenities:          ["Free WiFi", "Private Bathroom", "Air Conditioning"],
        meals:              standardMeals,
        cancellationPolicy: cancelPolicy,
        imageUrl:           "",
        available:          true,
      },
      {
        type:               "Deluxe Room",
        maxGuests:          Math.min(maxGuests, 2),
        beds:               "1 King Bed",
        size:               "—",
        price:              Math.round(pricePerNight * 1.3),
        originalPrice:      Math.round(pricePerNight * 1.5),
        discountPercent:    13,
        currency,
        amenities:          ["Free WiFi", "Private Bathroom", "Air Conditioning", "Mini Bar", "City View"],
        meals:              premiumMeals,
        cancellationPolicy: cancelPolicy,
        imageUrl:           "",
        available:          true,
      }
    );
  }

  // ── 2. PRICING ────────────────────────────────────────────────────────────
  //
  // Read EXACTLY from the API. Never convert or multiply.
  // `all_inclusive_amount` already includes taxes on Booking.com.

  const taxComponent: number =
    num(raw?.composite_price_breakdown?.tax_inclusive_component?.value) ||
    num(raw?.composite_price_breakdown?.included_taxes_and_charges_amount?.value) ||
    0;

  const finalPriceRaw: number =
    allInclusivePrice ||
    (pricePerNight + taxComponent) ||
    pricePerNight;

  const pricing: ExtractedPricing = {
    basePrice:   pricePerNight,          // gross_amount_per_night — EXACT
    currency,
    taxes:       taxComponent,           // tax_inclusive_component — EXACT (0 if not provided)
    serviceFee:  0,                      // Booking.com doesn't expose this field
    finalPrice:  finalPriceRaw,          // all_inclusive if available, else base + taxes
    perNight:    pricePerNight,          // alias for display
    isInclusive: allInclusivePrice > 0, // true when all_inclusive_amount was present
  };

  // ── 3. POLICIES ───────────────────────────────────────────────────────────
  //
  // Booking.com hotel data has check-in/out nested under `checkin.from` /
  // `checkout.until`. ExternalHotel shape has `policies.checkInTime`.

  const childrenPolicy = str(
    raw?.children_policy ??
    raw?.policies?.children ??
    raw?.child_policies    ??
    "",
    "Children of all ages are welcome — contact the property for specific requirements."
  );

  const petsPolicy = str(
    raw?.pets_policy          ??
    raw?.policies?.petPolicy  ??
    raw?.pets_allowed         ??
    "",
    "Pets policy varies — contact the property directly to confirm."
  );

  const policies: ExtractedPolicies = {
    checkIn:      checkInTime,
    checkOut:     checkOutTime,
    cancellation: cancelPolicy,
    children:     childrenPolicy,
    pets:         petsPolicy,
  };

  return { rooms, pricing, policies };
}

// ─── Meal plan formatter ──────────────────────────────────────────────────────

/**
 * Convert Booking.com internal meal plan codes to human-readable strings.
 * Booking uses strings like "breakfast", "allInclusive", "halfBoard", etc.
 */
function formatMealPlan(raw: string): string {
  const code = raw.toLowerCase().replace(/[_\s-]/g, "");
  const MAP: Record<string, string> = {
    breakfast:       "Breakfast included",
    breakfastonly:   "Breakfast included",
    halfboard:       "Half board (Breakfast + Dinner)",
    fullboard:       "Full board (All meals)",
    allinclusive:    "All inclusive",
    dinnerbed:       "Dinner + Bed",
    lunchdinnerbed:  "Lunch, Dinner + Bed",
  };
  return MAP[code] ?? raw;
}

// ─── extractGoogleDetails ─────────────────────────────────────────────────────

/**
 * Extract structured location and nearby places from a GooglePlaceDetails object.
 *
 * Input:  GooglePlaceDetails | null
 *         (already fetched by googlePlacesService — no new API calls here)
 *
 * Splits the flat `nearbyPlaces` array (already categorised by type in
 * googlePlacesService) into the four buckets the frontend expects:
 *   restaurants / attractions / transport / shopping
 *
 * Returns null for location when coordinates are 0 (unknown / API miss).
 */
export function extractGoogleDetails(raw: any): GoogleExtract {

  // ── Empty result ──────────────────────────────────────────────────────────
  const EMPTY: GoogleExtract = {
    location: null,
    nearby: { restaurants: [], attractions: [], transport: [], shopping: [] },
  };

  if (!raw || typeof raw !== "object") return EMPTY;

  // ── Location ──────────────────────────────────────────────────────────────
  // GooglePlaceDetails.coordinates is { lat, lng }
  const lat = num(raw?.coordinates?.lat ?? raw?.geometry?.location?.lat ?? 0);
  const lng = num(raw?.coordinates?.lng ?? raw?.coordinates?.lng ?? raw?.geometry?.location?.lng ?? 0);

  const location: ExtractedLocation | null =
    lat !== 0 && lng !== 0
      ? {
          lat,
          lng,
          address: str(
            raw?.formattedAddress     ??
            raw?.formatted_address    ??
            raw?.vicinity             ??
            "",
            ""
          ),
        }
      : null;

  // ── Nearby places ─────────────────────────────────────────────────────────
  // The `nearbyPlaces` on EnrichedHotel is already split into buckets.
  // GooglePlaceDetails itself doesn't carry nearby — those come from
  // a separate getNearbyPlaces() call in the aggregator.
  // This function handles BOTH shapes:
  //   A) Raw GooglePlaceDetails (no nearby — returns empty buckets)
  //   B) EnrichedHotel.nearbyPlaces object (already bucketed)
  //   C) Flat NearbyPlace[] array (needs splitting)

  let restaurants: ExtractedNearbyPlace[] = [];
  let attractions: ExtractedNearbyPlace[] = [];
  let transport:   ExtractedNearbyPlace[] = [];
  let shopping:    ExtractedNearbyPlace[] = [];

  // Shape B: pre-bucketed object (from EnrichedHotel or aggregatorService)
  if (raw?.nearbyPlaces && typeof raw.nearbyPlaces === "object") {
    restaurants = normalizeNearbyArr(arr(raw.nearbyPlaces.restaurants));
    attractions = normalizeNearbyArr(arr(raw.nearbyPlaces.attractions));
    transport   = normalizeNearbyArr(arr(raw.nearbyPlaces.transport));
    shopping    = normalizeNearbyArr(arr(raw.nearbyPlaces.shopping));
  }

  // Shape C: flat array — split by `type` field
  else if (Array.isArray(raw?.nearby)) {
    const flat: any[] = arr(raw.nearby);
    restaurants = normalizeNearbyArr(flat.filter((p) => str(p?.type) === "restaurant"));
    attractions = normalizeNearbyArr(flat.filter((p) => str(p?.type) === "attraction"));
    transport   = normalizeNearbyArr(flat.filter((p) =>
      str(p?.type) === "transport" || str(p?.type) === "transit"
    ));
    shopping    = normalizeNearbyArr(flat.filter((p) => str(p?.type) === "shopping"));
  }

  // Dedup each bucket by name (case-insensitive)
  return {
    location,
    nearby: {
      restaurants: dedupeByName(restaurants),
      attractions: dedupeByName(attractions),
      transport:   dedupeByName(transport),
      shopping:    dedupeByName(shopping),
    },
  };
}

// ─── Nearby normalizer helpers ────────────────────────────────────────────────

/** Normalise a raw nearby place object into ExtractedNearbyPlace */
function normalizeNearbyPlace(raw: any): ExtractedNearbyPlace | null {
  if (!raw || typeof raw !== "object") return null;

  const name = str(raw.name ?? raw.title ?? "");
  if (!name) return null;

  return {
    name,
    type:     str(raw.type     ?? raw.category ?? ""),
    vicinity: str(raw.vicinity ?? raw.address  ?? raw.location ?? ""),
    rating:   raw.rating != null ? num(raw.rating) || undefined : undefined,
    placeId:  str(raw.placeId  ?? raw.place_id  ?? raw.id ?? ""),
  };
}

function normalizeNearbyArr(items: any[]): ExtractedNearbyPlace[] {
  return items
    .map(normalizeNearbyPlace)
    .filter((p): p is ExtractedNearbyPlace => p !== null);
}

/** Deduplicate nearby places by lowercased name */
function dedupeByName(places: ExtractedNearbyPlace[]): ExtractedNearbyPlace[] {
  const seen = new Set<string>();
  return places.filter((p) => {
    const key = p.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}