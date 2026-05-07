/**
 * hotel-booking-frontend/src/pages/Detail.tsx
 *
 * Booking.com-level hotel detail page.
 *
 * ── Data flow ─────────────────────────────────────────────────────────────────
 * Primary:  useQuery → apiClient.getHotelDetail(id) → /api/hotels/details/:id
 *           Returns EnrichedHotel merged with HotelExtra (if enrichHotelData ran)
 *           Contains: rooms, pricing, reviewsSummary, extra.images, extra.nearby…
 *
 * Fallback: raw apiClient.fetchHotelById(id) → /api/hotels/:id
 *           Returns plain MongoDB document — used while primary is loading
 *           for DB hotels so the page is never blank.
 *
 * ── Currency rule (unchanged from previous sessions) ─────────────────────────
 * DB hotels:    formatINR(price)                  → always ₹, never converted
 * External:     formatExternal(price, currency)   → API native currency
 *
 * ── Sections (new vs existing) ───────────────────────────────────────────────
 * NEW  → Image Gallery with modal
 * NEW  → Room Selection cards
 * NEW  → Price Breakdown box
 * NEW  → Grouped Amenities (WiFi / Pool / Service / Dining / Safety)
 * NEW  → Nearby Places with Google Maps links
 * NEW  → Reviews with category scores
 * NEW  → Lazy-loaded Map (React.lazy + Suspense)
 * KEEP → GuestInfoForm (Stripe) for DB hotels — byte-for-byte unchanged
 * KEEP → Pay-at-Hotel widget for external hotels — unchanged
 * KEEP → Policies, Contact sections
 */

import React, {
  useState, useEffect, useCallback, memo, Suspense, lazy,
} from "react";
import { useParams, Link }  from "react-router-dom";
import { useQuery }         from "react-query";
//import { AiFillStar }       from "react-icons/ai";
import GuestInfoForm        from "../forms/GuestInfoForm/GuestInfoForm";
//import { Badge }            from "../components/ui/badge";
import { useCurrency }      from "../contexts/CurrencyContext";
import * as apiClient       from "../api-client";
import HotelHeader from "../components/HotelHeader";
//import { getApiBaseUrl }    from "../api-client";
import {
  MapPin, Phone, Globe, Clock, Wifi, Car, Waves, Dumbbell,
  Sparkles, Plane, Building2, CreditCard, ShieldCheck, Star,
  Users, ChevronLeft, ThumbsUp, Utensils, Coffee, Train,
  ShoppingBag, Navigation, CheckCircle, Briefcase, Heart,
  X, ChevronRight, ArrowUpRight, Percent, Receipt,
  BedDouble, UserCheck, Leaf, Tv, Lock,
} from "lucide-react";

// ── Lazy-loaded Map (never blocks initial render) ──────────────────────────────
const MapComponent = lazy(() => import("../components/Map"));

// ─── Window type ──────────────────────────────────────────────────────────────

declare global {
  interface Window { __externalHotelCache?: Record<string, any>; }
}

// ─── URL builder (for raw fetch fallback calls) ────────────────────────────────

// function apiUrl(path: string): string {
//   const base = (getApiBaseUrl() ?? "").replace(/\/$/, "");
//   return `${base}${path.startsWith("/") ? path : `/${path}`}`;
// }

// ─── Amenity icon map ─────────────────────────────────────────────────────────

const AMENITY_ICONS: Record<string, React.ComponentType<any>> = {
  "Free WiFi":          Wifi,      "WiFi":               Wifi,
  "Free Parking":       Car,       "Parking":            Car,
  "Swimming Pool":      Waves,     "Pool":               Waves,
  "Fitness Center":     Dumbbell,  "Gym":                Dumbbell,
  "Spa":                Sparkles,  "Sauna":              Sparkles,
  "Airport Shuttle":    Plane,     "Shuttle":            Plane,
  "Restaurant":         Utensils,  "Bar":                Coffee,
  "Breakfast":          Coffee,    "Dining":             Utensils,
  "Business Center":    Briefcase, "Meeting Rooms":      Briefcase,
  "Non-Smoking":        Leaf,      "Air Conditioning":   Tv,
  "Room Service":       Star,      "24-Hour Front Desk": Clock,
  "Safety Deposit":     Lock,      "Family Rooms":       Users,
  "Yoga":               Heart,     "Beach Access":       Waves,
};

