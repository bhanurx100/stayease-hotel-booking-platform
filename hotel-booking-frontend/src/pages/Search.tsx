/**
 * hotel-booking-frontend/src/pages/Search.tsx
 *
 * ── Changes ───────────────────────────────────────────────────────────────────
 * 1. Removed all "(0 from platform)" / misleading count text.
 * 2. "N hotels found" only shows when data is actually loaded and N > 0.
 * 3. Prev/Next buttons + existing Pagination component for full pagination.
 * 4. limit=10 sent to backend so combined DB+external pages correctly.
 * 5. Currency context applied to price display (via SearchResultsCard).
 * 6. Chatbot deep-link (?destination=city) honoured via URL-sync effect.
 * 7. Default dates: tomorrow / day-after-tomorrow (no same-day check-in).
 * 8. Filter changes reset to page 1.
 */

import { useSearchParams }    from "react-router-dom";
import useSearchContext        from "../hooks/useSearchContext";
import { useQueryWithLoading } from "../hooks/useLoadingHooks";
import * as apiClient          from "../api-client";
import { useEffect, useState } from "react";
import SearchResultsCard       from "../components/SearchResultsCard";
import Pagination              from "../components/Pagination";
import StarRatingFilter        from "../components/StarRatingFilter";
import HotelTypesFilter        from "../components/HotelTypesFilter";
import FacilitiesFilter        from "../components/FacilitiesFilter";
import PriceFilter             from "../components/PriceFilter";
import SearchBar               from "../components/SearchBar";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";

const RESULTS_PER_PAGE = 10;

