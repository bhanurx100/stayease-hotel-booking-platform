import { memo } from "react";
import { Sparkles, AlertCircle, Users } from "lucide-react";
import type { AISummaryData } from "../../lib/hotel-detail-utils";

export interface AISummaryProps {
  data: AISummaryData;
}

const AISummary = memo(({ data }: AISummaryProps) => (
  <section id="section-ai-summary" className="bg-gradient-to-br from-slate-50 to-teal-50/40 rounded-2xl border border-teal-100 p-5 sm:p-6 shadow-sm">
    <div className="flex items-center gap-2 mb-4">
      <Sparkles className="w-5 h-5 text-teal-600" />
      <h2 className="text-lg font-bold text-gray-900">Stay insights</h2>
      <span className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-medium">From property data</span>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div>
        <h3 className="text-sm font-bold text-gray-800 mb-3">Why guests love it</h3>
        <ul className="space-y-2.5">
          {data.loves.map((item) => (
            <li key={item.label} className="bg-white/80 rounded-xl p-3 border border-white">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                {item.score > 0 && (
                  <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg">
                    {item.score.toFixed(1)}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{item.note}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-amber-600" /> Things to consider
        </h3>
        <ul className="space-y-2">
          {data.considerations.map((c, i) => (
            <li key={i} className="text-sm text-gray-600 bg-white/60 rounded-lg px-3 py-2 border border-amber-100/80">
              {c.text}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-teal-600" /> Best for
        </h3>
        <div className="flex flex-wrap gap-2">
          {data.bestFor.map((tag) => (
            <span
              key={tag}
              className="text-sm font-semibold bg-white text-teal-800 px-3 py-1.5 rounded-full border border-teal-200"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  </section>
));
AISummary.displayName = "AISummary";

export default AISummary;
