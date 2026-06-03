/**
 * Hotel detail hero: gallery, metadata, sticky tabs (no booking card).
 */

import { memo, useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { AiFillStar } from "react-icons/ai";
import { ChevronRight, MapPin } from "lucide-react";
import { Badge } from "../ui/badge";
import HotelGallery from "./HotelGallery";
import {
  pickHeroAmenities,
  buildHeroHighlights,
  displayRating10,
} from "../../lib/hotel-detail-utils";

const TABS: { label: string; id: string }[] = [
  { label: "Overview", id: "section-ai-summary" },
  { label: "Rooms", id: "section-rooms" },
  { label: "Amenities", id: "section-amenities" },
  { label: "Location", id: "section-location" },
  { label: "Reviews", id: "section-reviews" },
  { label: "Policies", id: "section-policies" },
];

export interface DetailHeroProps {
  hotel: any;
  allPhotos: string[];
  amenities: string[];
  overallRating: number;
  ratingWord: string;
  reviewCount: number;
  revSum: any;
  isExternal: boolean;
  formatPrice: (amount: number, currency?: string) => string;
  onViewRooms?: () => void;
  saved?: boolean;
  onSaveToggle?: () => void;
}

const StickyTabs = memo(({ activeTab, onChange }: { activeTab: string; onChange: (id: string) => void }) => (
  <div className="w-full bg-white border-b border-gray-200">
    <div className="flex overflow-x-auto gap-0 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex-shrink-0 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              isActive
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  </div>
));
StickyTabs.displayName = "StickyTabs";

const DetailHero = ({
  hotel,
  allPhotos,
  amenities,
  overallRating,
  ratingWord,
  reviewCount,
  revSum,
  isExternal,
  formatPrice,
  onViewRooms,
  saved,
  onSaveToggle,
}: DetailHeroProps) => {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [tabsSticky, setTabsSticky] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const h = hotel ?? {};
  const stars = Math.min(Number(h.starRating ?? 0), 5);
  const heroAmenities = pickHeroAmenities(amenities);
  const highlights = buildHeroHighlights(h, revSum, amenities);
  const scoreDisplay = displayRating10(overallRating);
  const price = Number(h.pricePerNight ?? h.extra?.pricing?.perNight ?? 0);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setTabsSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-56px 0px 0px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const handleTabChange = useCallback((id: string) => {
    setActiveTab(id);
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }, []);

  const metadataBlock = (
    <div className="space-y-2 min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        {stars > 0 &&
          Array.from({ length: stars }).map((_, i) => (
            <AiFillStar key={i} className="w-4 h-4 fill-amber-400" />
          ))}
        {(Array.isArray(h.type) ? h.type : [h.type]).filter(Boolean).slice(0, 2).map((t: string) => (
          <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">{t}</Badge>
        ))}
        {isExternal && (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
            Pay at Hotel
          </Badge>
        )}
      </div>

      <h1 className="text-xl sm:text-2xl lg:text-[1.65rem] font-extrabold text-gray-900 leading-tight">
        {h.name ?? "Hotel"}
      </h1>

      <div className="flex items-start gap-1 text-gray-500">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span className="text-xs sm:text-sm line-clamp-2">
          {h.address ?? [h.city, h.country].filter(Boolean).join(", ") ?? "Location unavailable"}
        </span>
      </div>

      {overallRating > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="bg-teal-600 text-white text-sm font-bold px-2 py-0.5 rounded-lg leading-none">
              {scoreDisplay}
            </span>
            <span className="font-semibold text-gray-900">{ratingWord}</span>
          </div>
          {reviewCount > 0 && (
            <span className="text-gray-500 text-xs sm:text-sm">
              {reviewCount.toLocaleString()} Reviews
            </span>
          )}
        </div>
      )}

      {highlights.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {highlights.map((item) => (
            <span
              key={item.text}
              className="text-[11px] sm:text-xs font-medium text-teal-800 bg-teal-50 border border-teal-100 rounded-full px-2 py-0.5"
            >
              {item.text}
            </span>
          ))}
        </div>
      )}

      {heroAmenities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {heroAmenities.map((a) => (
            <span
              key={a}
              className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5"
            >
              {a}
            </span>
          ))}
        </div>
      )}

      <div className="md:hidden flex items-center justify-between gap-3 pt-1 border-t border-gray-100 mt-2">
        <div className="min-w-0">
          {price > 0 ? (
            <p className="text-lg font-extrabold text-gray-900 leading-tight">
              {formatPrice(price, h.currency)}
              <span className="text-xs font-normal text-gray-500"> / night</span>
            </p>
          ) : (
            <p className="text-sm font-semibold text-gray-600">Price on request</p>
          )}
        </div>
        <button
          type="button"
          onClick={onViewRooms}
          className="flex-shrink-0 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg"
        >
          View rooms
        </button>
      </div>
    </div>
  );

  return (
    <header className="space-y-3 sm:space-y-4">
      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
        <Link to="/" className="hover:text-teal-600">Home</Link>
        <ChevronRight className="w-3 h-3 opacity-50" />
        <Link to="/search" className="hover:text-teal-600">Hotels</Link>
        <ChevronRight className="w-3 h-3 opacity-50" />
        <span className="text-gray-900 font-medium truncate max-w-[45vw]">{h.name ?? "Hotel"}</span>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="hidden md:block">{metadataBlock}</div>

        <HotelGallery
          images={allPhotos}
          propertyName={h.name}
          middleSlot={<div className="md:hidden">{metadataBlock}</div>}
          saved={saved}
          onSave={onSaveToggle}
        />

        <div ref={sentinelRef} className="h-px" aria-hidden />

        <div
          className={`z-30 -mx-4 sm:-mx-6 lg:mx-0 ${
            tabsSticky ? "sticky top-0 shadow-sm bg-white" : "relative bg-white"
          }`}
        >
          <StickyTabs activeTab={activeTab} onChange={handleTabChange} />
        </div>
      </div>
    </header>
  );
};

export default memo(DetailHero);
