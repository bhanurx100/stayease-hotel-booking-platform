/**
 * hotel-booking-frontend/src/components/dashboard/SectionCard.tsx
 *
 * Reusable section wrapper with title, optional subtitle, action button, and
 * empty state. Used by all dashboard pages to maintain consistent section styling.
 */

import React from "react";

interface SectionCardProps {
  title:       string;
  subtitle?:   string;
  action?:     React.ReactNode;
  children:    React.ReactNode;
  emptyState?: React.ReactNode;
  isEmpty?:    boolean;
  className?:  string;
}

const SectionCard = ({
  title, subtitle, action, children,
  emptyState, isEmpty = false, className = "",
}: SectionCardProps) => {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      {/* Content */}
      <div>
        {isEmpty && emptyState ? (
          <div className="py-12 px-5 text-center text-gray-400">
            {emptyState}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default SectionCard;