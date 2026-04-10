/**
 * hotel-booking-frontend/src/components/SearchResultsCard.tsx
 *
 * ── What changed vs. the original ────────────────────────────────────────────
 *
 * 1. The props type is extended (NOT replaced) with optional fields
 *    `source`, `bookingUrl`, and `bookingHotelId` that the backend now sends.
 *    HotelType itself is not modified.
 *
 * 2. When hotel.source === "external" (Booking.com result):
 *    a. An orange "Booking.com" badge appears on the image and next to the type chips.
 *    b. The hotel name is plain text — no <Link> (no local detail page exists).
 *    c. The price badge shows "£X / night" when price > 0, or "Contact for price".
 *    d. The review count shows "(X Booking.com reviews)".
 *    e. The action button is a styled "View on Booking.com" anchor (new tab).
 *
 * 3. When hotel.source === "db" (or source is absent) every pixel renders
 *    exactly as before — zero behaviour change for existing hotels.
 *
 * All original imports, the getFacilityIcon helper, the image section logic,
 * the description, facilities section, and "View Details & Book" button are
 * entirely unchanged for DB hotels.
 */

import { Link } from "react-router-dom";
import { HotelType } from "../../../shared/types";
import { AiFillStar } from "react-icons/ai";
import {
  MapPin,
  Building2,
  Users,
  Wifi,
  Car,
  Waves,
  Dumbbell,
  Sparkles,
  UtensilsCrossed,
  Coffee,
  Plane,
  Building,
  ExternalLink, // ← new icon for Booking.com button
} from "lucide-react";
import { Badge } from "./ui/badge";

// ─── Extended prop type ────────────────────────────────────────────────────────
// Extends HotelType so all existing code that passes a plain HotelType still
// compiles — the new fields are fully optional.
type HotelWithSource = HotelType & {
  source?: "db" | "external";
  bookingUrl?: string;
  bookingHotelId?: number;
};

type Props = {
  hotel: HotelWithSource;
};
// ──────────────────────────────────────────────────────────────────────────────

