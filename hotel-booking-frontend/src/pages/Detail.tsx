/**
 * hotel-booking-frontend/src/pages/Detail.tsx
 *
 * ── Root causes fixed in this version ────────────────────────────────────────
 *
 * BUG 1: useParams param name mismatch (PRIMARY CAUSE OF EMPTY PAGE)
 *   Was:  const { hotelId } = useParams<{ hotelId: string }>()
 *   Problem: If the route is defined as <Route path="/detail/:id">, then
 *            useParams() returns { id }, NOT { hotelId }. So hotelId = undefined,
 *            which caused:
 *              - React Query to never fire (enabled: !!hotelId = false)
 *              - fetchEnrichedDetails to return immediately (no id)
 *              - Page to show "Hotel not found" or blank immediately
 *   Fix: Read BOTH :id and :hotelId from useParams, use whichever is defined.
 *        This makes the component work regardless of how the route is named.
 *
 * BUG 2: fetch() with relative URL hits Vite dev server, not Express
 *   Was:  fetch(`/api/hotels/details/${id}`)
 *   Problem: In Vite dev mode without a proxy, this goes to localhost:5173
 *            (Vite), which returns HTML → JSON.parse throws "Unexpected token <"
 *   Fix: Use apiUrl() from api-client which builds the full URL:
 *        http://localhost:5000/api/hotels/details/... in dev
 *        /api/hotels/details/... in production (same origin)
 *
 * BUG 3: No debug logging
 *   Added console.log at every step so the exact failure point is visible
 *   in DevTools console.
 *
 * Everything else — GuestInfoForm, currency, reviews, map, policies — unchanged.
 */

import { useState, useEffect } from "react";
import { useParams, Link }             from "react-router-dom";
import { useQuery }                    from "react-query";
import { AiFillStar }                  from "react-icons/ai";
import GuestInfoForm                   from "../forms/GuestInfoForm/GuestInfoForm";
import { Badge }                       from "../components/ui/badge";
import {
  MapPin, Phone, Globe, Clock, Car, Wifi, Waves,
  Dumbbell, Sparkles, Plane, Building2, CreditCard,
  ShieldCheck, Star, Users, ChevronLeft, ThumbsUp,
  Utensils, Coffee, Train, ShoppingBag, Navigation,
  CheckCircle, Briefcase, Heart, TreePine,
} from "lucide-react";
import { useCurrency }    from "../contexts/CurrencyContext";
import * as apiClient     from "../api-client";
import { getApiBaseUrl }  from "../api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

declare global {
  interface Window { __externalHotelCache?: Record<string, any>; }
}

interface Review {
  reviewer: string;
  rating:   number;
  title:    string;
  text:     string;
  date:     string;
  source?:  string;
}

// ─── URL builder (mirrors api-client.ts) ─────────────────────────────────────

