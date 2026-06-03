import { memo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FAQItem } from "../../lib/hotel-detail-utils";

export interface FAQSectionProps {
  faqs: FAQItem[];
}

const FAQSection = memo(({ faqs }: FAQSectionProps) => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  if (!faqs.length) return null;

  return (
    <section id="section-faq" className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Frequently asked questions</h2>
      <div className="divide-y divide-gray-100">
        {faqs.map((faq, i) => {
          const open = openIdx === i;
          return (
            <div key={faq.question}>
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : i)}
                className="w-full flex items-center justify-between gap-3 py-4 text-left"
              >
                <span className="font-semibold text-gray-900 text-sm sm:text-base pr-2">{faq.question}</span>
                <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <p className="text-sm text-gray-600 pb-4 leading-relaxed">{faq.answer}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
});
FAQSection.displayName = "FAQSection";

export default FAQSection;
