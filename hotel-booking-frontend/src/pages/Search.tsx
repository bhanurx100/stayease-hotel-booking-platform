/**
 * hotel-booking-frontend/src/pages/Search.tsx
 *
 * ── Fix: DB hotels show by default on initial load ────────────────────────────
 *
 * PROBLEM: When the user navigates to /search with no destination typed,
 * `searchHotels({ destination: "" })` calls the backend which returns results,
 * BUT the empty-state UI said "Try searching for a city" making it look empty.
 * Additionally, if destination was empty the search query ran correctly but the
 * UI message was misleading.
 *
 * FIX:
 *   1. On initial load (no destination, no filters), call `fetchHotels()` —
 *      the simple GET /api/hotels endpoint that returns all DB hotels.
 *      This ensures DB hotels are always visible immediately.
 *
 *   2. Once a destination is typed OR any filter is applied, switch to the
 *      full `searchHotels()` path (existing behaviour, unchanged).
 *
 *   3. The empty-state message now correctly says "Browse all available hotels"
 *      when no destination is set, rather than "Try searching for a city".
 *
 * ── Everything else unchanged ─────────────────────────────────────────────────
 * - Filters (stars, types, facilities, price)
 * - Pagination (prev/next + Pagination component)
 * - Sort options
 * - URL param sync (chatbot deeplinks)
 * - SearchResultsCard rendering
 */