function apiUrl(path: string): string {
  const base      = (getApiBaseUrl() ?? "").replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

// ─── Icon maps ────────────────────────────────────────────────────────────────

const FACILITY_ICONS: Record<string, any> = {
  "Free WiFi":          Wifi,       "Free Parking":       Car,
  "Swimming Pool":      Waves,      "Fitness Center":     Dumbbell,
  Spa:                  Sparkles,   "Airport Shuttle":    Plane,
  "Family Rooms":       Users,      "Non-Smoking Rooms":  ShieldCheck,
  "24-Hour Front Desk": Clock,      "Daily Housekeeping": Star,
  Restaurant:           Utensils,   Bar:                  Coffee,
  "Business Center":    Briefcase,  "Yoga Classes":       Heart,
  Garden:               TreePine,
};
const getFacilityIcon = (f: string) => FACILITY_ICONS[f] || Building2;

const NEARBY_ICONS: Record<string, any> = {
  restaurant: Utensils, attraction: Navigation, transport: Train, shopping: ShoppingBag,
};
const getNearbyIcon = (type: string) => NEARBY_ICONS[type] || MapPin;

const NEARBY_COLORS: Record<string, string> = {
  restaurant: "bg-orange-50 border-orange-200 text-orange-700",
  attraction: "bg-purple-50 border-purple-200 text-purple-700",
  transport:  "bg-blue-50 border-blue-200 text-blue-700",
  shopping:   "bg-pink-50 border-pink-200 text-pink-700",
};

// ─── Map helpers ──────────────────────────────────────────────────────────────

function buildStaticMapUrl(lat: number, lng: number): string {
  const key = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!key) return "";
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=600x280&maptype=roadmap&markers=color:teal%7Clabel:H%7C${lat},${lng}&key=${key}`;
}

function buildGoogleMapsLink(lat: number, lng: number, name: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}@${lat},${lng}`;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text || text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    console.error(`[Detail] Non-JSON response from ${res.url}:`, text.slice(0, 300));
    return {
      message: `Server error (${res.status}). ${
        text.startsWith("<") ? "Got HTML — check Vite proxy config." : text.slice(0, 80)
      }`,
    };
  }
}

/**
 * Fetch enriched hotel data from the aggregator.
 * BUG FIX: Uses apiUrl() to build full URL (not relative fetch).
 * Timeout: 12s — if Google Places is slow, we fall through to dbHotel.
 */
async function fetchEnrichedDetails(id: string): Promise<any | null> {
  const cacheKey = `enriched::${id}`;
  const cached   = window.__externalHotelCache?.[cacheKey];
  if (cached) {
    console.log("[Detail] enriched cache hit for", id);
    return cached;
  }

  const url = apiUrl(`/api/hotels/details/${id}`);
  console.log("[Detail] fetching enriched from:", url);

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(url, {
      signal:      controller.signal,
      credentials: "include",
    });
    clearTimeout(timeoutId);

    console.log("[Detail] enriched response status:", res.status, "for", id);

    if (!res.ok) {
      console.warn("[Detail] enriched endpoint not OK:", res.status);
      return null;
    }

    const data = await safeJson(res);
    console.log("[Detail] enriched data received, name:", data?.name);

    if (!data?.name && !data?._id) {
      console.warn("[Detail] enriched data appears empty:", data);
      return null;
    }

    window.__externalHotelCache        = window.__externalHotelCache ?? {};
    window.__externalHotelCache[cacheKey] = data;
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === "AbortError") {
      console.warn("[Detail] enriched fetch timed out for", id, "— using DB fallback");
    } else {
      console.error("[Detail] enriched fetch error for", id, ":", err?.message);
    }
    return null;
  }
}

