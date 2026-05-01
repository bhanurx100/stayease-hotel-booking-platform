/**
 * hotel-booking-frontend/src/pages/Home.tsx
 *
 * ── Currency: ₹ everywhere on Home page ─────────────────────────────────────
 * All hotels shown on this page are DB hotels (fetched from MongoDB).
 * DB hotels store price in INR — always shown as ₹ via formatINR() inside
 * LatestDestinationCard. No external hotels are shown here.
 *
 * ── Two sections ─────────────────────────────────────────────────────────────
 * 1. Top Stays     → sorted by totalBookings DESC (most booked = most trusted)
 * 2. Newly Listed  → sorted by lastUpdated DESC (freshest additions)
 */

import { useQuery }          from "react-query";
import * as apiClient        from "../api-client";
import LatestDestinationCard from "../components/LatestDestinationCard";
import Hero                  from "../components/Hero";
import PopularCities         from "../components/PopularCities";
import { TrendingUp, Clock } from "lucide-react";

const Home = () => {
  const { data: allHotels = [], isLoading } = useQuery(
    "fetchHotelsHome",
    () => apiClient.fetchHotels(),
    { staleTime: 5 * 60 * 1_000 }
  );

  // Most booked → social proof
  const topStays = [...allHotels]
    .sort((a, b) => (b.totalBookings ?? 0) - (a.totalBookings ?? 0))
    .slice(0, 6);

  // Most recently added
  const newlyListed = [...allHotels]
    .sort((a, b) => {
      const dA = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
      const dB = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
      return dB - dA;
    })
    .slice(0, 6);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  const SkeletonCard = () => (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-2/3" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-4/5" />
      </div>
    </div>
  );

  return (
    <>
      <Hero />

      <div className="bg-gray-50">

        {/* ── Top Stays ────────────────────────────────────────────────────── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-teal-600" />
                <span className="text-xs font-bold uppercase tracking-widest text-teal-600">
                  Most Popular
                </span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 leading-tight">
                Top Stays on Stayease
              </h2>
              <p className="text-gray-500 mt-1">
                Our most-booked properties — loved by thousands of guests
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : topStays.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topStays.map((hotel) => (
                // LatestDestinationCard uses formatINR → always ₹
                <LatestDestinationCard key={hotel._id} hotel={hotel} />
              ))}
            </div>
          ) : !isLoading && allHotels.length === 0 ? null : (
            <p className="text-gray-400 text-sm">No bookings recorded yet.</p>
          )}
        </section>

        {/* Divider */}
        {topStays.length > 0 && newlyListed.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="border-t border-gray-200" />
          </div>
        )}

        {/* ── Newly Listed ─────────────────────────────────────────────────── */}
        {newlyListed.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
            <div className="flex items-end justify-between mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                    Just Added
                  </span>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 leading-tight">
                  Newly Listed Properties
                </h2>
                <p className="text-gray-500 mt-1">
                  Fresh arrivals — be among the first to discover them
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {newlyListed.map((hotel) => (
                <LatestDestinationCard key={hotel._id} hotel={hotel} />
              ))}
            </div>
          </section>
        )}

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {!isLoading && allHotels.length === 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
            <div className="text-5xl mb-4">🏨</div>
            <h3 className="text-xl font-semibold text-gray-700">No hotels listed yet</h3>
            <p className="text-gray-400 mt-2 max-w-md mx-auto">
              Run the seeder script to add Indian hotels, or add your first property via the Owner Dashboard.
            </p>
          </section>
        )}

        {/* ── Popular Cities ─────────────────────────────────────────────────── */}
        <PopularCities />
      </div>
    </>
  );
};

export default Home;