const AMENITY_GROUPS: Record<string, string[]> = {
  "WiFi & Tech":   ["Free WiFi", "WiFi", "Air Conditioning", "Flat-screen TV", "Cable TV", "Business Center"],
  "Pool & Wellness": ["Swimming Pool", "Pool", "Fitness Center", "Gym", "Spa", "Sauna", "Hot Tub", "Yoga"],
  "Dining":        ["Restaurant", "Bar", "Breakfast", "Breakfast Included", "Breakfast available", "Minibar", "Room Service", "Café"],
  "Services":      ["24-Hour Front Desk", "Airport Shuttle", "Concierge", "Laundry", "Dry Cleaning", "Tour Desk", "Car Rental"],
  "Safety":        ["Safety Deposit Box", "Non-Smoking Rooms", "Fire Extinguisher", "CCTV", "Security"],
  "Accessibility": ["Wheelchair Accessible", "Accessible Parking", "Accessible Bathroom"],
  "Other":         [],
};

function groupAmenityList(amenities: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const assigned = new Set<string>();

  for (const [group, keywords] of Object.entries(AMENITY_GROUPS)) {
    if (group === "Other") continue;
    result[group] = [];
    for (const a of amenities) {
      if (assigned.has(a)) continue;
      if (keywords.some((k) => a.toLowerCase().includes(k.toLowerCase()))) {
        result[group].push(a);
        assigned.add(a);
      }
    }
  }
  // Remaining → Other
  result["Other"] = amenities.filter((a) => !assigned.has(a));
  // Remove empty groups
  return Object.fromEntries(Object.entries(result).filter(([, v]) => v.length > 0));
}

function amenityIcon(name: string): React.ComponentType<any> {
  for (const [k, Icon] of Object.entries(AMENITY_ICONS)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return Icon;
  }
  return CheckCircle;
}

// ─── Sub-components — all memo'd to prevent re-renders ────────────────────────

// ── Image Gallery Modal ───────────────────────────────────────────────────────

const ImageGalleryModal = memo(({
  images, startIndex, onClose,
}: {
  images: string[];
  startIndex: number;
  onClose: () => void;
}) => {
  const [idx, setIdx] = useState(startIndex);

  const prev = useCallback(() => setIdx((i) => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setIdx((i) => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); prev(); }}
        className="absolute left-4 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
      >
        <ChevronLeft className="w-7 h-7" />
      </button>

      <img
        src={images[idx]}
        alt={`Photo ${idx + 1}`}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg select-none"
        onClick={(e) => e.stopPropagation()}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src =
            "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80";
        }}
      />

      <button
        onClick={(e) => { e.stopPropagation(); next(); }}
        className="absolute right-4 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
      >
        <ChevronRight className="w-7 h-7" />
      </button>

      <div className="absolute bottom-4 text-white/60 text-sm">
        {idx + 1} / {images.length}
      </div>

      {/* Thumbnail strip */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto max-w-[80vw] pb-2">
        {images.slice(0, 12).map((url, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setIdx(i); }}
            className={`flex-shrink-0 w-14 h-10 rounded overflow-hidden border-2 transition-all ${
              i === idx ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-75"
            }`}
          >
            <img src={url} alt={`thumb ${i + 1}`} className="w-full h-full object-cover"
                 onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=50"; }} />
          </button>
        ))}
      </div>
    </div>
  );
});
ImageGalleryModal.displayName = "ImageGalleryModal";

// ── Image Grid ────────────────────────────────────────────────────────────────

