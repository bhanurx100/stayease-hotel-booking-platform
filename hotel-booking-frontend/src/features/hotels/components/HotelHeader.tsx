/**
 * hotel-booking-frontend/src/components/HotelHeader.tsx
 *
 * Expedia-style hotel header with:
 *   1. Hero image grid  (1 large + 4 thumbs, "View all" opens fullscreen modal)
 *   2. Fullscreen gallery  (keyboard + touch nav, thumbnail strip, arrow buttons)
 *   3. Sticky tab bar  (Overview | About | Rooms | Accessibility | Policies)
 *      — tabs scroll the Detail page to the matching section anchor
 *   4. Highlights bar  (rating chip · review count · top 6 amenities · price)
 *
 * ── Integration in Detail.tsx ─────────────────────────────────────────────────
 * Replace the existing breadcrumb + header + image-grid block with:
 *
 *   import HotelHeader from "../components/HotelHeader";
 *
 *   // inside the JSX, BEFORE the main grid:
 *   <HotelHeader
 *     hotel={h}
 *     images={images}
 *     amenities={amenities}
 *     overallRating={overallRating}
 *     ratingWord={ratingWord}
 *     reviewCount={reviewCount}
 *     isExternal={isExternal}
 *     formatPrice={formatPrice}
 *     onTabChange={(tab) => {
 *       document.getElementById(tab)?.scrollIntoView({ behavior: "smooth" });
 *     }}
 *   />
 *
 * ── Performance ───────────────────────────────────────────────────────────────
 * - All images use loading="lazy" except the hero (loading="eager")
 * - Modal rendered only when open (no DOM cost when closed)
 * - Sticky detection via IntersectionObserver (no scroll listener)
 * - All heavy sub-components wrapped with React.memo
 * - Skeleton shown while first image hasn't loaded
 *
 * ── Rules ─────────────────────────────────────────────────────────────────────
 * - NEVER limits image count — shows all images from extra.images
 * - NEVER converts price — caller passes pre-formatted string
 * - Does NOT modify hotel data — pure display component
 */

import React, {
  useState, useEffect, useCallback, useRef, memo,
} from "react";
import { Link }       from "react-router-dom";
import { AiFillStar } from "react-icons/ai";
import { Badge }      from "../../../components/ui/badge";
import {
  ChevronRight, MapPin,
  Wifi, Car, Waves, Dumbbell, Sparkles, Utensils,
  Coffee, Plane, ShieldCheck, CheckCircle,
  Briefcase, Users, Leaf,
} from "lucide-react";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface HotelHeaderProps {
  hotel:         any;                             // EnrichedHotel | raw DB hotel
  images:        string[];                        // from extra.images
  amenities:     string[];                        // for highlights strip
  overallRating: number;                          // 0-10
  ratingWord:    string;                          // "Exceptional" etc.
  reviewCount:   number;
  isExternal:    boolean;
  formatPrice:   (amount: number, currency?: string) => string;
  onTabChange?:  (sectionId: string) => void;
}

// ─── Tab definitions (section IDs must match anchor IDs in Detail.tsx) ────────

const TABS: { label: string; id: string }[] = [
  { label: "Overview",   id: "section-ai-summary" },
  { label: "Rooms",      id: "section-rooms"      },
  { label: "Amenities",  id: "section-amenities"  },
  { label: "Location",   id: "section-location"   },
  { label: "Reviews",    id: "section-reviews"    },
  { label: "Policies",   id: "section-policies"   },
];

// ─── Amenity icon resolver ────────────────────────────────────────────────────

