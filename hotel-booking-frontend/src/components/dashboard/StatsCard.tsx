/**
 * hotel-booking-frontend/src/components/dashboard/StatsCard.tsx
 *
 * Reusable stat card with icon, value, label, and optional trend indicator.
 * Used by CustomerDashboard, OwnerDashboard, and AdminDashboard.
 */

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatsCardProps {
  label:      string;
  value:      string | number;
  icon:       React.ReactNode;
  color?:     "teal" | "emerald" | "amber" | "red" | "purple" | "blue";
  trend?:     number;      // positive = up, negative = down, 0 = neutral
  trendLabel?: string;     // e.g. "vs last month"
  loading?:   boolean;
}

const COLOR_MAP = {
  teal:    { bg: "bg-teal-50",    icon: "bg-teal-100 text-teal-700",    value: "text-teal-700"   },
  emerald: { bg: "bg-emerald-50", icon: "bg-emerald-100 text-emerald-700", value: "text-emerald-700" },
  amber:   { bg: "bg-amber-50",   icon: "bg-amber-100 text-amber-700",  value: "text-amber-700"  },
  red:     { bg: "bg-red-50",     icon: "bg-red-100 text-red-700",      value: "text-red-700"    },
  purple:  { bg: "bg-purple-50",  icon: "bg-purple-100 text-purple-700",value: "text-purple-700" },
  blue:    { bg: "bg-blue-50",    icon: "bg-blue-100 text-blue-700",    value: "text-blue-700"   },
};

const StatsCard = ({
  label, value, icon, color = "teal", trend, trendLabel, loading,
}: StatsCardProps) => {
  const colors = COLOR_MAP[color];

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-gray-200" />
        </div>
        <div className="h-7 bg-gray-200 rounded w-1/2 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-3/4" />
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow duration-200`}>
      {/* Icon */}
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.icon}`}>
          {icon}
        </div>

        {/* Trend indicator */}
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            trend > 0  ? "bg-green-100 text-green-700"  :
            trend < 0  ? "bg-red-100 text-red-600"      :
                         "bg-gray-100 text-gray-500"
          }`}>
            {trend > 0  ? <TrendingUp  className="w-3 h-3" /> :
             trend < 0  ? <TrendingDown className="w-3 h-3" /> :
                          <Minus        className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      {/* Value */}
      <p className={`text-2xl font-extrabold ${colors.value} mb-0.5`}>
        {value}
      </p>

      {/* Label */}
      <p className="text-sm text-gray-500 font-medium">{label}</p>

      {/* Trend label */}
      {trendLabel && (
        <p className="text-xs text-gray-400 mt-1">{trendLabel}</p>
      )}
    </div>
  );
};

export default StatsCard;