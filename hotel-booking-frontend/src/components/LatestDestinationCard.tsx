/**
 * hotel-booking-frontend/src/components/LatestDestinationCard.tsx
 *
 * Used by Home.tsx to render hotel cards in "Top Stays" and "Newly Listed" sections.
 * These are ALWAYS DB hotels — pricePerNight is stored as raw INR in MongoDB.
 *
 * ── Currency rule ─────────────────────────────────────────────────────────────
 * ALWAYS uses formatINR() — never format() or formatExternal().
 * DB hotel prices are already in INR. No conversion, no multiplication.
 * formatINR(1200) → "₹1,200" regardless of user's selected display currency.
 *
 * ── No source detection needed ────────────────────────────────────────────────
 * This component is only ever used for DB hotels on the Home page.
 * If you need to display external hotels, use SearchResultsCard instead.
 */

import { Link }       from "react-router-dom";
import { AiFillStar } from "react-icons/ai";
import { MapPin }     from "lucide-react";
import { useCurrency } from "../contexts/CurrencyContext";

interface HotelCardProps {
  hotel: {
    _id:           any;
    name:          string;
    city:          string;
    country:       string;
    description?:  string;
    imageUrls?:    string[];
    pricePerNight: number;
    starRating?:   number;
    averageRating?: number;
    reviewCount?:  number;
    facilities?:   string[];
    type?:         string | string[];
    isFeatured?:   boolean;
  };
}

const LatestDestinationCard = ({ hotel }: HotelCardProps) => {
  // ── formatINR: always ₹, never converts, never multiplies ────────────────
  const { formatINR } = useCurrency();

  const imageUrl = hotel.imageUrls?.[0]
    ?? "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80";

  const rating    = hotel.averageRating ?? 0;
  const ratingOut = rating > 0 ? (rating * 2).toFixed(1) : null;

  return (
    <Link
      to={`/detail/${hotel._id}`}
      className="group block bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg hover:border-teal-100 transition-all duration-300"
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={imageUrl}
          alt={hotel.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80";
          }}
        />

        {/* Price badge — always ₹ (formatINR), no conversion */}
        {hotel.pricePerNight > 0 && (
          <div className="absolute top-3 left-3 bg-teal-700 text-white text-sm font-bold px-3 py-1 rounded-full shadow">
            {formatINR(hotel.pricePerNight)}
            <span className="font-normal opacity-80">/night</span>
          </div>
        )}

        {hotel.isFeatured && (
          <div className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            ⭐ Featured
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Stars */}
        {(hotel.starRating ?? 0) > 0 && (
          <div className="flex items-center gap-1 mb-1">
            {Array.from({ length: Math.min(hotel.starRating!, 5) }).map((_, i) => (
              <AiFillStar key={i} className="w-3.5 h-3.5 text-amber-400" />
            ))}
          </div>
        )}

        {/* Name */}
        <h3 className="text-base font-bold text-gray-900 group-hover:text-teal-700 transition-colors leading-snug line-clamp-1">
          {hotel.name}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1 mt-1 text-gray-500">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs">{hotel.city}, {hotel.country}</span>
        </div>

        {/* Description */}
        {hotel.description && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
            {hotel.description}
          </p>
        )}

        {/* Footer: rating + price repeat */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1">
            {ratingOut ? (
              <>
                <AiFillStar className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-gray-700">{ratingOut}</span>
                {(hotel.reviewCount ?? 0) > 0 && (
                  <span className="text-xs text-gray-400">({hotel.reviewCount})</span>
                )}
              </>
            ) : (
              <span className="text-xs text-gray-400">No ratings yet</span>
            )}
          </div>

          {/* Price always ₹ INR */}
          <span className="text-sm font-bold text-teal-700">
            {hotel.pricePerNight > 0
              ? `${formatINR(hotel.pricePerNight)}/night`
              : "Price on request"}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default LatestDestinationCard;