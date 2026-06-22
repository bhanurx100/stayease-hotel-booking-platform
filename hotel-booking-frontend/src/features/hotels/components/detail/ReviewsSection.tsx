import { memo } from "react";
import { ThumbsUp, Globe } from "lucide-react";
import { extractPopularMentions } from "../../lib/hotel-detail-utils";

const RatingBar = memo(({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
      <div
        className="h-full bg-teal-500 rounded-full"
        style={{ width: `${Math.min(100, (value / 10) * 100)}%` }}
      />
    </div>
    <span className="text-xs font-bold text-gray-700 w-8 text-right">{value.toFixed(1)}</span>
  </div>
));
RatingBar.displayName = "RatingBar";

const ReviewCard = memo(({ review }: { review: any }) => (
  <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/80">
    <div className="flex items-start justify-between mb-2 gap-2">
      <div className="min-w-0">
        <p className="font-semibold text-gray-800 text-sm truncate">{review.reviewer || "Guest"}</p>
        {review.date && !isNaN(new Date(review.date).getTime()) && (
          <p className="text-xs text-gray-400">
            {new Date(review.date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
          </p>
        )}
      </div>
      {Number(review.rating ?? 0) > 0 && (
        <div className="flex items-center gap-1 bg-teal-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0">
          <ThumbsUp className="w-3 h-3" />
          {Number(review.rating).toFixed(1)}
        </div>
      )}
    </div>
    {review.title && <p className="text-sm font-semibold text-gray-700 mb-1">{review.title}</p>}
    {review.text && <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{review.text}</p>}
    {(review.source === "tripadvisor" || review.source === "google") && (
      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1 capitalize">
        <Globe className="w-3 h-3" />
        {review.source === "tripadvisor" ? "Tripadvisor" : "Google"} review
      </p>
    )}
  </div>
));
ReviewCard.displayName = "ReviewCard";

export interface ReviewsSectionProps {
  reviews: any[];
  revSum: any;
  overallRating: number;
  reviewCount: number;
}

const CATEGORY_ROWS: [string, string][] = [
  ["Cleanliness", "cleanliness"],
  ["Location", "location"],
  ["Staff", "staff"],
  ["Comfort", "comfort"],
  ["Value", "value"],
  ["Facilities", "facilities"],
];

const ReviewsSection = memo(({ reviews, revSum, overallRating, reviewCount }: ReviewsSectionProps) => {
  if (!reviews.length && overallRating <= 0) return null;

  const displayScore = overallRating > 0
    ? (overallRating * (overallRating <= 5 ? 2 : 1)).toFixed(1)
    : null;
  const mentions = extractPopularMentions(reviews);
  const cats = revSum?.categories ?? {};

  return (
    <section id="section-reviews" className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <h2 className="text-xl font-bold text-gray-900">Guest reviews</h2>
        {displayScore && (
          <div className="text-right">
            <div className="bg-teal-600 text-white text-lg font-bold px-3 py-1.5 rounded-xl inline-block">
              {displayScore}
            </div>
            {reviewCount > 0 && (
              <p className="text-xs text-gray-500 mt-1">{reviewCount.toLocaleString()} reviews</p>
            )}
          </div>
        )}
      </div>

      {cats && (
        <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Score breakdown</p>
          {CATEGORY_ROWS.filter(([, key]) => Number(cats[key]) > 0).map(([label, key]) => (
            <RatingBar key={label} label={label} value={Number(cats[key])} />
          ))}
        </div>
      )}

      {mentions.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Popular mentions</p>
          <div className="flex flex-wrap gap-2">
            {mentions.map((tag) => (
              <span
                key={tag}
                className="text-xs font-medium bg-teal-50 text-teal-800 px-3 py-1.5 rounded-full border border-teal-100"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {revSum?.distribution && reviewCount > 0 && (
        <div className="mb-5 space-y-1.5">
          {[
            ["Exceptional", revSum.distribution.excellent, "bg-teal-500"],
            ["Very good", revSum.distribution.veryGood, "bg-teal-400"],
            ["Good", revSum.distribution.good, "bg-yellow-400"],
            ["Fair", revSum.distribution.fair, "bg-orange-400"],
            ["Poor", revSum.distribution.poor, "bg-red-400"],
          ].map(([label, count, color]) => (
            <div key={String(label)} className="flex items-center gap-2 text-xs">
              <span className="w-20 text-gray-500 flex-shrink-0">{String(label)}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${String(color)}`}
                  style={{ width: `${Math.min(100, (Number(count) / reviewCount) * 100)}%` }}
                />
              </div>
              <span className="w-6 text-gray-500 text-right">{Number(count)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {reviews.slice(0, 8).map((r, i) => (
          <ReviewCard key={i} review={r} />
        ))}
      </div>
    </section>
  );
});
ReviewsSection.displayName = "ReviewsSection";

export default ReviewsSection;
