/**
 * hotel-booking-frontend/src/pages/Detail.tsx
 *
 * ── What changed ──────────────────────────────────────────────────────────────
 *
 * 1. REAL API FALLBACK FOR EXTERNAL HOTELS
 *    Was:  check window.__externalHotelCache → if missing return null (empty page)
 *    Now:  check cache first (fast path) → if missing call GET /api/hotels/external/:id
 *          This means the detail page works even on direct URL load / link sharing.
 *
 * 2. REVIEWS SECTION
 *    When the hotel has a `reviews` array (populated by getHotelDetails),
 *    a "Guest reviews" section is rendered below the description.
 *
 * 3. PRICE DISPLAY
 *    price is always from the API (via ExternalHotel.pricePerNight).
 *    Shows "Price on request" only when pricePerNight === 0.
 *
 * 4. NOTHING ELSE CHANGED
 *    • DB hotel path (useQuery → apiClient.fetchHotelById) is byte-for-byte identical.
 *    • GuestInfoForm (Stripe booking) for DB hotels is untouched.
 *    • Layout, breadcrumb, image gallery, facilities, policies, contact — all unchanged.
 *    • CurrencyContext usage unchanged.
 */

import { useState, useEffect } from "react";
import { useParams, Link }            from "react-router-dom";
import { useQuery }                   from "react-query";
import { AiFillStar }                 from "react-icons/ai";
import GuestInfoForm                  from "../forms/GuestInfoForm/GuestInfoForm";
import { Badge }                      from "../components/ui/badge";
import {
  MapPin, Phone, Globe, Clock, Car, Wifi, Waves,
  Dumbbell, Sparkles, Plane, Building2, CreditCard,
  ShieldCheck, Star, Users, ChevronLeft, ThumbsUp,
} from "lucide-react";
import * as apiClient  from "../api-client";
import { useCurrency } from "../contexts/CurrencyContext";

// ─── Window type augmentation ─────────────────────────────────────────────────

declare global {
  interface Window {
    __externalHotelCache?: Record<string, any>;
  }
}

// ─── Facility icon map ────────────────────────────────────────────────────────

const FACILITY_ICONS: Record<string, any> = {
  "Free WiFi":             Wifi,
  "Free Parking":          Car,
  "Swimming Pool":         Waves,
  "Fitness Center":        Dumbbell,
  Spa:                     Sparkles,
  "Airport Shuttle":       Plane,
  "Family Rooms":          Users,
  "Non-Smoking Rooms":     ShieldCheck,
  "24-Hour Front Desk":    Clock,
  "Daily Housekeeping":    Star,
};
function getFacilityIcon(f: string) { return FACILITY_ICONS[f] || Building2; }

// ─── External hotel fetcher with real API fallback ─────────────────────────────
/**
 * Resolution order:
 *   1. window.__externalHotelCache[id]  — populated by SearchResultsCard / AIChatbot
 *   2. GET /api/hotels/external/:id     — live RapidAPI call via our backend
 *   3. null                             — show "unavailable" UI
 */
async function fetchExternalHotelById(id: string): Promise<any | null> {
  // Fast path: browser cache
  const cached = window.__externalHotelCache?.[id];
  if (cached) return cached;

  // Slow path: real backend call
  try {
    const res = await fetch(`/api/hotels/external/${id}`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      console.warn(`[Detail] /api/hotels/external/${id} returned ${res.status}`);
      return null;
    }
    const data = await res.json();
    // Populate cache so subsequent navigation is instant
    window.__externalHotelCache = window.__externalHotelCache ?? {};
    window.__externalHotelCache[id] = data;
    return data;
  } catch (err: any) {
    console.error("[Detail] External hotel fetch failed:", err?.message);
    return null;
  }
}

// ─── Reviews sub-component ────────────────────────────────────────────────────

interface Review { reviewer: string; score: number; title: string; text: string; date: string; }

