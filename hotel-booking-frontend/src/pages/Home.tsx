/**
 * hotel-booking-frontend/src/pages/Home.tsx
 *
 * ── Changes ───────────────────────────────────────────────────────────────────
 * 1. Added <PopularCities> section below LatestDestinations.
 * 2. Everything else (Hero, hotel grid, handleSearch) is unchanged.
 */

import { useQuery }          from "react-query";
import * as apiClient        from "../api-client";
import LatestDestinationCard from "../components/LastestDestinationCard";
import Hero                  from "../components/Hero";
import PopularCities         from "../components/PopularCities";

const Home = () => {
  const { data: hotels } = useQuery("fetchQuery", () => apiClient.fetchHotels());

  const handleSearch = (searchData: any) => {
    console.log("Search initiated with:", searchData);
  };

  return (
    <>
      <Hero onSearch={handleSearch} />

      <div className="space-y-0">
        {/* ── Latest Destinations (existing) ─────────────────────────────── */}
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Latest Destinations</h2>
            <p className="text-gray-600">Most recently added properties by our hosts</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {hotels?.map((hotel) => (
              <LatestDestinationCard key={hotel._id} hotel={hotel} />
            ))}
          </div>
        </div>

        {/* ── Popular Cities (NEW Booking.com-style grid) ──────────────────── */}
        <PopularCities />
      </div>
    </>
  );
};

export default Home;