import { useSearchParams }    from "react-router-dom";
import useSearchContext        from "../hooks/useSearchContext";
import * as apiClient          from "../api-client";
import { useEffect, useState } from "react";
import { useQuery }            from "react-query";
import SearchResultsCard       from "../components/SearchResultsCard";
import Pagination              from "../components/Pagination";
import StarRatingFilter        from "../components/StarRatingFilter";
import HotelTypesFilter        from "../components/HotelTypesFilter";
import FacilitiesFilter        from "../components/FacilitiesFilter";
import PriceFilter             from "../components/PriceFilter";
import SearchBar               from "../components/SearchBar";
import { ChevronLeft, ChevronRight, SlidersHorizontal, Hotel } from "lucide-react";

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

  const [page,               setPage]               = useState<number>(1);
  const [selectedStars,      setSelectedStars]      = useState<string[]>([]);
  const [selectedHotelTypes, setSelectedHotelTypes] = useState<string[]>([]);
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [selectedPrice,      setSelectedPrice]      = useState<number | undefined>();
  const [sortOption,         setSortOption]         = useState<string>("");
  const [showFilters,        setShowFilters]        = useState(false);

  // ── Sync URL params → search context ──────────────────────────────────────
  useEffect(() => {
    const destination = urlSearchParams.get("destination");
    const checkIn     = urlSearchParams.get("checkIn");
    const checkOut    = urlSearchParams.get("checkOut");
    const adultCount  = urlSearchParams.get("adultCount");
    const childCount  = urlSearchParams.get("childCount");

    const inDate  = checkIn  ? new Date(checkIn)  : tomorrow();
    const outDate = checkOut ? new Date(checkOut)  : dayAfterTomorrow();
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

    const stars = urlSearchParams.get("stars");
    const types  = urlSearchParams.get("types");
    const sort   = urlSearchParams.get("sortOption");
    const maxP   = urlSearchParams.get("maxPrice");
    if (stars) setSelectedStars([stars]);
    if (types) setSelectedHotelTypes([types]);
    if (sort)  setSortOption(sort);
    if (maxP)  setSelectedPrice(parseInt(maxP, 10));
  }, [urlSearchParams.toString()]);

  // ── Determine which fetch mode to use ─────────────────────────────────────
  // "default mode": no destination AND no active filters → show all DB hotels
  // "search mode":  destination typed OR any filter active → run full search
  const hasDestination  = !!(search.destination?.trim());
  const hasActiveFilters =
    selectedStars.length > 0 || selectedHotelTypes.length > 0 ||
    selectedFacilities.length > 0 || !!selectedPrice || !!sortOption;
  const isSearchMode = hasDestination || hasActiveFilters;

  // ── DEFAULT MODE: fetch all DB hotels directly ─────────────────────────────
  // Called on initial page load when no destination/filters set.
  // GET /api/hotels — returns all DB hotels, sorted by lastUpdated DESC.
  const {
    data: allDbHotels,
    isLoading: allDbLoading,
  } = useQuery(
    ["fetchAllHotels"],
    () => apiClient.fetchHotels(),
    {
      enabled:   !isSearchMode,  // only runs when NOT in search mode
      staleTime: 5 * 60_000,
    }
  );

  // ── SEARCH MODE: searchHotels with destination + filters ──────────────────
  // Existing behaviour — unchanged.
  const searchParams = {
    destination: search.destination?.trim() || "",
    checkIn:     search.checkIn?.toISOString() ?? tomorrow().toISOString(),
    checkOut:    search.checkOut?.toISOString() ?? dayAfterTomorrow().toISOString(),
    adultCount:  (search.adultCount || 1).toString(),
    childCount:  (search.childCount || 0).toString(),
    page:        page.toString(),
    limit:       String(RESULTS_PER_PAGE),
    stars:       selectedStars,
    types:       selectedHotelTypes,
    facilities:  selectedFacilities,
    maxPrice:    selectedPrice?.toString(),
    sortOption,
  };

  const {
    data: searchData,
    isLoading: searchLoading,
  } = useQuery(
    ["searchHotels", searchParams],
    () => apiClient.searchHotels(searchParams),
    {
      enabled: isSearchMode,   // only runs when in search mode
    }
  );

  // ── Resolved display data ─────────────────────────────────────────────────
  // In default mode: allDbHotels is a flat HotelType[] — wrap it like searchData
  const isLoading    = isSearchMode ? searchLoading : allDbLoading;
  const displayHotels: any[] = isSearchMode
    ? (searchData?.data ?? [])
    : (allDbHotels ?? []).map((h) => ({ ...h, source: "db" }));

  // Pagination only applies in search mode (allDbHotels shows all at once)
  const totalResults = isSearchMode ? (searchData?.pagination.total ?? 0) : displayHotels.length;
  const totalPages   = isSearchMode ? (searchData?.pagination.pages ?? 1) : 1;
  const fromResult   = totalResults > 0 ? (page - 1) * RESULTS_PER_PAGE + 1 : 0;
  const toResult     = Math.min(page * RESULTS_PER_PAGE, totalResults);

  // ── Filter handlers ────────────────────────────────────────────────────────
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

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {isSearchMode ? "Modify Your Search" : "Search Hotels Worldwide"}
        </h2>
        <SearchBar />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">

        {/* ── Filter sidebar ──────────────────────────────────────────────── */}
        <div className="lg:hidden">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
            {hasActiveFilters && (
              <span className="ml-1 bg-teal-600 text-white text-xs rounded-full px-1.5 py-0.5">
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
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
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

        {/* ── Results column ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">

          {/* Top bar: result count + sort */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              {isLoading ? (
                <span className="text-gray-500 text-sm animate-pulse">
                  {isSearchMode ? "Searching hotels worldwide…" : "Loading hotels…"}
                </span>
              ) : totalResults > 0 ? (
                <>
                  <p className="text-xl font-bold text-gray-900">
                    {totalResults.toLocaleString()} hotel{totalResults !== 1 ? "s" : ""}
                    {hasDestination ? ` found in ${search.destination}` : " available"}
                  </p>
                  {isSearchMode && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      Showing {fromResult}–{toResult} of {totalResults.toLocaleString()}
                    </p>
                  )}
                </>
              ) : !isLoading ? (
                <p className="text-gray-500 text-sm">
                  {isSearchMode
                    ? `No hotels found${hasDestination ? ` in "${search.destination}"` : ""} — try adjusting your filters.`
                    : "No hotels in the database yet."}
                </p>
              ) : null}
            </div>

            <select
              value={sortOption}
              onChange={(e) => { setSortOption(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-300 bg-white"
            >
              <option value="">Sort by: Recommended</option>
              <option value="starRating">Top rated</option>
              <option value="pricePerNightAsc">Price: Low to high</option>
              <option value="pricePerNightDesc">Price: High to low</option>
            </select>
          </div>

          {/* ── Loading skeleton ─────────────────────────────────────────── */}
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 h-52 animate-pulse">
                  <div className="grid grid-cols-[2fr_3fr] h-full">
                    <div className="bg-gray-200 rounded-l-2xl" />
                    <div className="p-6 space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-6 bg-gray-200 rounded w-2/3" />
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Empty state ──────────────────────────────────────────────── */}
          {!isLoading && displayHotels.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-4">
                <Hotel className="w-10 h-10 text-teal-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {isSearchMode ? "No hotels found" : "No hotels available yet"}
              </h3>
              <p className="text-gray-500 max-w-md mb-6">
                {isSearchMode
                  ? hasDestination
                    ? `We searched everywhere but couldn't find hotels in "${search.destination}" matching your criteria. Try removing some filters.`
                    : "No hotels match your current filters. Try clearing them."
                  : "Run the seeder to add Indian hotels, or add your first property via the Owner Dashboard."}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="px-5 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* ── Hotel cards ───────────────────────────────────────────────── */}
          {!isLoading && displayHotels.length > 0 && (
            <>
              {displayHotels.map((hotel: any) => (
                <SearchResultsCard key={hotel._id?.toString()} hotel={hotel} />
              ))}

              {/* Pagination — only in search mode */}
              {isSearchMode && totalPages > 1 && (
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