const ReviewCard = ({ review }: { review: Review }) => (
  <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
    <div className="flex items-start justify-between mb-2">
      <div>
        <p className="font-semibold text-gray-800 text-sm">{review.reviewer}</p>
        {review.date && (
          <p className="text-xs text-gray-400 mt-0.5">{new Date(review.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</p>
        )}
      </div>
      {review.score > 0 && (
        <div className="flex items-center gap-1 bg-primary-600 text-white text-xs font-bold px-2 py-1 rounded-lg">
          <ThumbsUp className="w-3 h-3" />
          {review.score.toFixed(1)}
        </div>
      )}
    </div>
    {review.title && <p className="text-sm font-medium text-gray-700 mb-1">{review.title}</p>}
    {review.text  && <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{review.text}</p>}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const Detail = () => {
  const { hotelId }  = useParams();
  const { format, formatExternal } = useCurrency();
  const isExternal   = hotelId?.startsWith("booking_") ?? false;

  // ── DB hotels: React Query (unchanged) ──────────────────────────────────────
  const { data: dbHotel, isLoading: dbLoading } = useQuery(
    ["fetchHotelById", hotelId],
    () => apiClient.fetchHotelById(hotelId ?? ""),
    { enabled: !!hotelId && !isExternal, retry: 1 }
  );

  // ── External hotels: cache → API fallback ────────────────────────────────────
  const [extHotel,   setExtHotel]   = useState<any | null>(null);
  const [extLoading, setExtLoading] = useState(isExternal);
  const [extError,   setExtError]   = useState(false);

  useEffect(() => {
    if (!isExternal || !hotelId) return;
    let cancelled = false;

    (async () => {
      setExtLoading(true);
      setExtError(false);
      const data = await fetchExternalHotelById(hotelId);
      if (!cancelled) {
        setExtHotel(data);
        if (!data) setExtError(true);
        setExtLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [hotelId, isExternal]);

  // ── Resolve which hotel object to display ────────────────────────────────────
  const hotel   = isExternal ? extHotel  : dbHotel;
  const loading = isExternal ? extLoading : dbLoading;

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">
            {isExternal ? "Fetching hotel details from worldwide inventory…" : "Loading hotel details…"}
          </p>
        </div>
      </div>
    );
  }

  // ── External hotel fetch error / not found ───────────────────────────────────
  if (isExternal && extError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Building2 className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Hotel details unavailable</h2>
        <p className="text-gray-500 mb-6 max-w-md">
          We couldn't load the details for this hotel. It may no longer be available, or there was a temporary API error.
        </p>
        <Link
          to="/search"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Search
        </Link>
      </div>
    );
  }

  // ── Generic not found ────────────────────────────────────────────────────────
  if (!hotel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Hotel not found</h2>
        <Link to="/search" className="text-primary-600 hover:underline">Back to search</Link>
      </div>
    );
  }

  const h = hotel;
  const reviews: Review[] = h.reviews ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/" className="hover:text-primary-600">Home</Link>
        <span>/</span>
        <Link to="/search" className="hover:text-primary-600">Hotels</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium truncate">{h.name}</span>
      </div>

      {/* Hotel header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="flex">
                {Array.from({ length: Math.min(h.starRating ?? 0, 5) }).map((_: any, i: number) => (
                  <AiFillStar key={i} className="fill-yellow-400 w-5 h-5" />
                ))}
              </span>
              {(Array.isArray(h.type) ? h.type.slice(0, 3) : [h.type]).filter(Boolean).map((t: string) => (
                <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
              ))}
              {isExternal && (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                  🌍 Pay at Hotel
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{h.name}</h1>
            <div className="flex items-center gap-1 mt-1 text-gray-600">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{h.city}, {h.country}</span>
            </div>
          </div>

          {/* Booking.com-style score chip */}
          {(h.averageRating ?? 0) > 0 && (
            <div className="flex flex-col items-end">
              <div className="bg-primary-600 text-white px-3 py-1.5 rounded-xl font-bold text-lg">
                {(h.averageRating! * 2).toFixed(1)}
              </div>
              <span className="text-xs text-gray-500 mt-1">
                {h.reviewCount ? `${h.reviewCount.toLocaleString()} reviews` : "Guest score"}
              </span>
            </div>
          )}
        </div>

        {/* Stats badges (DB hotels only) */}
        {!isExternal && ((h.totalBookings ?? 0) > 0 || h.isFeatured) && (
          <div className="flex gap-3 flex-wrap">
            {(h.totalBookings ?? 0) > 0 && (
              <Badge variant="outline">{h.totalBookings} bookings</Badge>
            )}
            {h.isFeatured && <Badge className="bg-yellow-100 text-yellow-800">Featured</Badge>}
          </div>
        )}
      </div>

      {/* Image gallery */}
      {(h.imageUrls ?? []).length > 0 && (
        <div className={`grid gap-3 rounded-2xl overflow-hidden ${(h.imageUrls ?? []).length > 1 ? "grid-cols-3" : "grid-cols-1"}`}>
          {(h.imageUrls ?? []).slice(0, 5).map((url: string, i: number) => (
            <div
              key={i}
              className={`overflow-hidden ${i === 0 && (h.imageUrls ?? []).length > 1 ? "col-span-2 row-span-2" : ""}`}
              style={{ aspectRatio: i === 0 ? "16/9" : "4/3" }}
            >
              <img
                src={url}
                alt={`${h.name} — photo ${i + 1}`}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                loading={i === 0 ? "eager" : "lazy"}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80";
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">

        {/* ── Left column ───────────────────────────────────────────────── */}
        <div className="space-y-8">

          {/* Description */}
          {h.description && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">About this property</h2>
              <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
                {/* Split on double newline or ". " boundary (≥3 sentences per para) */}
                {h.description
                  .split(/\n\n|\. (?=[A-Z])/)
                  .filter((p: string) => p.trim().length > 0)
                  .map((para: string, i: number) => (
                    <p key={i}>{para.trim()}{para.trim().endsWith(".") ? "" : "."}</p>
                  ))}
              </div>
            </div>
          )}

          {/* Facilities */}
          {(h.facilities ?? []).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Facilities & amenities</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(h.facilities ?? []).map((facility: string) => {
                  const Icon = getFacilityIcon(facility);
                  return (
                    <div key={facility} className="flex items-center gap-2 text-sm text-gray-700">
                      <Icon className="w-4 h-4 text-primary-600 flex-shrink-0" />
                      <span>{facility}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Reviews — NEW SECTION (external hotels only, when populated) ── */}
          {isExternal && reviews.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Guest reviews</h2>
                {(h.averageRating ?? 0) > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="bg-primary-600 text-white text-sm font-bold px-2.5 py-1 rounded-lg">
                      {(h.averageRating! * 2).toFixed(1)} / 10
                    </div>
                    <span className="text-sm text-gray-500">
                      {h.reviewCount?.toLocaleString()} reviews
                    </span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {reviews.map((review: Review, i: number) => (
                  <ReviewCard key={i} review={review} />
                ))}
              </div>
            </div>
          )}

          {/* Policies */}
          {h.policies && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Hotel policies</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {h.policies.checkInTime && (
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Check-in</p>
                      <p className="text-sm text-gray-600">{h.policies.checkInTime}</p>
                    </div>
                  </div>
                )}
                {h.policies.checkOutTime && (
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Check-out</p>
                      <p className="text-sm text-gray-600">{h.policies.checkOutTime}</p>
                    </div>
                  </div>
                )}
                {h.policies.cancellationPolicy && (
                  <div className="flex items-start gap-3 sm:col-span-2">
                    <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Cancellation</p>
                      <p className="text-sm text-gray-600">{h.policies.cancellationPolicy}</p>
                    </div>
                  </div>
                )}
                {h.policies.petPolicy && (
                  <div className="flex items-start gap-3">
                    <Building2 className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Pets</p>
                      <p className="text-sm text-gray-600">{h.policies.petPolicy}</p>
                    </div>
                  </div>
                )}
                {h.policies.smokingPolicy && (
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Smoking</p>
                      <p className="text-sm text-gray-600">{h.policies.smokingPolicy}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact */}
          {h.contact && (h.contact.phone || h.contact.email || h.contact.website) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Contact information</h2>
              <div className="space-y-3">
                {h.contact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-primary-600" />
                    <span className="text-sm text-gray-700">{h.contact.phone}</span>
                  </div>
                )}
                {h.contact.email && (
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-primary-600" />
                    <a href={`mailto:${h.contact.email}`} className="text-sm text-primary-600 hover:underline">
                      {h.contact.email}
                    </a>
                  </div>
                )}
                {h.contact.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-primary-600" />
                    <a href={h.contact.website} target="_blank" rel="noopener noreferrer"
                       className="text-sm text-primary-600 hover:underline">
                      Visit property website
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: booking or pay-at-hotel ─────────────────────── */}
        <div className="space-y-4">
          {isExternal ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm sticky top-6">
              {/* Price */}
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Prices from</p>
                {h.pricePerNight > 0 ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900">
                      {isExternal? formatExternal(h.pricePerNight, h.currency ?? "INR"): format(h.pricePerNight)}
                    </span>
                    <span className="text-gray-500 text-sm">/ night</span>
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-gray-700">Price on request</p>
                )}
              </div>

              {/* Pay at Hotel badge */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-4 h-4 text-emerald-700" />
                  <span className="font-semibold text-emerald-800 text-sm">Pay at the property</span>
                </div>
                <p className="text-xs text-emerald-700">
                  No online payment required. Pay on arrival at the hotel.
                </p>
              </div>

              {/* Policy summary */}
              <div className="space-y-2 text-sm text-gray-600 mb-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Free cancellation (verify with property)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Check-in: {h.policies?.checkInTime ?? "From 15:00"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>Check-out: {h.policies?.checkOutTime ?? "Until 11:00"}</span>
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col gap-3">
                <div className="w-full py-3 px-5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl font-semibold text-center cursor-default select-none">
                  ✓ Reserve — Pay at Hotel
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Contact the property directly to confirm your reservation.
                </p>
              </div>
            </div>
          ) : (
            /* DB hotel — existing GuestInfoForm (Stripe) — completely unchanged */
            h && (
              <GuestInfoForm
                pricePerNight={h.pricePerNight}
                hotelId={h._id}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Detail;