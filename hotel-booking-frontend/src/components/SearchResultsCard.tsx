/**
 * hotel-booking-frontend/src/components/SearchResultsCard.tsx
 *
 * ── Currency fix ──────────────────────────────────────────────────────────────
 * DB hotels:    formatINR(hotel.pricePerNight)  → always ₹, no conversion
 * External:     formatExternal(hotel.pricePerNight, hotel.currency) → API currency
 *
 * ── Everything else unchanged ─────────────────────────────────────────────────
 * Source detection, cache population, booking flow, teal/emerald theme.
 */

import { Link }        from "react-router-dom";
import { HotelType }   from "../../../shared/types";
import { AiFillStar }  from "react-icons/ai";
import {
  MapPin, Building2, Users, Wifi, Car, Waves,
  Dumbbell, Sparkles, UtensilsCrossed, Coffee, Plane, Building,
  CreditCard, ArrowRight,
} from "lucide-react";
import { Badge }       from "./ui/badge";
import { useCurrency } from "../contexts/CurrencyContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type HotelWithSource = HotelType & {
  source?:         "db" | "external";
  bookingHotelId?: number;
  bookingUrl?:     string;
  currency?:       string;
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
  // ── CURRENCY FIX ────────────────────────────────────────────────────────────
  // formatINR      → DB hotels: price already in INR, just prefix ₹, no math
  // formatExternal → External hotels: use the API's own currency field
  const { formatINR, formatExternal } = useCurrency();

  const isExternal = hotel.source === "external";
  const hasPrice   = (hotel.pricePerNight ?? 0) > 0;
  const detailUrl  = `/detail/${hotel._id}`;

  // ── Price display — correct for BOTH sources ──────────────────────────────
  const formattedPrice = isExternal
    ? formatExternal(hotel.pricePerNight, hotel.currency ?? "GBP")
    : formatINR(hotel.pricePerNight);           // ← was format() before (wrong GBP conversion)

  // Populate browser cache so Detail page hydrates without extra API call
  if (isExternal && hotel._id) {
    window.__externalHotelCache = window.__externalHotelCache ?? {};
    if (!window.__externalHotelCache[hotel._id]) {
      window.__externalHotelCache[hotel._id] = hotel;
    }
  }

  return (
    <div className="
      group bg-white rounded-2xl border border-gray-100
      shadow-sm hover:shadow-xl hover:border-teal-100
      transition-all duration-300 overflow-hidden
      h-auto xl:h-[500px] flex
    ">
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_3fr] gap-0 w-full h-full">

        {/* ── Image ──────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden h-64 xl:h-[500px]">
          <img
            src={
              hotel.imageUrls?.[0] ??
              "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80"
            }
            className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            alt={hotel.name}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80";
            }}
          />

          {/* Gradient scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10 pointer-events-none" />

          {/* Top-left: price + featured + source badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {hasPrice ? (
              <div className={`
                ${isExternal ? "bg-emerald-600" : "bg-teal-700"}
                text-white text-sm font-bold rounded-full px-3 py-1 shadow
              `}>
                {formattedPrice}<span className="font-normal opacity-80">/night</span>
              </div>
            ) : (
              <div className="bg-gray-700/80 text-white text-xs font-medium rounded-full px-3 py-1">
                Price on request
              </div>
            )}

            {hotel.isFeatured && (
              <div className="bg-amber-500 text-white text-xs font-bold rounded-full px-3 py-1">
                ⭐ Featured
              </div>
            )}

            {isExternal && (
              <div className="bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-bold rounded-full px-3 py-1">
                🌍 Worldwide
              </div>
            )}
          </div>

          {/* Top-right: star rating */}
          <div className="absolute top-3 right-3">
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shadow">
              <AiFillStar className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-sm font-semibold text-gray-800">{hotel.starRating ?? 0}</span>
            </div>
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────── */}
        <div className="p-6 flex flex-col justify-between h-auto xl:h-full">
          <div className="space-y-3.5 flex-1">

            {/* Stars + type chips + source badge */}
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="flex gap-0.5">
                {Array.from({ length: Math.min(hotel.starRating ?? 0, 5) }).map((_, i) => (
                  <AiFillStar key={i} className="w-3.5 h-3.5 text-amber-400" />
                ))}
              </span>
              {(Array.isArray(hotel.type) ? hotel.type.slice(0, 3) : [hotel.type])
                .filter(Boolean)
                .map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="text-xs px-2 py-0.5 border-teal-200 text-teal-700 bg-teal-50"
                  >
                    {t}
                  </Badge>
                ))}
              {isExternal && (
                <Badge className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                  External
                </Badge>
              )}
            </div>

            {/* Hotel name */}
            <Link
              to={detailUrl}
              className="text-xl font-bold text-gray-900 hover:text-teal-700 transition-colors leading-snug block"
            >
              {hotel.name}
            </Link>

            {/* Location */}
            <div className="flex items-center gap-1 text-gray-500">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-sm">{hotel.city}, {hotel.country}</span>
            </div>

            {/* Description */}
            <p className="text-gray-500 text-sm leading-relaxed line-clamp-3">
              {hotel.description}
            </p>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
              {(hotel.totalBookings ?? 0) > 0 && !isExternal && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {hotel.totalBookings} bookings
                </span>
              )}
              {(hotel.averageRating ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <AiFillStar className="w-3.5 h-3.5 text-amber-400" />
                  {hotel.averageRating!.toFixed(1)} rating
                  {isExternal && hotel.reviewCount ? ` (${hotel.reviewCount.toLocaleString()})` : ""}
                </span>
              )}
            </div>
          </div>

          {/* Facilities */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Amenities
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(hotel.facilities ?? []).slice(0, 5).map((facility) => {
                const Icon = getFacilityIcon(facility);
                return (
                  <span
                    key={facility}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 bg-gray-50"
                  >
                    <Icon className="w-3 h-3 text-teal-600" />
                    {facility}
                  </span>
                );
              })}
            </div>
          </div>

          {/* CTA button */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            {isExternal ? (
              <Link
                to={detailUrl}
                className="
                  w-full flex items-center justify-center gap-2
                  bg-gradient-to-r from-emerald-600 to-teal-600
                  hover:from-emerald-700 hover:to-teal-700
                  text-white text-sm font-semibold py-2.5 px-5 rounded-xl
                  transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20
                  active:scale-[0.98]
                "
              >
                <CreditCard className="w-4 h-4" />
                View Details · Pay at Hotel
              </Link>
            ) : (
              <Link
                to={detailUrl}
                className="
                  w-full flex items-center justify-center gap-2
                  bg-gradient-to-r from-teal-600 to-teal-700
                  hover:from-teal-700 hover:to-teal-800
                  text-white text-sm font-semibold py-2.5 px-5 rounded-xl
                  transition-all duration-200 hover:shadow-lg hover:shadow-teal-500/20
                  active:scale-[0.98]
                "
              >
                View Details & Book
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Window type augmentation
declare global {
  interface Window { __externalHotelCache?: Record<string, any>; }
}

export default SearchResultsCard;