const ImageGrid = memo(({ images, onOpen }: { images: string[]; onOpen: (i: number) => void }) => {
  if (!images.length) return (
    <div className="rounded-2xl bg-gray-100 h-64 flex items-center justify-center">
      <div className="text-center text-gray-400">
        <Building2 className="w-12 h-12 mx-auto mb-2" />
        <p className="text-sm">No photos available</p>
      </div>
    </div>
  );

  const main  = images[0];
  const thumbs = images.slice(1, 5);

  return (
    <div className="relative">
      <div className={`grid gap-2 rounded-2xl overflow-hidden ${thumbs.length > 0 ? "grid-cols-4" : "grid-cols-1"}`}>
        {/* Main large image */}
        <div
          className={`relative overflow-hidden cursor-pointer group ${thumbs.length > 0 ? "col-span-2 row-span-2" : ""}`}
          style={{ height: thumbs.length > 0 ? 460 : 400 }}
          onClick={() => onOpen(0)}
        >
          <img
            src={main}
            alt="Hotel main photo"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="eager"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80"; }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </div>

        {/* Thumbnail images */}
        {thumbs.map((url, i) => (
          <div
            key={i}
            className="relative overflow-hidden cursor-pointer group"
            style={{ height: 224 }}
            onClick={() => onOpen(i + 1)}
          >
            <img
              src={url}
              alt={`Hotel photo ${i + 2}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&q=70"; }}
            />
            {/* "See all photos" overlay on last thumb */}
            {i === thumbs.length - 1 && images.length > 5 && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
                <span className="text-2xl font-bold">+{images.length - 5}</span>
                <span className="text-sm">more photos</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* See all photos button */}
      {images.length > 1 && (
        <button
          onClick={() => onOpen(0)}
          className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-gray-800 text-sm font-semibold px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5 transition-colors"
        >
          <ArrowUpRight className="w-4 h-4" /> See all {images.length} photos
        </button>
      )}
    </div>
  );
});
ImageGrid.displayName = "ImageGrid";

// ── Review card ───────────────────────────────────────────────────────────────

const ReviewCard = memo(({ review }: { review: any }) => (
  <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/80 hover:bg-gray-50 transition-colors">
    <div className="flex items-start justify-between mb-2">
      <div>
        <p className="font-semibold text-gray-800 text-sm">{review.reviewer || "Guest"}</p>
        {review.date && !isNaN(new Date(review.date).getTime()) && (
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(review.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
          </p>
        )}
      </div>
      {Number(review.rating ?? 0) > 0 && (
        <div className="flex items-center gap-1 bg-teal-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg">
          <ThumbsUp className="w-3 h-3" />
          {Number(review.rating).toFixed(1)}
        </div>
      )}
    </div>
    {review.title && <p className="text-sm font-semibold text-gray-700 mb-1">{review.title}</p>}
    {review.text  && <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{review.text}</p>}
    {review.source === "google" && (
      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
        <Globe className="w-3 h-3" /> Google review
      </p>
    )}
  </div>
));
ReviewCard.displayName = "ReviewCard";

// ── Reviews Summary bar ───────────────────────────────────────────────────────

const RatingBar = memo(({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full bg-teal-500 rounded-full transition-all"
        style={{ width: `${Math.min(100, (value / 10) * 100)}%` }}
      />
    </div>
    <span className="text-xs font-bold text-gray-700 w-8 text-right">{value.toFixed(1)}</span>
  </div>
));
RatingBar.displayName = "RatingBar";

// ── Room card ─────────────────────────────────────────────────────────────────

const RoomCard = memo(({
  room, formatPrice, isDB,
}: {
  room: any;
  formatPrice: (n: number) => string;
  isDB: boolean;
}) => (
  <div className="border border-gray-200 rounded-2xl overflow-hidden hover:border-teal-300 hover:shadow-md transition-all duration-200">
    <div className="p-5">
      {/* Room header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h4 className="font-bold text-gray-900 text-base">{room.type || "Standard Room"}</h4>
          <div className="flex flex-wrap gap-2 mt-1">
            {room.beds && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <BedDouble className="w-3.5 h-3.5" /> {room.beds}
              </span>
            )}
            {room.maxGuests > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <UserCheck className="w-3.5 h-3.5" /> Max {room.maxGuests} guests
              </span>
            )}
            {room.size && room.size !== "—" && (
              <span className="text-xs text-gray-500">{room.size}</span>
            )}
          </div>
        </div>

        {/* Price */}
        <div className="text-right flex-shrink-0">
          {room.discountPercent > 0 && room.originalPrice > room.price && (
            <p className="text-xs text-gray-400 line-through">{formatPrice(room.originalPrice)}</p>
          )}
          <p className="text-xl font-extrabold text-teal-700">{formatPrice(room.price)}</p>
          <p className="text-xs text-gray-500">per night</p>
          {room.discountPercent > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded">
              <Percent className="w-3 h-3" /> {room.discountPercent}% off
            </span>
          )}
        </div>
      </div>

      {/* Meals */}
      {(room.meals ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {room.meals.map((m: string) => (
            <span key={m} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              <Utensils className="w-3 h-3" /> {m}
            </span>
          ))}
        </div>
      )}

      {/* Room amenities */}
      {(room.amenities ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(room.amenities as string[]).slice(0, 5).map((a: string) => (
            <span key={a} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Cancellation */}
      <div className="flex items-start gap-1.5 text-xs text-gray-500 mb-4">
        <ShieldCheck className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
          room.cancellationPolicy?.toLowerCase().includes("free") ? "text-green-500" : "text-gray-400"
        }`} />
        {room.cancellationPolicy || "Cancellation policy varies"}
      </div>

      {/* CTA */}
      {isDB ? (
        <button className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-2.5 rounded-xl transition-all active:scale-[0.98] text-sm">
          Select Room
        </button>
      ) : (
        <div className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-2.5 rounded-xl text-center text-sm">
          Reserve — Pay at Hotel
        </div>
      )}
    </div>
  </div>
));
RoomCard.displayName = "RoomCard";

// ── Price Breakdown ───────────────────────────────────────────────────────────

const PriceBreakdown = memo(({
  pricing, formatPrice,
}: {
  pricing: any;
  formatPrice: (n: number) => string;
}) => {
  if (!pricing || pricing.basePrice <= 0) return null;
  return (
    <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl p-5">
      <h3 className="font-bold text-gray-900 text-base mb-4 flex items-center gap-2">
        <Receipt className="w-5 h-5 text-teal-600" /> Price Breakdown
      </h3>
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between text-gray-700">
          <span>Base price (1 night)</span>
          <span className="font-semibold">{formatPrice(pricing.basePrice)}</span>
        </div>
        {pricing.taxes > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Taxes & charges {pricing.taxRate > 0 ? `(${Math.round(pricing.taxRate * 100)}%)` : ""}</span>
            <span>+ {formatPrice(pricing.taxes)}</span>
          </div>
        )}
        {pricing.serviceFee > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Service fee</span>
            <span>+ {formatPrice(pricing.serviceFee)}</span>
          </div>
        )}
        {pricing.discount > 0 && (
          <div className="flex justify-between text-green-600 font-medium">
            <span>Discount</span>
            <span>− {formatPrice(pricing.discount)}</span>
          </div>
        )}
        <div className="border-t border-teal-200 pt-2.5 flex justify-between font-bold text-gray-900 text-base">
          <span>Total</span>
          <span className="text-teal-700">{formatPrice(pricing.finalPrice)}</span>
        </div>
        {pricing.isInclusive && (
          <p className="text-xs text-teal-600 mt-1">✓ All inclusive — no hidden charges</p>
        )}
      </div>
    </div>
  );
});
PriceBreakdown.displayName = "PriceBreakdown";

// ── Loading skeleton ──────────────────────────────────────────────────────────

const LoadingSkeleton = () => (
  <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-48" />
    <div className="space-y-2">
      <div className="h-9 bg-gray-200 rounded w-2/3" />
      <div className="h-4 bg-gray-200 rounded w-1/3" />
    </div>
    <div className="grid grid-cols-4 gap-2 rounded-2xl overflow-hidden h-[460px]">
      <div className="col-span-2 row-span-2 bg-gray-200" />
      <div className="bg-gray-200" />
      <div className="bg-gray-200" />
      <div className="bg-gray-200" />
      <div className="bg-gray-200" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-100 rounded w-full" />
            <div className="h-4 bg-gray-100 rounded w-4/5" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-6 border border-gray-100 h-72" />
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const Detail = () => {
  // ── Route param — handles both :id and :hotelId route definitions ─────────
  const params  = useParams<{ id?: string; hotelId?: string }>();
  const hotelId = params.hotelId || params.id || "";

  const isExternal = hotelId.startsWith("booking_");
  const isDB       = !isExternal;

  console.log("[Detail] hotelId:", hotelId, "isExternal:", isExternal);

  const { formatINR, formatExternal } = useCurrency();

  // ── Price formatter — single consistent helper ─────────────────────────────
  // DB:       always ₹, no conversion
  // External: API native currency via formatExternal
  const formatPrice = useCallback((amount: number, currency?: string): string => {
    if (!amount || amount <= 0) return "Price on request";
    return isExternal
      ? formatExternal(amount, currency ?? h?.currency ?? "GBP")
      : formatINR(amount);
  }, [isExternal, formatINR, formatExternal]);

  // ── Image gallery modal state ──────────────────────────────────────────────
  const [modalOpen,  setModalOpen]  = useState(false);
  const [modalStart, setModalStart] = useState(0);
  const openModal = (i: number) => {
    setModalStart(i);
    setModalOpen(true);
  };

  // ── Primary data: enriched endpoint ──────────────────────────────────────
  // staleTime 5min: same hotel navigation within 5 min hits cache
  const {
    data:      enriched,
    isLoading: enrichedLoading,
    error:     enrichedError,
  } = useQuery(
    ["hotel-detail", hotelId],
    () => apiClient.getHotelDetail(hotelId),
    {
      enabled:   !!hotelId,
      staleTime: 5 * 60 * 1_000,
      retry:     2,
      onSuccess: (d: any) => console.log("[Detail] enriched loaded:", d?.name),
      onError:   (e: any) => console.error("[Detail] enriched error:", e?.message),
    }
  );

  // ── Fallback: raw DB hotel via plain endpoint (only for DB hotels) ─────────
  // Resolves fast (~100ms) so DB hotels never show a blank page
  const { data: rawHotel } = useQuery(
    ["raw-hotel", hotelId],
    () => apiClient.fetchHotelById(hotelId),
    {
      enabled:   !!hotelId && isDB,
      staleTime: 5 * 60 * 1_000,
      retry:     1,
    }
  );

  // ── Resolve display object ─────────────────────────────────────────────────
  // Use enriched when available; fall through to rawHotel for DB; null for external
  const hotel: any = enriched ?? (isDB ? rawHotel : null);
  const extra: any = (enriched as any)?.extra ?? null;

  // ── Data extraction with safe fallbacks ───────────────────────────────────
  const images:    string[]  = extra?.images ?? hotel?.imageUrls ?? [];
  const amenities: string[]  = extra?.amenities ?? hotel?.amenities ?? hotel?.facilities ?? [];
  const reviews:   any[]     = extra?.reviews ?? hotel?.reviews ?? [];
  const rooms:     any[]     = hotel?.rooms ?? extra?.rooms ?? [];
  const pricing:   any       = hotel?.pricing ?? extra?.pricing ?? null;
  const revSum:    any       = hotel?.reviewsSummary ?? extra?.reviewsSummary ?? null;
  const location:  any       = extra?.location
    ?? (hotel?.coordinates?.lat ? { lat: hotel.coordinates.lat, lng: hotel.coordinates.lng, address: hotel.address ?? "" } : null)
    ?? null;
  const nearby:    any       = extra?.nearby ?? hotel?.nearbyPlaces ?? null;
  const policies:  any       = hotel?.policies ?? extra?.policies ?? {};
  const contact:   any       = hotel?.contact ?? {};
  const highlights: string[] = hotel?.highlights ?? [];
  //const groupedFacilities    = hotel?.facilities ?? null;

  const overallRating = Number(extra?.rating?.overall ?? hotel?.rating ?? hotel?.averageRating ?? 0);
  const ratingWord    = extra?.rating?.ratingWord ?? hotel?.ratingWord ?? "";
  const reviewCount   = Number(extra?.rating?.totalReviews ?? hotel?.reviewCount ?? 0);

  const groupedAmenities = groupAmenityList(amenities);

  // ── Loading ───────────────────────────────────────────────────────────────
  const showLoading = isExternal
    ? (enrichedLoading && !enriched)
    : (enrichedLoading && !rawHotel && !enriched);

  if (showLoading) return <LoadingSkeleton />;

  // ── External error ────────────────────────────────────────────────────────
  if (isExternal && enrichedError && !hotel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Building2 className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Hotel details unavailable</h2>
        <p className="text-gray-500 mb-6 max-w-md">
          We couldn't load this hotel. It may no longer be available or there was a temporary API error.
        </p>
        <Link to="/search" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Search
        </Link>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!hotel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Building2 className="w-12 h-12 text-gray-300 mb-3" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Hotel not found</h2>
        <p className="text-gray-500 text-sm mb-4">ID: {hotelId || "unknown"}</p>
        <Link to="/search" className="text-teal-600 hover:underline font-medium">← Back to search</Link>
      </div>
    );
  }

  const h = hotel;

  return (
    <>
      {/* Image modal */}
      {modalOpen && images.length > 0 && (
        <ImageGalleryModal
          images={images}
          startIndex={modalStart}
          onClose={() => setModalOpen(false)}
        />
      )}

      <div className="max-w-6xl mx-auto space-y-8 pb-20">
        <HotelHeader
          hotel={h}
          images={images}
          amenities={amenities}
          overallRating={overallRating}
          ratingWord={ratingWord}
          reviewCount={reviewCount}
          isExternal={isExternal}
          formatPrice={formatPrice}
        />

        {images.length > 0 && (
          <button onClick={() => openModal(0)} className="hidden">
            open
          </button>
        )}

        

        {/* ── Main grid ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">

          {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
          <div className="space-y-8 min-w-0">

            {/* Description */}
            <div id="section-about" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">About this property</h2>
              {h.description ? (
                <div className="space-y-3 text-gray-600 text-sm leading-relaxed">
                  {String(h.description)
                    .split(/\n\n|\. (?=[A-Z])/)
                    .filter((p: string) => p.trim().length > 5)
                    .map((para: string, i: number) => (
                      <p key={i}>{para.trim()}{para.trim().endsWith(".") ? "" : "."}</p>
                    ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm italic">Description not available.</p>
              )}
            </div>

            {/* ── ROOMS SECTION ─────────────────────────────────────────── */}
            {rooms.length > 0 && (
              <div id="section-rooms" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
                  <BedDouble className="w-5 h-5 text-teal-600" /> Available Rooms
                </h2>
                <div className="space-y-4">
                  {rooms.map((room: any, i: number) => (
                    <RoomCard
                      key={i}
                      room={room}
                      formatPrice={(n) => formatPrice(n, h.currency)}
                      isDB={isDB}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── GROUPED AMENITIES ─────────────────────────────────────── */}
            {amenities.length > 0 && (
              <div id="section-overview" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-5">
                  Amenities
                  <span className="text-sm font-normal text-gray-400 ml-2">({amenities.length})</span>
                </h2>
                {Object.entries(groupedAmenities).map(([group, items]) => (
                  items.length > 0 && (
                    <div key={group} className="mb-5 last:mb-0">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">{group}</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {items.map((a: string) => {
                          const Icon = amenityIcon(a);
                          return (
                            <div key={a} className="flex items-center gap-2 text-sm text-gray-700">
                              <Icon className="w-4 h-4 text-teal-600 flex-shrink-0" />
                              <span className="truncate">{a}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                ))}

                {/* Flat fallback if grouping fails */}
                {Object.values(groupedAmenities).every((v) => v.length === 0) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {amenities.map((a: string) => {
                      const Icon = amenityIcon(a);
                      return (
                        <div key={a} className="flex items-center gap-2 text-sm text-gray-700">
                          <Icon className="w-4 h-4 text-teal-600 flex-shrink-0" />
                          <span className="truncate">{a}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── REVIEWS ───────────────────────────────────────────────── */}
            {reviews.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                {/* Review header */}
                <div className="flex items-start justify-between mb-5">
                  <h2 className="text-xl font-bold text-gray-900">Guest Reviews</h2>
                  {overallRating > 0 && (
                    <div className="text-right">
                      <div className="bg-teal-600 text-white text-lg font-bold px-3 py-1 rounded-xl">
                        {(overallRating * (overallRating <= 5 ? 2 : 1)).toFixed(1)}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{reviewCount.toLocaleString()} reviews</p>
                    </div>
                  )}
                </div>

                {/* Category scores */}
                {revSum?.categories && (
                  <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Category scores</p>
                    {[
                      ["Cleanliness",  revSum.categories.cleanliness],
                      ["Location",     revSum.categories.location],
                      ["Value",        revSum.categories.value],
                      ["Comfort",      revSum.categories.comfort],
                      ["Facilities",   revSum.categories.facilities],
                      ["Staff",        revSum.categories.staff],
                    ].filter(([, v]) => Number(v) > 0).map(([label, value]) => (
                      <RatingBar key={String(label)} label={String(label)} value={Number(value)} />
                    ))}
                  </div>
                )}

                {/* Distribution bar */}
                {revSum?.distribution && reviewCount > 0 && (
                  <div className="mb-5 space-y-1.5">
                    {[
                      ["Exceptional", revSum.distribution.excellent,  "bg-teal-500"],
                      ["Very Good",   revSum.distribution.veryGood,   "bg-teal-400"],
                      ["Good",        revSum.distribution.good,       "bg-yellow-400"],
                      ["Fair",        revSum.distribution.fair,       "bg-orange-400"],
                      ["Poor",        revSum.distribution.poor,       "bg-red-400"],
                    ].map(([label, count, color]) => (
                      <div key={String(label)} className="flex items-center gap-2 text-xs">
                        <span className="w-20 text-gray-500 flex-shrink-0">{String(label)}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${String(color)}`}
                            style={{ width: `${Math.min(100, (Number(count) / reviewCount) * 100)}%` }}
                          />
                        </div>
                        <span className="w-6 text-gray-500 text-right">{Number(count)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Review cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {reviews.slice(0, 6).map((r: any, i: number) => (
                    <ReviewCard key={i} review={r} />
                  ))}
                </div>
              </div>
            )}

            {/* ── MAP (lazy-loaded) ─────────────────────────────────────── */}
            {location && location.lat !== 0 && (
              <Suspense
                fallback={
                  <div className="bg-white rounded-2xl border border-gray-100 h-48 flex items-center justify-center text-gray-400 shadow-sm">
                    <div className="text-center">
                      <MapPin className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                      <p className="text-sm">Loading map…</p>
                    </div>
                  </div>
                }
              >
                <MapComponent
                  lat={location.lat}
                  lng={location.lng}
                  hotelName={h.name ?? ""}
                  address={location.address || h.address}
                  nearby={{
                    restaurants: nearby?.restaurants ?? [],
                    attractions: nearby?.attractions ?? [],
                    transport:   nearby?.transport   ?? [],
                    shopping:    nearby?.shopping    ?? [],
                  }}
                />
              </Suspense>
            )}

            {/* ── NEARBY PLACES (standalone section) ───────────────────── */}
            {nearby && (
              [
                { key: "restaurants", label: "Restaurants & Cafés",    icon: Utensils,    color: "orange" },
                { key: "attractions", label: "Attractions & Sights",   icon: Navigation,  color: "purple" },
                { key: "transport",   label: "Transport Nearby",       icon: Train,       color: "blue"   },
                { key: "shopping",    label: "Shopping",               icon: ShoppingBag, color: "pink"   },
              ]
                .filter(({ key }) => (nearby[key] ?? []).length > 0)
                .map(({ key, label, icon: Icon, color }) => (
                  <div key={key} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Icon className="w-4 h-4 text-teal-600" /> {label}
                    </h3>
                    <div className="space-y-2">
                      {(nearby[key] as any[]).slice(0, 5).map((place: any, i: number) => (
                        <a
                          key={i}
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.vicinity}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group"
                        >
                          <div className={`w-8 h-8 rounded-lg bg-${color}-50 flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-4 h-4 text-${color}-600`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-teal-700">{place.name}</p>
                            {place.vicinity && <p className="text-xs text-gray-400 truncate">{place.vicinity}</p>}
                          </div>
                          {place.rating != null && (
                            <span className="text-xs font-bold text-amber-600 flex-shrink-0">
                              ★ {place.rating}
                            </span>
                          )}
                          <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-teal-500 flex-shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                ))
            )}

            {/* ── POLICIES ─────────────────────────────────────────────── */}
            {(() => {
              const p = policies;
              const rows = [
                { label: "Check-in",     icon: Clock,       val: p.checkIn      ?? p.checkInTime      ?? "From 14:00" },
                { label: "Check-out",    icon: Clock,       val: p.checkOut     ?? p.checkOutTime     ?? "Until 12:00" },
                { label: "Cancellation", icon: ShieldCheck, val: p.cancellation ?? p.cancellationPolicy ?? "Contact property for terms.", span: true },
                { label: "Children",     icon: Users,       val: p.children ?? "" },
                { label: "Pets",         icon: Heart,       val: p.pets ?? p.petPolicy ?? "" },
                { label: "Smoking",      icon: Leaf,        val: p.smoking ?? p.smokingPolicy ?? "" },
              ].filter((r) => r.val);
              if (!rows.length) return null;
              return (
                <div id="section-policies" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Hotel Policies</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {rows.map(({ label, icon: Icon, val, span }: any) => (
                      <div key={label} className={`flex items-start gap-3 ${span ? "sm:col-span-2" : ""}`}>
                        <Icon className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{label}</p>
                          <p className="text-sm text-gray-500">{val}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── CONTACT ──────────────────────────────────────────────── */}
            {(contact.phone || contact.email || contact.website) && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Contact</h2>
                <div className="space-y-3">
                  {contact.phone   && <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-teal-600" /><a href={`tel:${contact.phone}`} className="text-sm text-gray-700 hover:text-teal-600">{contact.phone}</a></div>}
                  {contact.email   && <div className="flex items-center gap-3"><Globe className="w-4 h-4 text-teal-600" /><a href={`mailto:${contact.email}`} className="text-sm text-teal-600 hover:underline">{contact.email}</a></div>}
                  {contact.website && <div className="flex items-center gap-3"><Globe className="w-4 h-4 text-teal-600" /><a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-600 hover:underline">Visit property website</a></div>}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Booking widget */}
            {isDB ? (
              /* DB hotel — GuestInfoForm (Stripe) — UNCHANGED */
              h._id && h.pricePerNight && (
                <GuestInfoForm
                  pricePerNight={Number(h.pricePerNight)}
                  hotelId={String(h._id)}
                />
              )
            ) : (
              /* External hotel — Pay at Hotel widget */
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm sticky top-6">
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-1">Prices from</p>
                  {Number(h.pricePerNight ?? 0) > 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-gray-900">
                        {formatExternal(Number(h.pricePerNight), String(h.currency ?? "GBP"))}
                      </span>
                      <span className="text-gray-500 text-sm">/ night</span>
                    </div>
                  ) : (
                    <p className="text-lg font-semibold text-gray-700">Price on request</p>
                  )}
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-4 h-4 text-emerald-700" />
                    <span className="font-semibold text-emerald-800 text-sm">Pay at the property</span>
                  </div>
                  <p className="text-xs text-emerald-700">No online payment required. Pay on arrival.</p>
                </div>

                <div className="space-y-2 text-sm text-gray-500 mb-5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Free cancellation (verify with property)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-500 flex-shrink-0" />
                    <span>Check-in: {policies.checkIn ?? policies.checkInTime ?? "From 15:00"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-500 flex-shrink-0" />
                    <span>Check-out: {policies.checkOut ?? policies.checkOutTime ?? "Until 11:00"}</span>
                  </div>
                </div>

                <div className="w-full py-3 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold text-center">
                  ✓ Reserve — Pay at Hotel
                </div>
                <p className="text-xs text-gray-400 text-center mt-2">
                  Contact the property to confirm availability.
                </p>
              </div>
            )}

            {/* DB hotel price summary — always ₹ */}
            {isDB && Number(h.pricePerNight ?? 0) > 0 && (
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                <p className="text-sm text-teal-700 font-medium">
                  Starting from{" "}
                  <span className="text-lg font-bold text-teal-800">
                    {formatINR(Number(h.pricePerNight))}
                  </span>
                  {" "}/ night
                </p>
                <p className="text-xs text-teal-600 mt-0.5">Secure payment via card — no hidden fees.</p>
              </div>
            )}

            {/* ── PRICE BREAKDOWN ─────────────────────────────────────── */}
            {pricing && (
              <PriceBreakdown
                pricing={pricing}
                formatPrice={(n) => formatPrice(n, h.currency)}
              />
            )}

            {/* Highlights sidebar */}
            {highlights.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="text-sm font-bold text-gray-700 mb-3">Why guests love it</p>
                <ul className="space-y-2">
                  {highlights.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <CheckCircle className="w-3.5 h-3.5 text-teal-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Overall rating summary box */}
            {overallRating > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-4 mb-3">
                  <div className="bg-teal-600 text-white text-2xl font-extrabold px-4 py-2 rounded-xl">
                    {(overallRating * (overallRating <= 5 ? 2 : 1)).toFixed(1)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{ratingWord || "Rated"}</p>
                    {reviewCount > 0 && (
                      <p className="text-xs text-gray-500">{reviewCount.toLocaleString()} reviews</p>
                    )}
                  </div>
                </div>
                {revSum?.categories && (() => {
                  const cats = revSum.categories;
                  const catRows = [
                    ["Cleanliness",  cats.cleanliness],
                    ["Location",     cats.location],
                    ["Value",        cats.value],
                    ["Staff",        cats.staff],
                  ].filter(([, v]) => Number(v) > 0);
                  return catRows.length > 0 ? (
                    <div className="space-y-2">
                      {catRows.map(([label, value]) => (
                        <RatingBar key={String(label)} label={String(label)} value={Number(value)} />
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Detail;