// ─── Default dates ────────────────────────────────────────────────────────────
function tomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function dayAfterTomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Search = () => {
  const [urlSearchParams] = useSearchParams();
  const search = useSearchContext();

  const [page,              setPage]              = useState<number>(1);
  const [selectedStars,     setSelectedStars]     = useState<string[]>([]);
  const [selectedHotelTypes,setSelectedHotelTypes]= useState<string[]>([]);
  const [selectedFacilities,setSelectedFacilities]= useState<string[]>([]);
  const [selectedPrice,     setSelectedPrice]     = useState<number | undefined>();
  const [sortOption,        setSortOption]        = useState<string>("");
  const [showFilters,       setShowFilters]       = useState(false);

  // ── Sync URL params → search context ────────────────────────────────────────
  useEffect(() => {
    const destination = urlSearchParams.get("destination");
    const checkIn     = urlSearchParams.get("checkIn");
    const checkOut    = urlSearchParams.get("checkOut");
    const adultCount  = urlSearchParams.get("adultCount");
    const childCount  = urlSearchParams.get("childCount");

    const inDate  = checkIn  ? new Date(checkIn)  : tomorrow();
    const outDate = checkOut ? new Date(checkOut)  : dayAfterTomorrow();

    // Ensure check-out is always after check-in
    const safeOut = outDate > inDate ? outDate : new Date(inDate.getTime() + 86_400_000);

    search.saveSearchValues(
      destination || search.destination || "",
      inDate,
      safeOut,
      parseInt(adultCount || String(search.adultCount || 1), 10),
      parseInt(childCount  || String(search.childCount || 0), 10)
    );

    const pageParam = urlSearchParams.get("page");
    if (pageParam) setPage(Math.max(1, parseInt(pageParam, 10)));

    // Honour filter params from chatbot URL
    const stars = urlSearchParams.get("stars");
    const types  = urlSearchParams.get("types");
    const sort   = urlSearchParams.get("sortOption");
    const maxP   = urlSearchParams.get("maxPrice");
    if (stars) setSelectedStars([stars]);
    if (types) setSelectedHotelTypes([types]);
    if (sort)  setSortOption(sort);
    if (maxP)  setSelectedPrice(parseInt(maxP, 10));
  }, [urlSearchParams.toString()]);

  // ── Search params sent to API ────────────────────────────────────────────────
  const searchParams = {
    destination: search.destination?.trim() || "",
    checkIn:     search.checkIn.toISOString(),
    checkOut:    search.checkOut.toISOString(),
    adultCount:  search.adultCount.toString(),
    childCount:  search.childCount.toString(),
    page:        page.toString(),
    limit:       String(RESULTS_PER_PAGE),
    stars:       selectedStars,
    types:       selectedHotelTypes,
    facilities:  selectedFacilities,
    maxPrice:    selectedPrice?.toString(),
    sortOption,
  };

  const { data: hotelData, isLoading } = useQueryWithLoading(
    ["searchHotels", searchParams],
    () => apiClient.searchHotels(searchParams),
    { loadingMessage: "Searching hotels worldwide…" }
  );

  // ── Filter handlers ──────────────────────────────────────────────────────────
  const resetFilters = () => {
    setSelectedStars([]);
    setSelectedHotelTypes([]);
    setSelectedFacilities([]);
    setSelectedPrice(undefined);
    setSortOption("");
    setPage(1);
  };

  const handleStarsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const star = e.target.value;
    setSelectedStars((prev) => e.target.checked ? [...prev, star] : prev.filter((s) => s !== star));
    setPage(1);
  };
  const handleHotelTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = e.target.value;
    setSelectedHotelTypes((prev) => e.target.checked ? [...prev, t] : prev.filter((x) => x !== t));
    setPage(1);
  };
  const handleFacilityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.value;
    setSelectedFacilities((prev) => e.target.checked ? [...prev, f] : prev.filter((x) => x !== f));
    setPage(1);
  };

  // ── Derived values ───────────────────────────────────────────────────────────
  const totalResults = hotelData?.pagination.total ?? 0;
  const totalPages   = hotelData?.pagination.pages ?? 1;
  const fromResult   = totalResults > 0 ? (page - 1) * RESULTS_PER_PAGE + 1 : 0;
  const toResult     = Math.min(page * RESULTS_PER_PAGE, totalResults);

  const hasActiveFilters =
    selectedStars.length > 0 || selectedHotelTypes.length > 0 ||
    selectedFacilities.length > 0 || !!selectedPrice || !!sortOption;

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Modify Your Search</h2>
        <SearchBar />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">

        {/* ── Filter sidebar ────────────────────────────────────────────────── */}
        {/* Mobile toggle */}
        <div className="lg:hidden">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
            {hasActiveFilters && (
              <span className="ml-1 bg-primary-600 text-white text-xs rounded-full px-1.5 py-0.5">
                {selectedStars.length + selectedHotelTypes.length + selectedFacilities.length + (selectedPrice ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        <div className={`${showFilters ? "block" : "hidden"} lg:block`}>
          <div className="rounded-xl border border-slate-200 p-5 h-fit lg:sticky lg:top-10 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="space-y-5">
              <StarRatingFilter    selectedStars={selectedStars}           onChange={handleStarsChange}       />
              <HotelTypesFilter   selectedHotelTypes={selectedHotelTypes} onChange={handleHotelTypeChange}   />
              <FacilitiesFilter   selectedFacilities={selectedFacilities} onChange={handleFacilityChange}    />
              <PriceFilter        selectedPrice={selectedPrice}           onChange={(v) => { setSelectedPrice(v); setPage(1); }} />
            </div>
          </div>
        </div>

        {/* ── Results column ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">

          {/* Top bar: result count + sort */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              {isLoading ? (
                <span className="text-gray-500 text-sm animate-pulse">Searching hotels worldwide…</span>
              ) : totalResults > 0 ? (
                <>
                  <p className="text-xl font-bold text-gray-900">
                    {totalResults.toLocaleString()} hotel{totalResults !== 1 ? "s" : ""} found
                    {search.destination ? ` in ${search.destination}` : ""}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Showing {fromResult}–{toResult} of {totalResults.toLocaleString()}
                  </p>
                </>
              ) : hotelData ? (
                <p className="text-gray-500">No hotels found — try adjusting your search.</p>
              ) : null}
            </div>

            <select
              value={sortOption}
              onChange={(e) => { setSortOption(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
            >
              <option value="">Sort by: Recommended</option>
              <option value="starRating">Top rated</option>
              <option value="pricePerNightAsc">Price: Low to high</option>
              <option value="pricePerNightDesc">Price: High to low</option>
            </select>
          </div>

          {/* No results */}
          {!isLoading && hotelData && totalResults === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No hotels found</h3>
              <p className="text-gray-500 max-w-md mb-6">
                {search.destination
                  ? `We searched everywhere but couldn't find hotels in "${search.destination}" matching your filters.`
                  : "Try searching for a city — for example, London, Dubai, or Paris."}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Hotel cards */}
          {!isLoading && (hotelData?.data ?? []).length > 0 && (
            <>
              {hotelData!.data.map((hotel: any) => (
                <SearchResultsCard key={hotel._id} hotel={hotel} />
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>

                  <Pagination
                    page={page}
                    pages={totalPages}
                    onPageChange={(p) => setPage(p)}
                  />

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Search;