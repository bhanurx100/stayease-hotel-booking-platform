/**
 * hotel-booking-frontend/src/components/PopularCities.tsx
 *
 * Booking.com-style popular cities grid shown on the Home page.
 * Clicking a city navigates to /search?destination=<city> with
 * tomorrow/day-after-tomorrow as default dates so results load immediately.
 */

import { useNavigate } from "react-router-dom";
import useSearchContext from "../hooks/useSearchContext";

// ─── City data ────────────────────────────────────────────────────────────────

const CITIES = [
  {
    name:    "London",
    country: "United Kingdom",
    label:   "1,200+ hotels",
    image:   "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80",
  },
  {
    name:    "Paris",
    country: "France",
    label:   "980+ hotels",
    image:   "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80",
  },
  {
    name:    "Dubai",
    country: "UAE",
    label:   "750+ hotels",
    image:   "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80",
  },
  {
    name:    "New York",
    country: "USA",
    label:   "1,500+ hotels",
    image:   "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80",
  },
  {
    name:    "Tokyo",
    country: "Japan",
    label:   "890+ hotels",
    image:   "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80",
  },
  {
    name:    "Mumbai",
    country: "India",
    label:   "620+ hotels",
    image:   "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=600&q=80",
  },
  {
    name:    "Delhi",
    country: "India",
    label:   "540+ hotels",
    image:   "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=600&q=80",
  },
  {
    name:    "Barcelona",
    country: "Spain",
    label:   "480+ hotels",
    image:   "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=600&q=80",
  },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultCheckIn(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function defaultCheckOut(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Component ────────────────────────────────────────────────────────────────

const PopularCities = () => {
  const navigate = useNavigate();
  const search   = useSearchContext();

  const handleCityClick = (cityName: string) => {
    const checkIn  = defaultCheckIn();
    const checkOut = defaultCheckOut();

    // Save to search context so SearchBar pre-fills correctly
    search.saveSearchValues(cityName, checkIn, checkOut, 2, 0);

    // Navigate with query params so the URL is shareable
    const params = new URLSearchParams({
      destination: cityName,
      checkIn:     checkIn.toISOString(),
      checkOut:    checkOut.toISOString(),
      adultCount:  "2",
      childCount:  "0",
    });
    navigate(`/search?${params.toString()}`);
  };

  return (
    <section className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Section header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">
          Popular destinations
        </h2>
        <p className="text-gray-500 mt-1">
          Travellers searching for hotels worldwide are booking these right now
        </p>
      </div>

      {/* City grid — 4 cols desktop, 2 tablet, 1 mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CITIES.map((city) => (
          <button
            key={city.name}
            onClick={() => handleCityClick(city.name)}
            className="
              group relative overflow-hidden rounded-2xl
              shadow-soft hover:shadow-large
              transition-all duration-300 hover:scale-[1.02]
              text-left focus:outline-none focus:ring-2 focus:ring-primary-400
            "
            style={{ aspectRatio: "4/3" }}
            aria-label={`Search hotels in ${city.name}`}
          >
            {/* Background image */}
            <img
              src={city.image}
              alt={city.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

            {/* Text */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-white font-bold text-xl leading-tight">
                {city.name}
              </p>
              <p className="text-white/80 text-sm mt-0.5">{city.country}</p>
              <span className="inline-block mt-2 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                {city.label}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};

export default PopularCities;