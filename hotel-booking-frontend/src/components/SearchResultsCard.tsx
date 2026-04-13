/**
 * hotel-booking-frontend/src/components/SearchResultsCard.tsx
 *
 * ── What changed ──────────────────────────────────────────────────────────────
 *
 * 1. REMOVED "View on Booking.com" button — it is gone entirely.
 *
 * 2. External hotels now show:
 *    • "External Hotel" badge next to type chips (neutral, no brand reference)
 *    • "🌍 Worldwide" badge on the image overlay
 *    • Hotel name links to /detail/booking_<id> — same internal route as DB hotels
 *    • Action button: "View Details · Pay at Hotel" (emerald) → /detail/booking_<id>
 *    • Caches hotel data in window.__externalHotelCache so Detail page loads instantly
 *
 * 3. DB hotels: zero behaviour change.
 *    • Name links to /detail/:id
 *    • Action button: "View Details & Book" (primary blue) → /detail/:id
 *
 * 4. Price uses CurrencyContext (GBP/USD/INR).
 *
 * 5. "Price on request" shown when pricePerNight === 0 (never hardcoded).
 */

import { Link }          from "react-router-dom";
import { HotelType }     from "../../../shared/types";
import { AiFillStar }    from "react-icons/ai";
import {
  MapPin, Building2, Users, Wifi, Car, Waves,
  Dumbbell, Sparkles, UtensilsCrossed, Coffee, Plane, Building,
  CreditCard,
} from "lucide-react";
import { Badge }         from "./ui/badge";
import { useCurrency }   from "../contexts/CurrencyContext";

// ─── Extended hotel type ───────────────────────────────────────────────────────
// Extends HotelType without modifying it. All new fields are optional so
// existing code passing plain HotelType continues to compile.

type HotelWithSource = HotelType & {
  source?:         "db" | "external";
  bookingHotelId?: number;
  bookingUrl?:     string;
};

type Props = { hotel: HotelWithSource };

// ─── Facility icon resolver ───────────────────────────────────────────────────

function getFacilityIcon(facility: string) {
  const map: Record<string, any> = {
    "Free WiFi":       Wifi,
    "Free Parking":    Car,
    "Swimming Pool":   Waves,
    "Fitness Center":  Dumbbell,
    Spa:               Sparkles,
    Restaurant:        UtensilsCrossed,
    "Bar/Lounge":      Coffee,
    "Airport Shuttle": Plane,
    "Business Center": Building,
  };
  return map[facility] || Building2;
}

// ─── Component ────────────────────────────────────────────────────────────────

