/**
 * hotel-booking-frontend/src/components/Map.tsx
 *
 * Fixed: safe coordinate validation, proper container height,
 * handles both DB hotels (coordinates from Google enrichment)
 * and external hotels (coordinates from aggregatorService).
 */

import React, { memo, useState, useEffect } from "react";
import { Navigation, MapPin, Utensils, Camera, Train, ShoppingBag } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MapNearbyPlace {
  name:      string;
  type:      string;
  vicinity:  string;
  rating?:   number;
  placeId?:  string;
}

export interface MapProps {
  lat:         number;
  lng:         number;
  hotelName:   string;
  address?:    string;
  nearby?: {
    restaurants: MapNearbyPlace[];
    attractions: MapNearbyPlace[];
    transport:   MapNearbyPlace[];
    shopping:    MapNearbyPlace[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAPS_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

/**
 * Validate that lat/lng are real, non-zero numbers.
 * Guards against null, undefined, 0, NaN, and string "0".
 */
function isValidCoord(lat: unknown, lng: unknown): boolean {
  const la = Number(lat);
  const lo = Number(lng);
  return (
    Number.isFinite(la) && Number.isFinite(lo) &&
    la >= -90 && la <= 90 &&
    lo >= -180 && lo <= 180 &&
    !(la === 0 && lo === 0)
  );
}

function staticMapUrl(lat: number, lng: number, zoom = 15): string {
  if (!MAPS_KEY) return "";
  const marker = `markers=color:teal|label:H|${lat},${lng}`;
  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lng}&zoom=${zoom}&size=800x400&maptype=roadmap` +
    `&${marker}&key=${MAPS_KEY}`
  );
}

function openStreetMapUrl(lat: number, lng: number): string {
  const delta = 0.01;
  return (
    `https://www.openstreetmap.org/export/embed.html` +
    `?bbox=${lng - delta},${lat - delta},${lng + delta},${lat + delta}` +
    `&layer=mapnik&marker=${lat},${lng}`
  );
}

function googleMapsLink(lat: number, lng: number, name: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}@${lat},${lng}`;
}

function nearbyMapsLink(name: string, vicinity: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${vicinity}`)}`;
}

const NEARBY_ICON: Record<string, React.ComponentType<any>> = {
  restaurant: Utensils,
  attraction: Camera,
  transport:  Train,
  shopping:   ShoppingBag,
};

const NEARBY_COLOR: Record<string, string> = {
  restaurant: "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100",
  attraction: "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100",
  transport:  "bg-blue-50   border-blue-200   text-blue-700   hover:bg-blue-100",
  shopping:   "bg-pink-50   border-pink-200   text-pink-700   hover:bg-pink-100",
};

// ─── Nearby chip ─────────────────────────────────────────────────────────────

const NearbyChip = memo(({ place }: { place: MapNearbyPlace }) => {
  const Icon   = NEARBY_ICON[place.type] ?? MapPin;
  const colors = NEARBY_COLOR[place.type] ?? "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100";
  return (
    <a
      href={nearbyMapsLink(place.name, place.vicinity)}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 border rounded-xl px-3 py-2 text-sm transition-colors cursor-pointer ${colors}`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-medium block truncate">{place.name}</span>
        {place.vicinity && (
          <span className="text-xs opacity-70 truncate block">{place.vicinity}</span>
        )}
      </div>
      {place.rating != null && (
        <span className="flex-shrink-0 text-xs font-bold">★ {place.rating}</span>
      )}
    </a>
  );
});
NearbyChip.displayName = "NearbyChip";

// ─── Main component ───────────────────────────────────────────────────────────

const Map = memo(({ lat, lng, hotelName, address, nearby }: MapProps) => {
  const [staticMapFailed, setStaticMapFailed] = useState(false);

  useEffect(() => {
    setStaticMapFailed(false);
  }, [lat, lng]);

  if (!isValidCoord(lat, lng)) {
    return null;
  }

  const safeLat  = Number(lat);
  const safeLng  = Number(lng);
  const mapsLink = googleMapsLink(safeLat, safeLng, hotelName);
  const imgUrl   = staticMapUrl(safeLat, safeLng);
  const osmUrl   = openStreetMapUrl(safeLat, safeLng);
  const useStaticMap = Boolean(MAPS_KEY && imgUrl && !staticMapFailed);

  const allNearby = [
    ...(nearby?.restaurants ?? []).slice(0, 3),
    ...(nearby?.attractions ?? []).slice(0, 3),
    ...(nearby?.transport   ?? []).slice(0, 2),
    ...(nearby?.shopping    ?? []).slice(0, 2),
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Location & Map</h2>
          {address && <p className="text-sm text-gray-500 mt-0.5">{address}</p>}
        </div>
        <a
          href={mapsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-teal-600 font-semibold hover:text-teal-700 border border-teal-200 px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-colors"
        >
          <Navigation className="w-4 h-4" /> Get Directions
        </a>
      </div>

      {/* Map — fixed height so it always renders visibly */}
      <div className="relative w-full min-h-[300px]" style={{ height: "300px" }}>
        {useStaticMap ? (
          <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="block h-full min-h-[300px]">
            <img
              src={imgUrl}
              alt={`Map showing ${hotelName}`}
              className="w-full h-full min-h-[300px] object-cover hover:opacity-90 transition-opacity"
              loading="lazy"
              onError={() => setStaticMapFailed(true)}
            />
          </a>
        ) : (
          <>
            <iframe
              src={osmUrl}
              title={`Map showing ${hotelName}`}
              className="absolute inset-0 w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-3 right-3 z-10 bg-white text-teal-700 text-xs font-semibold px-3 py-1.5 rounded-lg shadow hover:bg-teal-50 border border-teal-200 transition-colors"
            >
              Open in Google Maps ↗
            </a>
          </>
        )}
      </div>

      {/* Coordinates pill */}
      <div className="flex items-center gap-1.5 px-6 py-2 border-b border-gray-100 text-xs text-gray-400">
        <MapPin className="w-3.5 h-3.5" />
        {safeLat.toFixed(5)}, {safeLng.toFixed(5)}
      </div>

      {/* Nearby places */}
      {allNearby.length > 0 && (
        <div className="p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            What's nearby
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allNearby.map((place, i) => (
              <NearbyChip key={`${place.type}-${i}`} place={place} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

Map.displayName = "HotelMap";
export default Map;