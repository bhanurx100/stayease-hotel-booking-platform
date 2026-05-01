/**
 * hotel-booking-frontend/src/pages/OwnerDashboard.tsx
 *
 * Hotel owner dashboard. Uses the same DashboardLayout + shared components.
 * Fetches data from existing apiClient.fetchMyHotels() endpoint.
 * Add Hotel and Manage Hotels actions preserved.
 */

import { useQuery }        from "react-query";
import { Link }            from "react-router-dom";
import * as apiClient      from "../api-client";
import DashboardLayout, { NavItem } from "../layouts/DashboardLayout";
import StatsCard           from "../components/dashboard/StatsCard";
import SectionCard         from "../components/dashboard/SectionCard";
import DashboardTable, { TableColumn } from "../components/dashboard/DashboardTable";
import {
  LayoutDashboard, Hotel, CalendarDays, PlusCircle,
  Settings, BarChart3, ArrowRight, Star,
} from "lucide-react";
import { AiFillStar } from "react-icons/ai";

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { label: "Overview",       href: "/owner-dashboard",       icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: "My Hotels",      href: "/my-hotels",             icon: <Hotel           className="w-4 h-4" /> },
  { label: "Add Hotel",      href: "/add-hotel",             icon: <PlusCircle      className="w-4 h-4" /> },
  { label: "Analytics",      href: "/analytics",             icon: <BarChart3       className="w-4 h-4" /> },
];

// ─── Table columns ────────────────────────────────────────────────────────────

const HOTEL_COLUMNS: TableColumn[] = [
  {
    key: "name", label: "Hotel",
    render: (v: string, row: any) => (
      <Link to={`/detail/${row._id}`} className="font-semibold text-gray-900 hover:text-teal-700 transition-colors">
        {v}
      </Link>
    ),
  },
  { key: "city",         label: "City" },
  {
    key: "pricePerNight", label: "Price/Night", align: "right",
    render: (v: number) => v ? `₹${v.toLocaleString("en-IN")}` : "—",
  },
  {
    key: "starRating",    label: "Stars",  align: "center",
    render: (v: number) => (
      <span className="flex items-center justify-center gap-0.5">
        <AiFillStar className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-sm font-medium">{v ?? "—"}</span>
      </span>
    ),
  },
  {
    key: "totalBookings", label: "Bookings", align: "center",
    render: (v: number) => <span className="font-medium text-teal-700">{v ?? 0}</span>,
  },
  {
    key: "isActive",      label: "Status",   align: "center",
    render: (v: boolean) => (
      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${v ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
        {v ? "Active" : "Inactive"}
      </span>
    ),
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

const OwnerDashboard = () => {
  const { data: hotels = [], isLoading } = useQuery(
    "fetchMyHotels",
    () => apiClient.fetchMyHotels(),
    { retry: 1 }
  );

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalHotels    = hotels.length;
  const activeHotels   = hotels.filter((h: any) => h.isActive !== false).length;
  const totalBookings  = hotels.reduce((acc: number, h: any) => acc + (h.totalBookings ?? 0), 0);
  const totalRevenue   = hotels.reduce((acc: number, h: any) => acc + (h.totalRevenue ?? 0), 0);

  const hotelRows = hotels.map((h: any) => ({
    _id:           h._id,
    name:          h.name,
    city:          h.city,
    pricePerNight: h.pricePerNight,
    starRating:    h.starRating,
    totalBookings: h.totalBookings ?? 0,
    isActive:      h.isActive !== false,
  }));

  return (
    <DashboardLayout
      role="owner"
      navItems={NAV_ITEMS}
      title="Owner Dashboard"
      subtitle="Manage your properties and track performance"
    >
      <div className="space-y-6 max-w-6xl">

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            label="Total Hotels"
            value={totalHotels}
            icon={<Hotel        className="w-5 h-5" />}
            color="teal"
            loading={isLoading}
          />
          <StatsCard
            label="Active Hotels"
            value={activeHotels}
            icon={<Star         className="w-5 h-5" />}
            color="emerald"
            loading={isLoading}
          />
          <StatsCard
            label="Total Bookings"
            value={totalBookings}
            icon={<CalendarDays className="w-5 h-5" />}
            color="blue"
            loading={isLoading}
          />
          <StatsCard
            label="Total Revenue"
            value={totalRevenue > 0 ? `₹${totalRevenue.toLocaleString("en-IN")}` : "₹0"}
            icon={<BarChart3    className="w-5 h-5" />}
            color="amber"
            loading={isLoading}
          />
        </div>

        {/* ── Quick actions ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Add Hotel",     href: "/add-hotel",  icon: <PlusCircle      className="w-4 h-4" />, color: "bg-teal-600"   },
            { label: "Manage Hotels", href: "/my-hotels",  icon: <Hotel           className="w-4 h-4" />, color: "bg-emerald-600"},
            { label: "Analytics",     href: "/analytics",  icon: <BarChart3       className="w-4 h-4" />, color: "bg-amber-500"  },
            { label: "Settings",      href: "/settings",   icon: <Settings        className="w-4 h-4" />, color: "bg-gray-600"   },
          ].map(({ label, href, icon, color }) => (
            <Link
              key={label}
              to={href}
              className={`flex flex-col items-center gap-2 ${color} text-white py-4 px-3 rounded-2xl hover:opacity-90 transition-opacity text-center`}
            >
              {icon}
              <span className="text-xs font-semibold">{label}</span>
            </Link>
          ))}
        </div>

        {/* ── My Hotels table ────────────────────────────────────────────── */}
        <SectionCard
          title="My Hotels"
          subtitle={`${totalHotels} propert${totalHotels === 1 ? "y" : "ies"} listed`}
          isEmpty={hotelRows.length === 0 && !isLoading}
          emptyState={
            <div>
              <Hotel className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">No hotels listed yet</p>
              <Link
                to="/add-hotel"
                className="inline-flex items-center gap-1 mt-4 text-sm text-teal-600 font-semibold hover:text-teal-700"
              >
                Add your first hotel <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          }
          action={
            <Link
              to="/add-hotel"
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add Hotel
            </Link>
          }
        >
          <DashboardTable
            columns={HOTEL_COLUMNS}
            rows={hotelRows}
            loading={isLoading}
            emptyText="No hotels to display."
          />
        </SectionCard>

        {/* ── Revenue summary ────────────────────────────────────────────── */}
        {totalRevenue > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-2xl p-6 text-white">
              <p className="text-teal-200 text-sm font-medium mb-1">Total Revenue</p>
              <p className="text-3xl font-extrabold">₹{totalRevenue.toLocaleString("en-IN")}</p>
              <p className="text-teal-300 text-xs mt-2">Across all {totalHotels} propert{totalHotels === 1 ? "y" : "ies"}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 text-white">
              <p className="text-emerald-200 text-sm font-medium mb-1">Avg. Revenue/Hotel</p>
              <p className="text-3xl font-extrabold">
                ₹{totalHotels > 0 ? Math.round(totalRevenue / totalHotels).toLocaleString("en-IN") : 0}
              </p>
              <p className="text-emerald-300 text-xs mt-2">{totalBookings} total bookings</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default OwnerDashboard;