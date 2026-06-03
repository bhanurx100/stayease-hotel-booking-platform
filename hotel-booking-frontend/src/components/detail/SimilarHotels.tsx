import { memo, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, MapPin, Star, Building2 } from "lucide-react";
export interface SimilarHotelItem {
  _id: string;
  name: string;
  city?: string;
  imageUrls?: string[];
  pricePerNight?: number;
  currency?: string;
  averageRating?: number;
  rating?: number;
  reviewCount?: number;
  distance?: string;
  source?: string;
}

export interface SimilarHotelsProps {
  similar: SimilarHotelItem[];
  nearby: SimilarHotelItem[];
  formatPrice: (amount: number, currency?: string) => string;
  currentId: string;
}

const FALLBACK =
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=70";

function HotelCarousel({
  title,
  items,
  formatPrice,
}: {
  title: string;
  items: SimilarHotelItem[];
  formatPrice: (n: number, c?: string) => string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  if (!items.length) return null;

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <div className="mb-8 last:mb-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <div className="hidden sm:flex gap-1">
          <button type="button" onClick={() => scroll(-1)} className="p-2 rounded-full border border-gray-200 hover:bg-gray-50" aria-label="Previous">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => scroll(1)} className="p-2 rounded-full border border-gray-200 hover:bg-gray-50" aria-label="Next">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide max-w-full"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((h) => {
          const img = h.imageUrls?.[0] ?? FALLBACK;
          const rating = Number(h.averageRating ?? h.rating ?? 0);
          const score = rating > 0 ? (rating * (rating <= 5 ? 2 : 1)).toFixed(1) : null;
          const isExt = h.source === "external" || String(h._id).startsWith("booking_");
          const cur = isExt ? (h.currency ?? "GBP") : "INR";

          return (
            <Link
              key={h._id}
              to={`/detail/${h._id}`}
              className="flex-shrink-0 w-[260px] sm:w-[280px] snap-start bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-teal-100 transition-all"
            >
              <div className="relative h-36 bg-gray-100">
                <img src={img} alt={h.name} className="w-full h-full object-cover" loading="lazy"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK; }} />
                {score && (
                  <span className="absolute top-2 right-2 bg-teal-600 text-white text-xs font-bold px-2 py-0.5 rounded-lg flex items-center gap-0.5">
                    <Star className="w-3 h-3" /> {score}
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="font-bold text-gray-900 text-sm line-clamp-2">{h.name}</p>
                {h.city && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 truncate">
                    <MapPin className="w-3 h-3 flex-shrink-0" /> {h.city}
                  </p>
                )}
                <div className="flex items-end justify-between mt-2 gap-2">
                  {(h.pricePerNight ?? 0) > 0 ? (
                    <p className="font-bold text-teal-700 text-sm">
                      {formatPrice(Number(h.pricePerNight), cur)}
                      <span className="text-xs font-normal text-gray-500"> / night</span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">Price on request</p>
                  )}
                  {h.distance && (
                    <span className="text-xs text-gray-400 flex-shrink-0">{h.distance}</span>
                  )}
                </div>
                {h.reviewCount != null && h.reviewCount > 0 && (
                  <p className="text-xs text-gray-400 mt-1">{h.reviewCount} reviews</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const SimilarHotels = memo(({ similar, nearby, formatPrice, currentId }: SimilarHotelsProps) => {
  const sim = similar.filter((h) => h._id !== currentId);
  const near = nearby.filter((h) => h._id !== currentId);

  if (!sim.length && !near.length) return null;

  return (
    <section id="section-similar" className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm overflow-hidden">
      <h2 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-teal-600" /> You may also like
      </h2>
      <HotelCarousel title="Similar stays" items={sim} formatPrice={formatPrice} />
      <HotelCarousel title="Compare nearby stays" items={near} formatPrice={formatPrice} />
    </section>
  );
});
SimilarHotels.displayName = "SimilarHotels";

export default SimilarHotels;