/** Fallback for external hotels only: raw RapidAPI data */
async function fetchExternalFallback(id: string): Promise<any | null> {
  const cached = window.__externalHotelCache?.[id];
  if (cached) return cached;

  const url = apiUrl(`/api/hotels/external/${id}`);
  console.log("[Detail] fallback fetch from:", url);

  try {
    const res  = await fetch(url, { credentials: "include" });
    console.log("[Detail] fallback response status:", res.status);
    if (!res.ok) return null;
    const data = await safeJson(res);
    window.__externalHotelCache        = window.__externalHotelCache ?? {};
    window.__externalHotelCache[id]    = data;
    return data;
  } catch (err: any) {
    console.error("[Detail] fallback fetch error:", err?.message);
    return null;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ReviewCard = ({ review }: { review: Review }) => (
  <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
    <div className="flex items-start justify-between mb-2">
      <div>
        <p className="font-semibold text-gray-800 text-sm">{review.reviewer || "Guest"}</p>
        {review.date && !isNaN(new Date(review.date).getTime()) && (
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(review.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
          </p>
        )}
      </div>
      {(review.rating ?? 0) > 0 && (
        <div className="flex items-center gap-1 bg-teal-600 text-white text-xs font-bold px-2 py-1 rounded-lg">
          <ThumbsUp className="w-3 h-3" />
          {Number(review.rating).toFixed(1)}
        </div>
      )}
    </div>
    {review.title && <p className="text-sm font-medium text-gray-700 mb-1">{review.title}</p>}
    {review.text  && <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{review.text}</p>}
    {review.source === "google" && (
      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
        <Globe className="w-3 h-3" /> Google review
      </p>
    )}
  </div>
);

const HotelMap = ({
  coords, name, nearbyPlaces,
}: {
  coords: { lat: number; lng: number };
  name: string;
  nearbyPlaces: any;
}) => {
  const mapUrl   = buildStaticMapUrl(coords.lat, coords.lng);
  const mapsLink = buildGoogleMapsLink(coords.lat, coords.lng, name);
  const hasKey   = !!(import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
  const allNearby = [
    ...((nearbyPlaces?.restaurants ?? []).slice(0, 2)),
    ...((nearbyPlaces?.attractions ?? []).slice(0, 2)),
    ...((nearbyPlaces?.transport   ?? []).slice(0, 2)),
    ...((nearbyPlaces?.shopping    ?? []).slice(0, 1)),
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-900">Location & Map</h2>
        <a href={mapsLink} target="_blank" rel="noopener noreferrer"
           className="text-sm text-teal-600 font-semibold hover:text-teal-700 flex items-center gap-1">
          <Navigation className="w-4 h-4" /> Open in Google Maps
        </a>
      </div>

      {hasKey && mapUrl ? (
        <a href={mapsLink} target="_blank" rel="noopener noreferrer">
          <img src={mapUrl} alt={`Map showing ${name}`}
               className="w-full h-52 object-cover hover:opacity-90 transition-opacity" loading="lazy" />
        </a>
      ) : (
        <div className="bg-teal-50 h-32 flex flex-col items-center justify-center gap-1 border-b border-gray-100">
          <MapPin className="w-7 h-7 text-teal-500" />
          <p className="text-sm font-semibold text-gray-700">{name}</p>
          <p className="text-xs text-gray-500">{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</p>
          <a href={mapsLink} target="_blank" rel="noopener noreferrer"
             className="text-xs text-teal-600 font-semibold underline mt-1">
            View on Google Maps →
          </a>
        </div>
      )}

      {allNearby.length > 0 && (
        <div className="p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">What's nearby</p>
          <div className="space-y-2">
            {allNearby.map((place: any, i: number) => {
              const Icon   = getNearbyIcon(place.type);
              const colors = NEARBY_COLORS[place.type] ?? "bg-gray-50 border-gray-200 text-gray-700";
              return (
                <div key={i} className={`flex items-center gap-2.5 border rounded-xl px-3 py-2 text-sm ${colors}`}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate block">{place.name || "—"}</span>
                    {place.vicinity && <span className="text-xs opacity-70 truncate block">{place.vicinity}</span>}
                  </div>
                  {place.rating && (
                    <span className="flex items-center gap-0.5 text-xs font-semibold">
                      <AiFillStar className="w-3 h-3 text-amber-400" />{place.rating}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const GroupedFacilities = ({ facilities }: { facilities: Record<string, string[]> }) => {
  const labels: Record<string, string> = {
    general: "General", services: "Services", wellness: "Wellness",
    business: "Business", dining: "Dining", accessibility: "Accessibility",
  };
  const icons: Record<string, any> = {
    general: Wifi, services: Star, wellness: Heart,
    business: Briefcase, dining: Utensils, accessibility: CheckCircle,
  };
  const hasAny = Object.values(facilities).some((a) => Array.isArray(a) && a.length > 0);
  if (!hasAny) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-5">Facilities by category</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Object.entries(facilities).map(([key, items]) => {
          if (!Array.isArray(items) || items.length === 0) return null;
          const Icon = icons[key] ?? Building2;
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-teal-600" />
                <p className="text-sm font-bold text-gray-700">{labels[key] ?? key}</p>
              </div>
              <ul className="space-y-1">
                {items.map((item: string) => (
                  <li key={item} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <CheckCircle className="w-3 h-3 text-teal-400 flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const HighlightsBar = ({ highlights }: { highlights: string[] }) => {
  if (!highlights?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {highlights.map((h, i) => (
        <div key={i} className="flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold px-3 py-1.5 rounded-full">
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />{h}
        </div>
      ))}
    </div>
  );
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

const LoadingSkeleton = () => (
  <div className="max-w-6xl mx-auto space-y-6 pb-16 animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-48" />
    <div className="space-y-3">
      <div className="h-8 bg-gray-200 rounded w-2/3" />
      <div className="h-4 bg-gray-200 rounded w-1/3" />
    </div>
    <div className="h-64 bg-gray-200 rounded-2xl" />
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-6 space-y-3 border border-gray-100">
          <div className="h-5 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-5/6" />
          <div className="h-4 bg-gray-100 rounded w-4/6" />
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100 h-40" />
      </div>
      <div className="bg-white rounded-2xl p-6 border border-gray-100 h-64" />
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const Detail = () => {
  // ── BUG FIX: read BOTH :id and :hotelId to handle any route definition ────
  // Routes may be defined as /detail/:id OR /detail/:hotelId in App.tsx.
  // We read both and use whichever is defined.
  const params = useParams<{ id?: string; hotelId?: string }>();
  const hotelId = params.hotelId || params.id || "";

  const isExternal = hotelId?.startsWith("booking_") ?? false;

  console.log("[Detail] Rendering with hotelId:", hotelId, "isExternal:", isExternal);

  const { formatINR, formatExternal } = useCurrency();

  // ── Tier 2: raw DB hotel via React Query (fast path for DB hotels) ────────
  const { data: dbHotel } = useQuery(
    ["fetchHotelById", hotelId],
    () => {
      console.log("[Detail] React Query fetching DB hotel:", hotelId);
      return apiClient.fetchHotelById(hotelId);
    },
    {
      enabled:   !!hotelId && !isExternal,
      retry:     2,
      staleTime: 60_000,
      onSuccess: (data: any) => console.log("[Detail] dbHotel loaded:", data?.name),
      onError:   (err: any) => console.error("[Detail] dbHotel error:", err?.message),
    }
  );

  // ── Tier 1: enriched (aggregator — with Google, timeout 12s) ─────────────
  const [enriched,      setEnriched]      = useState<any | null>(null);
  const [enrichLoading, setEnrichLoading] = useState<boolean>(true);
  const [enrichError,   setEnrichError]   = useState<boolean>(false);

  useEffect(() => {
    if (!hotelId) {
      console.warn("[Detail] No hotelId — cannot fetch details");
      setEnrichLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      setEnrichLoading(true);
      setEnrichError(false);

      const data = await fetchEnrichedDetails(hotelId);
      if (cancelled) return;

      if (data) {
        console.log("[Detail] enriched data set, name:", data.name);
        setEnriched(data);
        setEnrichLoading(false);
        return;
      }

      // Enriched failed — for external hotels try fallback
      if (isExternal) {
        console.log("[Detail] trying external fallback for:", hotelId);
        const fallback = await fetchExternalFallback(hotelId);
        if (!cancelled) {
          console.log("[Detail] fallback result:", fallback?.name ?? "null");
          setEnriched(fallback);
          if (!fallback) setEnrichError(true);
        }
      } else {
        // DB hotel: enriched failed (likely timeout). dbHotel will be used.
        console.log("[Detail] enriched failed for DB hotel — will use dbHotel fallback");
      }

      if (!cancelled) setEnrichLoading(false);
    })();

    return () => { cancelled = true; };
  }, [hotelId, isExternal]);

  // ── Resolve display object ─────────────────────────────────────────────────
  // DB:       enriched (if ready) OR dbHotel (immediate fallback from React Query)
  // External: enriched only (no DB fallback available)
  const hotel = enriched ?? (isExternal ? null : (dbHotel as any));

  // ── Loading condition ──────────────────────────────────────────────────────
  // Show spinner only if we truly have nothing to show yet
  const loading = isExternal
    ? (enrichLoading && !enriched)
    : (enrichLoading && !hotel);

  // Price formatters
  const formatDBPrice  = (n: number) => (!n || n <= 0) ? "Price on request" : formatINR(n);

  // ─── States ──────────────────────────────────────────────────────────────

  if (loading) return <LoadingSkeleton />;

  if (isExternal && enrichError && !hotel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Building2 className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Hotel details unavailable</h2>
        <p className="text-gray-500 mb-6 max-w-md">
          We couldn't load this hotel. It may no longer be available, or there was a temporary error.
        </p>
        <Link to="/search"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Search
        </Link>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Building2 className="w-12 h-12 text-gray-300 mb-3" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Hotel not found</h2>
        <p className="text-gray-500 text-sm mb-4">
          ID: {hotelId || "unknown"} — check the URL or go back to search.
        </p>
        <Link to="/search" className="text-teal-600 hover:underline font-medium">
          ← Back to search
        </Link>
      </div>
    );
  }

  const h = hotel;

  // Derived values (all with safe fallbacks)
  const reviews:          Review[] = enriched?.reviews    ?? h.reviews ?? [];
  const hasCoords                  = !!(enriched?.coordinates?.lat && enriched.coordinates.lat !== 0);
  const imageUrls:        string[] = (h.imageUrls ?? []).filter(Boolean);
  const amenities:        string[] = enriched?.amenities  ?? h.amenities ?? h.facilities ?? [];
  const groupedFacilities          = enriched?.facilities ?? null;
  const highlights:       string[] = enriched?.highlights ?? [];
  const nearbyPlaces               = enriched?.nearbyPlaces ?? null;
  const isDB                       = !isExternal;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/"       className="hover:text-teal-600">Home</Link>
        <span>/</span>
        <Link to="/search" className="hover:text-teal-600">Hotels</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium truncate">{h.name ?? "Hotel"}</span>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {Array.from({ length: Math.min(Number(h.starRating ?? 0), 5) }).map((_: any, i: number) => (
                <AiFillStar key={i} className="fill-yellow-400 w-5 h-5" />
              ))}
              {(Array.isArray(h.type) ? h.type.slice(0, 3) : [h.type]).filter(Boolean).map((t: string) => (
                <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
              ))}
              {!isDB && (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">🌍 Pay at Hotel</Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{h.name ?? "Hotel"}</h1>
            <div className="flex items-center gap-1 mt-1 text-gray-600">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">
                {h.address ?? [h.city, h.country].filter(Boolean).join(", ") ?? "Location not listed"}
              </span>
            </div>
          </div>

          {Number(h.rating ?? h.averageRating ?? 0) > 0 && (
            <div className="flex flex-col items-end">
              <div className="bg-teal-600 text-white px-3 py-1.5 rounded-xl font-bold text-lg">
                {(Number(h.rating ?? h.averageRating ?? 0) * 2).toFixed(1)}
              </div>
              <p className="text-xs font-semibold text-teal-700 mt-0.5">{h.ratingWord ?? "Rated"}</p>
              <span className="text-xs text-gray-500">
                {h.reviewCount ? `${Number(h.reviewCount).toLocaleString()} reviews` : "Guest score"}
              </span>
            </div>
          )}
        </div>

        {highlights.length > 0 && <HighlightsBar highlights={highlights} />}

        {isDB && ((h.totalBookings ?? 0) > 0 || h.isFeatured) && (
          <div className="flex gap-3 flex-wrap">
            {(h.totalBookings ?? 0) > 0 && <Badge variant="outline">{h.totalBookings} bookings</Badge>}
            {h.isFeatured && <Badge className="bg-yellow-100 text-yellow-800">Featured</Badge>}
          </div>
        )}
      </div>

      {/* Image gallery */}
      {imageUrls.length > 0 ? (
        <div className="rounded-2xl overflow-hidden">
          <div className={`grid gap-2 ${imageUrls.length > 1 ? "grid-cols-4" : "grid-cols-1"}`}
               style={{ maxHeight: 460 }}>
            {imageUrls.slice(0, 5).map((url: string, i: number) => (
              <div key={i}
                   className={`overflow-hidden ${i === 0 && imageUrls.length > 1 ? "col-span-2 row-span-2" : ""}`}>
                <img src={url}
                     alt={`${h.name ?? "Hotel"} photo ${i + 1}`}
                     className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                     style={{ height: i === 0 ? 460 : 224 }}
                     loading={i === 0 ? "eager" : "lazy"}
                     onError={(e) => {
                       (e.currentTarget as HTMLImageElement).src =
                         "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80";
                     }} />
              </div>
            ))}
          </div>
          {imageUrls.length > 5 && (
            <p className="text-xs text-gray-400 mt-1.5 text-right">+{imageUrls.length - 5} more photos</p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-gray-100 h-52 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <Building2 className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">No photos available</p>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">

        {/* Left column */}
        <div className="space-y-8">

          {/* Description */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">About this property</h2>
            {h.description ? (
              <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
                {String(h.description)
                  .split(/\n\n|\. (?=[A-Z])/)
                  .filter((p) => p.trim().length > 0)
                  .map((para, i) => (
                    <p key={i}>{para.trim()}{para.trim().endsWith(".") ? "" : "."}</p>
                  ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic">Description not available for this property.</p>
            )}
          </div>

          {/* Amenities */}
          {amenities.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Amenities
                <span className="text-sm font-normal text-gray-500 ml-2">({amenities.length})</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {amenities.map((f: string) => {
                  const Icon = getFacilityIcon(f);
                  return (
                    <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
                      <Icon className="w-4 h-4 text-teal-600 flex-shrink-0" />{f}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grouped facilities */}
          {groupedFacilities && <GroupedFacilities facilities={groupedFacilities} />}

          {/* Reviews */}
          {reviews.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Guest reviews</h2>
                {Number(h.rating ?? h.averageRating ?? 0) > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="bg-teal-600 text-white text-sm font-bold px-2.5 py-1 rounded-lg">
                      {(Number(h.rating ?? h.averageRating ?? 0) * 2).toFixed(1)} / 10
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reviews.slice(0, 10).map((r, i) => <ReviewCard key={i} review={r} />)}
              </div>
            </div>
          )}

          {/* Map */}
          {hasCoords && nearbyPlaces && (
            <HotelMap coords={enriched.coordinates} name={h.name ?? ""} nearbyPlaces={nearbyPlaces} />
          )}

          {/* Policies */}
          {(() => {
            const p = enriched?.policies ?? h.policies ?? {};
            const rows = [
              { key: "checkIn",      label: "Check-in",    icon: Clock,       span: false,
                val: p.checkIn      ?? p.checkInTime      ?? "From 14:00" },
              { key: "checkOut",     label: "Check-out",   icon: Clock,       span: false,
                val: p.checkOut     ?? p.checkOutTime     ?? "Until 12:00" },
              { key: "cancellation", label: "Cancellation",icon: ShieldCheck, span: true,
                val: p.cancellation ?? p.cancellationPolicy ?? "Contact property for terms." },
              { key: "children",     label: "Children",    icon: Users,       span: false,
                val: p.children     ?? "Children of all ages welcome." },
              { key: "pets",         label: "Pets",        icon: Building2,   span: false,
                val: p.pets         ?? p.petPolicy        ?? "Contact property regarding pets." },
              { key: "smoking",      label: "Smoking",     icon: ShieldCheck, span: false,
                val: p.smoking      ?? p.smokingPolicy    ?? "Non-smoking property." },
            ];
            const hasRows = rows.some((r) => !!r.val);
            if (!hasRows) return null;
            return (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Hotel policies</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {rows.map(({ key, label, icon: Icon, span, val }) => (
                    <div key={key} className={`flex items-start gap-3 ${span ? "sm:col-span-2" : ""}`}>
                      <Icon className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{label}</p>
                        <p className="text-sm text-gray-600">{val}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Contact */}
          {(() => {
            const c = enriched?.contact ?? h.contact ?? {};
            if (!c.phone && !c.email && !c.website) return null;
            return (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Contact</h2>
                <div className="space-y-3">
                  {c.phone   && <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-teal-600" /><a href={`tel:${c.phone}`} className="text-sm text-gray-700 hover:text-teal-600">{c.phone}</a></div>}
                  {c.email   && <div className="flex items-center gap-3"><Globe className="w-4 h-4 text-teal-600" /><a href={`mailto:${c.email}`} className="text-sm text-teal-600 hover:underline">{c.email}</a></div>}
                  {c.website && <div className="flex items-center gap-3"><Globe className="w-4 h-4 text-teal-600" /><a href={c.website} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-600 hover:underline">Visit property website</a></div>}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {!isDB ? (
            /* External hotel — Pay at Hotel widget */
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm sticky top-6">
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Prices from</p>
                {(h.pricePerNight ?? 0) > 0 ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900">
                      {/* External: use API currency (INR for Indian Booking.com hotels) */}
                      {formatExternal(h.pricePerNight, h.currency ?? "GBP")}
                    </span>
                    <span className="text-gray-500 text-sm">/ night</span>
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-gray-700">Price on request</p>
                )}
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-4 h-4 text-emerald-700" />
                  <span className="font-semibold text-emerald-800 text-sm">Pay at the property</span>
                </div>
                <p className="text-xs text-emerald-700">No online payment required. Pay on arrival.</p>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Free cancellation (verify with property)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-500 flex-shrink-0" />
                  <span>Check-in: {enriched?.policies?.checkIn ?? h.policies?.checkIn ?? h.policies?.checkInTime ?? "From 15:00"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-500 flex-shrink-0" />
                  <span>Check-out: {enriched?.policies?.checkOut ?? h.policies?.checkOut ?? h.policies?.checkOutTime ?? "Until 11:00"}</span>
                </div>
              </div>

              <div className="w-full py-3 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold text-center">
                ✓ Reserve — Pay at Hotel
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">Contact property to confirm availability.</p>
            </div>
          ) : (
            /* DB hotel — GuestInfoForm (Stripe) — completely unchanged */
            h._id && h.pricePerNight && (
              <GuestInfoForm
                pricePerNight={Number(h.pricePerNight)}
                hotelId={String(h._id)}
              />
            )
          )}

          {/* DB hotel price summary — always ₹ */}
          {isDB && Number(h.pricePerNight ?? 0) > 0 && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <p className="text-sm text-teal-700 font-medium">
                Starting from{" "}
                <span className="text-lg font-bold text-teal-800">
                  {/* Always ₹ for DB hotels — no conversion, no multiplication */}
                  {formatDBPrice(Number(h.pricePerNight))}
                </span>
                {" "}/ night
              </p>
              <p className="text-xs text-teal-600 mt-0.5">Secure payment via card — no hidden fees.</p>
            </div>
          )}

          {/* Highlights sidebar */}
          {highlights.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-sm font-bold text-gray-700 mb-3">Why guests love it</p>
              <ul className="space-y-2">
                {highlights.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 text-teal-500 flex-shrink-0 mt-0.5" />{item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Detail;