const SearchResultsCard = ({ hotel }: Props) => {
  const { format, formatExternal } = useCurrency();

  const isExternal = hotel.source === "external";
  const hasPrice   = (hotel.pricePerNight ?? 0) > 0;
  const detailUrl  = `/detail/${hotel._id}`;

  // Cache external hotel data so Detail page can hydrate instantly from it
  if (isExternal && hotel._id) {
    window.__externalHotelCache = window.__externalHotelCache ?? {};
    if (!window.__externalHotelCache[hotel._id]) {
      window.__externalHotelCache[hotel._id] = hotel;
    }
  }

  return (
    <div className="group bg-white rounded-2xl shadow-soft hover:shadow-large transition-all duration-300 border border-gray-100 overflow-hidden h-auto xl:h-[500px] flex">
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_3fr] gap-0 w-full h-full">

        {/* ── Image ──────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden h-64 xl:h-[500px]">
          <img
            src={hotel.imageUrls?.[0] ?? "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80"}
            className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            alt={hotel.name}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80";
            }}
          />

          {/* Top-left overlay badges */}
          <div className="absolute top-4 left-4 flex flex-col space-y-2">

            {/* Price badge — from API, never hardcoded */}
            {hasPrice ? (
              <div className={`${isExternal ? "bg-emerald-600" : "bg-primary-600"} text-white rounded-full px-3 py-1`}>
                <span className="text-sm font-bold">
                  {isExternal
                    ? formatExternal(hotel.pricePerNight, hotel.currency ?? "INR")
                    : format(hotel.pricePerNight)
                  }/night
                </span>
              </div>
            ) : (
              <div className="bg-gray-600/80 text-white rounded-full px-3 py-1">
                <span className="text-xs font-medium">Price on request</span>
              </div>
            )}

            {hotel.isFeatured && (
              <div className="bg-yellow-500 text-white rounded-full px-3 py-1">
                <span className="text-xs font-bold">Featured</span>
              </div>
            )}

            {/* External source indicator — no brand name */}
            {isExternal && (
              <div className="bg-emerald-500/90 backdrop-blur-sm text-white rounded-full px-3 py-1">
                <span className="text-xs font-bold">🌍 Worldwide</span>
              </div>
            )}
          </div>

          {/* Star rating — top-right */}
          <div className="absolute top-4 right-4">
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 flex items-center space-x-1">
              <AiFillStar className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-semibold text-gray-800">{hotel.starRating ?? 0}</span>
            </div>
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div className="p-6 flex flex-col justify-between h-auto xl:h-full overflow-hidden">
          <div className="space-y-4 overflow-y-auto xl:flex-1">

            {/* Stars + type chips + source badge */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="flex">
                  {Array.from({ length: Math.min(hotel.starRating ?? 0, 5) }).map((_, i) => (
                    <AiFillStar key={i} className="w-4 h-4 text-yellow-400" />
                  ))}
                </span>
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(hotel.type) ? hotel.type.slice(0, 4) : [hotel.type]).filter(Boolean).map((t) => (
                    <Badge key={t} variant="default" className="text-xs px-2 py-1">{t}</Badge>
                  ))}
                </div>
                {/* "External Hotel" label — neutral badge, no brand reference */}
                {isExternal && (
                  <Badge className="text-xs px-2 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200">
                    External Hotel
                  </Badge>
                )}
              </div>

              {/* Hotel name — both DB and external link to internal detail page */}
              <Link
                to={detailUrl}
                className="text-2xl font-bold text-gray-900 hover:text-primary-600 transition-colors cursor-pointer block leading-tight"
              >
                {hotel.name}
              </Link>

              <div className="flex items-center text-gray-600">
                <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
                <span className="text-sm">{hotel.city}, {hotel.country}</span>
              </div>
            </div>

            {/* Description */}
            <p className="text-gray-600 leading-relaxed line-clamp-3 text-sm">
              {hotel.description}
            </p>

            {/* Stats */}
            <div className="flex items-center space-x-6 text-sm text-gray-600 flex-wrap gap-y-1">
              {(hotel.totalBookings ?? 0) > 0 && !isExternal && (
                <div className="flex items-center space-x-1">
                  <Users className="w-4 h-4" />
                  <span>{hotel.totalBookings} bookings</span>
                </div>
              )}
              <div className="flex items-center space-x-1">
                <AiFillStar className="w-4 h-4 text-yellow-400" />
                <span>
                  {(hotel.averageRating ?? 0) > 0
                    ? `${hotel.averageRating!.toFixed(1)} avg rating`
                    : "No ratings yet"}
                </span>
              </div>
              {isExternal && (hotel.reviewCount ?? 0) > 0 && (
                <span className="text-xs text-gray-500">
                  ({hotel.reviewCount!.toLocaleString()} reviews)
                </span>
              )}
            </div>
          </div>

          {/* Facilities */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Key Amenities</h4>
            <div className="flex flex-wrap gap-2">
              {(hotel.facilities ?? []).slice(0, 6).map((facility) => {
                const Icon = getFacilityIcon(facility);
                return (
                  <Badge key={facility} variant="outline" className="flex items-center space-x-1.5 px-3 py-1.5 text-xs">
                    <Icon className="w-3 h-3 text-primary-600" />
                    <span>{facility}</span>
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* Action button */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            {isExternal ? (
              /*
               * External hotel: internal detail page with "Pay at Hotel" context.
               * NO "View on Booking.com" button — removed entirely.
               */
              <Link
                to={detailUrl}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-3 px-6 rounded-xl font-semibold hover:from-emerald-700 hover:to-emerald-800 transform hover:scale-105 transition-all duration-200 text-center"
              >
                <CreditCard className="w-4 h-4" />
                View Details · Pay at Hotel
              </Link>
            ) : (
              /* DB hotel: existing Stripe booking flow — unchanged */
              <Link
                to={detailUrl}
                className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3 px-6 rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transform hover:scale-105 transition-all duration-200 text-center block"
              >
                View Details & Book
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Extend Window for the external hotel cache
declare global {
  interface Window { __externalHotelCache?: Record<string, any>; }
}

export default SearchResultsCard;