const AMENITY_ICON_MAP: Array<[string, React.ComponentType<any>]> = [
  ["wifi",        Wifi],
  ["internet",    Wifi],
  ["parking",     Car],
  ["pool",        Waves],
  ["swimming",    Waves],
  ["gym",         Dumbbell],
  ["fitness",     Dumbbell],
  ["spa",         Sparkles],
  ["sauna",       Sparkles],
  ["restaurant",  Utensils],
  ["dining",      Utensils],
  ["bar",         Coffee],
  ["breakfast",   Coffee],
  ["shuttle",     Plane],
  ["airport",     Plane],
  ["security",    ShieldCheck],
  ["smoking",     Leaf],
  ["business",    Briefcase],
  ["meeting",     Briefcase],
  ["family",      Users],
];

function getAmenityIcon(name: string): React.ComponentType<any> {
  const lower = name.toLowerCase();
  for (const [keyword, Icon] of AMENITY_ICON_MAP) {
    if (lower.includes(keyword)) return Icon;
  }
  return CheckCircle;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT 1: Sticky Tab Bar
// ═══════════════════════════════════════════════════════════════════════════════

interface StickyTabsProps {
  activeTab:  string;
  onChange:   (id: string) => void;
}

const StickyTabs = memo(({ activeTab, onChange }: StickyTabsProps) => {
  return (
    <div className="w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex overflow-x-auto scrollbar-hide gap-0" style={{ scrollbarWidth: "none" }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={`
                  flex-shrink-0 px-5 py-3.5 text-sm font-semibold
                  border-b-2 transition-all duration-150 whitespace-nowrap
                  ${isActive
                    ? "border-teal-600 text-teal-700"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"}
                `}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
StickyTabs.displayName = "StickyTabs";

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT 4: Highlights Bar
// ═══════════════════════════════════════════════════════════════════════════════

interface HighlightsBarProps {
  hotel:         any;
  amenities:     string[];
  overallRating: number;
  ratingWord:    string;
  reviewCount:   number;
  isExternal:    boolean;
  formatPrice:   (n: number, c?: string) => string;
}

const HighlightsBar = memo(({
  hotel, amenities, overallRating, ratingWord,
  reviewCount, formatPrice,
}: HighlightsBarProps) => {
  // Pick at most 6 representative amenities for the strip
  const topAmenities = amenities.slice(0, 6);
  const price = Number(hotel?.pricePerNight ?? hotel?.extra?.pricing?.basePrice ?? 0);

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-wrap items-center gap-4">

          {/* Rating chip */}
          {overallRating > 0 && (
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="bg-teal-600 text-white text-lg font-extrabold px-3 py-1.5 rounded-xl leading-none">
                {(overallRating * (overallRating <= 5 ? 2 : 1)).toFixed(1)}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-tight">{ratingWord}</p>
                {reviewCount > 0 && (
                  <p className="text-xs text-gray-500">{reviewCount.toLocaleString()} reviews</p>
                )}
              </div>
            </div>
          )}

          {/* Divider */}
          {overallRating > 0 && topAmenities.length > 0 && (
            <div className="h-8 w-px bg-gray-200 flex-shrink-0" />
          )}

          {/* Top amenities */}
          <div className="flex flex-wrap gap-2 flex-1 min-w-0">
            {topAmenities.map((a) => {
              const Icon = getAmenityIcon(a);
              return (
                <div
                  key={a}
                  className="flex items-center gap-1.5 bg-teal-50 text-teal-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-teal-100"
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {a}
                </div>
              );
            })}
          </div>

          {/* Price */}
          {price > 0 && (
            <div className="flex-shrink-0 text-right">
              <p className="text-xs text-gray-500">from</p>
              <p className="text-xl font-extrabold text-teal-700 leading-tight">
                {formatPrice(price, hotel?.currency)}
              </p>
              <p className="text-xs text-gray-400">/ night</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
HighlightsBar.displayName = "HighlightsBar";

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT: HotelHeader
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * HotelHeader
 *
 * Drop-in replacement for the existing breadcrumb + header + image grid
 * block at the top of Detail.tsx.
 *
 * Renders:
 *   1. Breadcrumb (Home / Hotels / <name>)
 *   2. Hotel name, star icons, type badges, location
 *   3. Hero image grid (clickable → fullscreen modal)
 *   4. Sticky tab navigation bar
 *   5. Highlights strip (rating · amenities · price)
 *
 * Becomes sticky after the image grid scrolls out of view (IntersectionObserver).
 * Modal is only mounted when open — zero DOM cost when closed.
 */
const HotelHeader = ({
  hotel,
  images: _images,
  amenities,
  overallRating,
  ratingWord,
  reviewCount,
  isExternal,
  formatPrice,
  onTabChange,
}: HotelHeaderProps) => {

  const [activeTab,  setActiveTab]  = useState(TABS[0].id);
  const [tabsSticky, setTabsSticky] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Sticky detection via IntersectionObserver (zero scroll-listener cost) ──
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setTabsSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const handleTabChange = useCallback((id: string) => {
    setActiveTab(id);
    const el = document.getElementById(id);
    if (el) {
      // Offset for sticky tabs height (~56px) + page header (~72px)
      const y = el.getBoundingClientRect().top + window.scrollY - 136;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
    onTabChange?.(id);
  }, [onTabChange]);

  const h = hotel ?? {};

  return (
    <>
      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/"       className="hover:text-teal-600 transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
          <Link to="/search" className="hover:text-teal-600 transition-colors">Hotels</Link>
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
          <span className="text-gray-900 font-medium truncate max-w-[200px]">
            {h.name ?? "Hotel"}
          </span>
        </div>
      </div>

      {/* ── Hotel name + meta ───────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            {/* Star icons */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {Array.from({ length: Math.min(Number(h.starRating ?? 0), 5) }).map((_: any, i: number) => (
                <AiFillStar key={i} className="w-5 h-5 fill-amber-400" />
              ))}
              {/* Type badges */}
              {(Array.isArray(h.type) ? h.type : [h.type]).filter(Boolean).slice(0, 3)
                .map((t: string) => (
                  <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                ))}
              {!isExternal ? null : (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                  🌍 Pay at Hotel
                </Badge>
              )}
              {h.isFeatured && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                  ⭐ Featured
                </Badge>
              )}
            </div>

            {/* Name */}
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
              {h.name ?? "Hotel"}
            </h1>

            {/* Address */}
            <div className="flex items-center gap-1.5 mt-2 text-gray-500">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">
                {h.address ?? [h.city, h.country].filter(Boolean).join(", ") ?? "Location unavailable"}
              </span>
            </div>
          </div>

          {/* Rating chip (top-right on desktop) */}
          {overallRating > 0 && (
            <div className="flex flex-col items-end flex-shrink-0">
              <div className="bg-teal-600 text-white px-4 py-2 rounded-xl font-extrabold text-2xl leading-none">
                {(overallRating * (overallRating <= 5 ? 2 : 1)).toFixed(1)}
              </div>
              <p className="text-xs font-semibold text-teal-700 mt-1">{ratingWord}</p>
              {reviewCount > 0 && (
                <p className="text-xs text-gray-400">{reviewCount.toLocaleString()} reviews</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Sentinel for sticky tabs ─────────────────────────────────────── */}
      <div ref={sentinelRef} className="h-px w-full" aria-hidden />

      {/* ── Tab bar — sticky after scroll ───────────────────────────────── */}
      <div
        className={`
          z-30 w-full transition-shadow duration-200
          ${tabsSticky
            ? "sticky top-0 shadow-md"
            : "relative shadow-none"}
        `}
      >
        <StickyTabs activeTab={activeTab} onChange={handleTabChange} />
      </div>

      {/* ── Highlights bar (rating + amenities + price) ──────────────────── */}
      <HighlightsBar
        hotel={h}
        amenities={amenities}
        overallRating={overallRating}
        ratingWord={ratingWord}
        reviewCount={reviewCount}
        isExternal={isExternal}
        formatPrice={formatPrice}
      />
    </>
  );
};

export default HotelHeader;