const SearchResultsCard = ({ hotel }: Props) => {
  // ── Compute once so branches below stay readable ───────────────────────────
  const isExternal   = hotel.source === "external";
  const bookingUrl   = hotel.bookingUrl;
  const hasPrice     = hotel.pricePerNight > 0;

  // ── UNCHANGED helper ────────────────────────────────────────────────────────
  const getFacilityIcon = (facility: string) => {
    const iconMap: { [key: string]: any } = {
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
    return iconMap[facility] || Building2;
  };

  return (
    <div className="group bg-white rounded-2xl shadow-soft hover:shadow-large transition-all duration-300 border border-gray-100 overflow-hidden h-auto xl:h-[500px] flex">
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_3fr] gap-0 w-full h-full">

        {/* ── Image section ─────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden h-64 xl:h-[500px]">
          <img
            src={hotel.imageUrls[0]}
            className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
            alt={hotel.name}
          />

          {/* Top-left overlay badges */}
          <div className="absolute top-4 left-4 flex flex-col space-y-2">

            {/* ── CHANGE: price badge — context-aware for external hotels ─── */}
            {isExternal ? (
              hasPrice ? (
                <div className="bg-blue-700 text-white rounded-full px-3 py-1">
                  <span className="text-sm font-bold">£{hotel.pricePerNight}/night</span>
                </div>
              ) : (
                <div className="bg-gray-600/80 text-white rounded-full px-3 py-1">
                  <span className="text-xs font-medium">Contact for price</span>
                </div>
              )
            ) : (
              /* UNCHANGED: original price badge for DB hotels */
              <div className="bg-primary-600 text-white rounded-full px-3 py-1">
                <span className="text-sm font-bold">£{hotel.pricePerNight}</span>
              </div>
            )}

            {/* UNCHANGED: featured badge */}
            {hotel.isFeatured && (
              <div className="bg-yellow-500 text-white rounded-full px-3 py-1">
                <span className="text-xs font-bold">Featured</span>
              </div>
            )}

            {/* ── CHANGE: Booking.com source badge on image ────────────────── */}
            {isExternal && (
              <div className="bg-blue-600 text-white rounded-full px-3 py-1 flex items-center gap-1">
                <span className="text-xs font-bold">🏨 Booking.com</span>
              </div>
            )}
          </div>

          {/* UNCHANGED: star rating badge top-right */}
          <div className="absolute top-4 right-4">
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 flex items-center space-x-1">
              <AiFillStar className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-semibold text-gray-800">
                {hotel.starRating}
              </span>
            </div>
          </div>
        </div>

        {/* ── Content section ───────────────────────────────────────────────── */}
        <div className="p-6 flex flex-col justify-between h-auto xl:h-full overflow-hidden">
          <div className="space-y-4 overflow-y-auto xl:flex-1">

            {/* Header row: stars + type badges + optional source badge */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">

                  {/* UNCHANGED: star icons */}
                  <span className="flex">
                    {Array.from({ length: hotel.starRating }).map((_, i) => (
                      <AiFillStar key={i} className="w-4 h-4 text-yellow-400" />
                    ))}
                  </span>

                  {/* UNCHANGED: type chips */}
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(hotel.type) ? (
                      hotel.type.slice(0, 4).map((type) => (
                        <Badge key={type} variant="default" className="text-xs px-2 py-1">
                          {type}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="default" className="text-xs px-2 py-1">
                        {hotel.type}
                      </Badge>
                    )}
                  </div>

                  {/* ── CHANGE: inline Booking.com label next to type chips ── */}
                  {isExternal && (
                    <Badge className="text-xs px-2 py-1 bg-blue-100 text-blue-800 border border-blue-200">
                      Booking.com
                    </Badge>
                  )}
                </div>
              </div>

              {/* ── CHANGE: hotel name — plain text for external (no local page) */}
              {isExternal ? (
                <p className="text-2xl font-bold text-gray-900">{hotel.name}</p>
              ) : (
                /* UNCHANGED: clickable link for DB hotels */
                <Link
                  to={`/detail/${hotel._id}`}
                  className="text-2xl font-bold text-gray-900 hover:text-primary-600 transition-colors cursor-pointer"
                >
                  {hotel.name}
                </Link>
              )}

              {/* UNCHANGED: location */}
              <div className="flex items-center text-gray-600">
                <MapPin className="w-4 h-4 mr-1" />
                <span className="text-sm">
                  {hotel.city}, {hotel.country}
                </span>
              </div>
            </div>

            {/* UNCHANGED: description */}
            <div className="text-gray-600 leading-relaxed line-clamp-3">
              {hotel.description}
            </div>

            {/* Hotel stats row */}
            <div className="flex items-center space-x-6 text-sm text-gray-600 flex-wrap gap-y-1">

              {/* UNCHANGED: booking count (only shown for DB hotels that have bookings) */}
              {hotel.totalBookings !== undefined && hotel.totalBookings > 0 && (
                <div className="flex items-center space-x-1">
                  <Users className="w-4 h-4" />
                  <span>{hotel.totalBookings} bookings</span>
                </div>
              )}

              {/* UNCHANGED: average rating */}
              <div className="flex items-center space-x-1">
                <AiFillStar className="w-4 h-4 text-yellow-400" />
                <span>
                  {hotel.averageRating && hotel.averageRating > 0
                    ? `${hotel.averageRating.toFixed(1)} avg rating`
                    : "No ratings yet"}
                  {/* ── CHANGE: label source of rating for external ── */}
                  {isExternal && (hotel.averageRating ?? 0) > 0 && " (Booking.com)"}
                </span>
              </div>

              {/* ── CHANGE: show Booking.com review count for external results ── */}
              {isExternal && (hotel.reviewCount ?? 0) > 0 && (
                <span className="text-xs text-gray-500">
                  ({(hotel.reviewCount ?? 0).toLocaleString()} reviews)
                </span>
              )}
            </div>
          </div>

          {/* UNCHANGED: facilities / amenities section */}
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Key Amenities
            </h4>
            <div className="flex flex-wrap gap-2">
              {hotel.facilities.slice(0, 6).map((facility) => {
                const IconComponent = getFacilityIcon(facility);
                return (
                  <Badge
                    key={facility}
                    variant="outline"
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs"
                  >
                    <IconComponent className="w-3 h-3 text-primary-600" />
                    <span>{facility}</span>
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* ── Action button — the only conditional branch ───────────────────── */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            {isExternal ? (
              /*
               * CHANGE: External hotels redirect to Booking.com.
               * Opens in a new tab; no internal routing involved so the
               * existing booking flow is completely untouched.
               */
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 transition-all duration-200"
              >
                <ExternalLink className="w-4 h-4" />
                View on Booking.com
              </a>
            ) : (
              /* UNCHANGED: internal detail / booking page for DB hotels */
              <Link
                to={`/detail/${hotel._id}`}
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

export default SearchResultsCard;