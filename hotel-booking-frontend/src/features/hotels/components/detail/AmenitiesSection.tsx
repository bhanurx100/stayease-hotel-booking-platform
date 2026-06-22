import React, { memo, useState } from "react";
import { CheckCircle, ChevronDown } from "lucide-react";
import {
  groupAmenitiesDynamic,
  type AmenityGroupKey,
} from "../../lib/hotel-detail-utils";
import {
  Wifi, Car, Waves, Dumbbell, Sparkles, Utensils, Coffee, Plane,
  Briefcase, Users, Leaf, Tv, Lock, Star, Clock, Heart,
} from "lucide-react";

const ICON_MAP: [string, React.ComponentType<{ className?: string }>][] = [
  ["wifi", Wifi], ["parking", Car], ["pool", Waves], ["gym", Dumbbell],
  ["spa", Sparkles], ["restaurant", Utensils], ["bar", Coffee],
  ["shuttle", Plane], ["business", Briefcase], ["family", Users],
  ["smoking", Leaf], ["tv", Tv], ["safe", Lock], ["service", Star],
  ["desk", Clock], ["yoga", Heart],
];

function amenityIcon(name: string) {
  const lower = name.toLowerCase();
  for (const [k, Icon] of ICON_MAP) {
    if (lower.includes(k)) return Icon;
  }
  return CheckCircle;
}

const GROUP_ORDER: AmenityGroupKey[] = [
  "Popular", "Wellness", "Business", "Family", "Food & Dining",
  "Room Features", "Accessibility", "Transport",
];

const INITIAL_PER_GROUP = 6;

export interface AmenitiesSectionProps {
  amenities: string[];
}

const AmenitiesSection = memo(({ amenities }: AmenitiesSectionProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showAllGroups, setShowAllGroups] = useState<Record<string, boolean>>({});

  if (!amenities.length) return null;

  const grouped = groupAmenitiesDynamic(amenities);
  const total = amenities.length;

  return (
    <section id="section-amenities" className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
        <h2 className="text-xl font-bold text-gray-900">Amenities</h2>
        <span className="text-sm text-gray-500">{total} available</span>
      </div>

      <div className="space-y-6">
        {GROUP_ORDER.map((group) => {
          const items = grouped[group];
          if (!items.length) return null;
          const showAll = showAllGroups[group] || expanded;
          const visible = showAll ? items : items.slice(0, INITIAL_PER_GROUP);
          const hidden = items.length - visible.length;

          return (
            <div key={group}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">{group}</h3>
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2.5">
                {visible.map((a) => {
                  const Icon = amenityIcon(a);
                  return (
                    <div key={a} className="flex items-center gap-2 text-sm text-gray-700 min-w-0">
                      <Icon className="w-4 h-4 text-teal-600 flex-shrink-0" />
                      <span className="truncate">{a}</span>
                    </div>
                  );
                })}
              </div>
              {hidden > 0 && !showAll && (
                <button
                  type="button"
                  onClick={() => setShowAllGroups((s) => ({ ...s, [group]: true }))}
                  className="mt-2 text-sm text-teal-600 font-semibold hover:underline"
                >
                  +{hidden} more in {group}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!expanded && total > INITIAL_PER_GROUP * 2 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-5 w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 px-5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <ChevronDown className="w-4 h-4" /> Show all {total} amenities
        </button>
      )}
    </section>
  );
});
AmenitiesSection.displayName = "AmenitiesSection";

export default AmenitiesSection;
