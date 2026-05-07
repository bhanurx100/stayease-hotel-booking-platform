/**
 * hotel-booking-frontend/src/components/Map.tsx
 *
 * Lazy-loaded map component — imported via React.lazy() in Detail.tsx
 * so it never blocks the initial page render.
 *
 * Uses Google Maps Static API (single <img> tag — no JS SDK needed).
 * When VITE_GOOGLE_MAPS_API_KEY is absent, falls back to an OpenStreetMap
 * iframe (no key required, always works).
 *
 * Wrapped with React.memo so it only re-renders when coords/nearby change.
 */

import React, { memo } from "react";
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
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`;
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
  const mapsLink = googleMapsLink(lat, lng, hotelName);
  const imgUrl   = staticMapUrl(lat, lng);
  const osmUrl   = openStreetMapUrl(lat, lng);

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

      {/* Map image */}
      {MAPS_KEY && imgUrl ? (
        /* Google Maps Static — single <img>, no JS SDK */
        <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={imgUrl}
            alt={`Map showing ${hotelName}`}
            className="w-full h-[260px] object-cover hover:opacity-90 transition-opacity"
            loading="lazy"
          />
        </a>
      ) : (
        /* OpenStreetMap fallback — no key needed */
        <div className="relative">
          <iframe
            src={osmUrl}
            title={`Map showing ${hotelName}`}
            className="w-full h-[260px] border-0"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin"
          />
          {/* Overlay link to open in Google Maps */}
          <a
            href={mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-3 right-3 bg-white text-teal-700 text-xs font-semibold px-3 py-1.5 rounded-lg shadow hover:bg-teal-50 border border-teal-200 transition-colors"
          >
            Open in Google Maps ↗
          </a>
        </div>
      )}

      {/* Coordinates pill */}
      <div className="flex items-center gap-1.5 px-6 py-2 border-b border-gray-100 text-xs text-gray-400">
        <MapPin className="w-3.5 h-3.5" />
        {lat.toFixed(5)}, {lng.toFixed(5)}
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