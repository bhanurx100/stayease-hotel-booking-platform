import { memo, type ComponentType } from "react";
import {
  MapPin, Heart, Briefcase, Users, Plane, Sparkles, Coffee,
  TrainFront, Car, Wifi, CheckCircle2, BookOpen,
} from "lucide-react";
import {
  buildAboutSections,
  buildPropertyHighlightCards,
  resolvePropertyDescription,
  type PropertyHighlightCard,
} from "../../lib/hotel-detail-utils";
import { aboutSectionTitle, resolvePropertyKind } from "../../lib/property-types";

const ICON_MAP: Record<PropertyHighlightCard["icon"], ComponentType<{ className?: string }>> = {
  location: MapPin,
  couples: Heart,
  business: Briefcase,
  family: Users,
  shuttle: Plane,
  spa: Sparkles,
  breakfast: Coffee,
  metro: TrainFront,
  parking: Car,
  wifi: Wifi,
  default: CheckCircle2,
};

export interface AboutPropertySectionProps {
  hotel: any;
  extra: any;
  amenities: string[];
  revSum: any;
  nearby: any;
  hotelType: string | string[] | undefined;
}

const AboutPropertySection = memo(({
  hotel,
  extra,
  amenities,
  revSum,
  nearby,
  hotelType,
}: AboutPropertySectionProps) => {
  const description = resolvePropertyDescription(hotel, extra);
  const sections = buildAboutSections(description, hotel, amenities, revSum, nearby);
  const highlights = buildPropertyHighlightCards(hotel, amenities, revSum, nearby);
  const title = aboutSectionTitle(resolvePropertyKind(hotelType));

  if (!sections.length && !highlights.length) return null;

  return (
    <section
      id="section-about"
      className="rounded-2xl overflow-hidden border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-teal-50/30 shadow-sm"
    >
      <div className="px-5 sm:px-7 pt-6 pb-4 border-b border-slate-200/60 bg-white/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-teal-600" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h2>
        </div>
      </div>

      <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] gap-6 lg:gap-8">
        <div className="space-y-6 min-w-0">
          {sections.length > 0 ? (
            sections.map((sec, i) => (
              <div
                key={`${sec.title}-${i}`}
                className={i > 0 ? "pt-6 border-t border-slate-200/70" : ""}
              >
                <h3 className="text-sm font-bold uppercase tracking-wide text-teal-800 mb-2">
                  {sec.title}
                </h3>
                <div className="space-y-2.5">
                  {sec.paragraphs.map((p, j) => (
                    <p key={j} className="text-sm sm:text-[15px] text-gray-600 leading-relaxed">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 italic">Description not available for this property.</p>
          )}
        </div>

        {highlights.length > 0 && (
          <aside className="min-w-0">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">
              Property Highlights
            </h3>
            <ul className="space-y-2.5">
              {highlights.map((card) => {
                const Icon = ICON_MAP[card.icon] ?? ICON_MAP.default;
                return (
                  <li
                    key={card.text}
                    className="flex items-start gap-3 rounded-xl bg-white/90 border border-slate-100 px-3.5 py-3 shadow-sm"
                  >
                    <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-teal-600" />
                    </span>
                    <span className="text-sm font-medium text-gray-800 pt-1">{card.text}</span>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </div>
    </section>
  );
});
AboutPropertySection.displayName = "AboutPropertySection";

export default AboutPropertySection;
