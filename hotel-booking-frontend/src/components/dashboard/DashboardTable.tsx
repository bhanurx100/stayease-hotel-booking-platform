/**
 * hotel-booking-frontend/src/components/dashboard/DashboardTable.tsx
 *
 * Reusable responsive table for dashboard booking/hotel/user lists.
 * Accepts generic columns + rows data; renders mobile-friendly layout.
 */

import React from "react";

export interface TableColumn {
  key:      string;
  label:    string;
  width?:   string;
  align?:   "left" | "center" | "right";
  render?:  (value: any, row: any) => React.ReactNode;
}

interface DashboardTableProps {
  columns:   TableColumn[];
  rows:      Record<string, any>[];
  loading?:  boolean;
  emptyText?: string;
}

const DashboardTable = ({
  columns, rows, loading, emptyText = "No data to display.",
}: DashboardTableProps) => {

  if (loading) {
    return (
      <div className="animate-pulse divide-y divide-gray-100">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="h-4 bg-gray-200 rounded flex-1" />
            <div className="h-4 bg-gray-200 rounded w-24" />
            <div className="h-4 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="py-14 text-center text-sm text-gray-400 px-5">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-5 py-3 font-semibold text-gray-500 uppercase tracking-wider text-xs whitespace-nowrap
                  ${col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"}
                  ${col.width ?? ""}
                `}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50/60 transition-colors duration-100">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-5 py-3.5 text-gray-700 whitespace-nowrap
                    ${col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"}
                  `}
                >
                  {col.render
                    ? col.render(row[col.key], row)
                    : (row[col.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DashboardTable;