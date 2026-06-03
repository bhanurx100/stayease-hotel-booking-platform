import React, { memo, Suspense, lazy } from "react";
import type { MapNearbyPlace } from "../Map";
import {
  Utensils, ShoppingBag, Train, Plane, Navigation, MapPin, Star, Clock,
} from "lucide-react";
import { categorizeTransport, estimateTravelTime } from "../../lib/hotel-detail-utils";

const MapComponent = lazy(() => import("../Map"));

function toMapPlaces(items: NearbyPlace[], defaultType: string): MapNearbyPlace[] {
  return items.map((p) => ({
    name: p.name,
    type: p.type ?? defaultType,
    vicinity: p.vicinity ?? "",
    rating: p.rating,
    placeId: p.placeId,
  }));
}

export interface NearbyPlace {
  name: string;
  type?: string;
  vicinity?: string;
  rating?: number;
  distance?: string;
  placeId?: string;
}

export interface LocationSectionProps {
  lat: number;
  lng: number;
  hotelName: string;
  address: string;
  nearby: {
    restaurants?: NearbyPlace[];
    shopping?: NearbyPlace[];
    transport?: NearbyPlace[];
    attractions?: NearbyPlace[];
  } | null;
}

interface PlaceCardProps {
  place: NearbyPlace;
  icon: React.ComponentType<{ className?: string }>;
}

const PlaceCard = memo(({ place, icon: Icon }: PlaceCardProps) => {
  const travel = estimateTravelTime(place.distance);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${place.name} ${place.vicinity ?? ""}`
  )}`;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 p-3 rounded-xl border border-gray-100 hover:border-teal-200 hover:bg-teal-50/30 transition-colors min-w-0"
    >
      <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-teal-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{place.name}</p>
        {place.vicinity && <p className="text-xs text-gray-500 truncate">{place.vicinity}</p>}
        <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
          {place.distance && (
            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{place.distance}</span>
          )}
          {travel && (
            <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{travel}</span>
          )}
          {place.rating != null && (
            <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
              <Star className="w-3 h-3 fill-amber-400" />{place.rating}
            </span>
          )}
        </div>
      </div>
    </a>
  );
});
PlaceCard.displayName = "PlaceCard";

const LocationSection = memo(({ lat, lng, hotelName, address, nearby }: LocationSectionProps) => {
  const restaurants = nearby?.restaurants ?? [];
  const shopping = nearby?.shopping ?? [];
  const transport = nearby?.transport ?? [];
  const attractions = nearby?.attractions ?? [];

  const metro = transport.filter((p) => categorizeTransport(p) === "metro");
  const airports = transport.filter((p) => categorizeTransport(p) === "airport");
  const otherTransport = transport.filter((p) => categorizeTransport(p) === "transport");

  const categories: {
    key: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    items: NearbyPlace[];
  }[] = [
    { key: "restaurants", label: "Restaurants", icon: Utensils, items: restaurants },
    { key: "shopping", label: "Shopping", icon: ShoppingBag, items: shopping },
    { key: "metro", label: "Metro & transit", icon: Train, items: [...metro, ...otherTransport] },
    { key: "airport", label: "Airport", icon: Plane, items: airports },
    { key: "attractions", label: "Tourist attractions", icon: Navigation, items: attractions },
  ].filter((c) => c.items.length > 0);

  return (
    <section id="section-location" className="space-y-4">
      <Suspense
        fallback={
          <div className="bg-white rounded-2xl border border-gray-100 h-[280px] flex items-center justify-center text-gray-400">
            <MapPin className="w-8 h-8 animate-pulse" />
          </div>
        }
      >
        <MapComponent
          lat={lat}
          lng={lng}
          hotelName={hotelName}
          address={address}
          nearby={{
            restaurants: toMapPlaces(restaurants, "restaurant"),
            attractions: toMapPlaces(attractions, "attraction"),
            transport: toMapPlaces(transport, "transport"),
            shopping: toMapPlaces(shopping, "shopping"),
          }}
        />
      </Suspense>

      {categories.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Location experience</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categories.map(({ key, label, icon, items }) => (
              <div key={key}>
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  {React.createElement(icon, { className: "w-4 h-4 text-teal-600" })}
                  {label}
                </h3>
                <div className="space-y-2">
                  {items.slice(0, 4).map((place, i) => (
                    <PlaceCard key={`${key}-${i}`} place={place} icon={icon} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
});
LocationSection.displayName = "LocationSection";

export default LocationSection;
