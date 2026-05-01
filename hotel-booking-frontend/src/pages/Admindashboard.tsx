/**
 * hotel-booking-frontend/src/pages/AdminDashboard.tsx
 *
 * Admin dashboard. Same DashboardLayout. Four tabs: Overview · Users · Hotels · Bookings.
 * Existing analytics (BusinessInsightsDashboard) is preserved — linked from Overview tab.
 * Uses apiClient.fetchHotels(), fetchMyBookings() for data.
 */

import { useState }        from "react";
import { useQuery }        from "react-query";
import { Link }            from "react-router-dom";
import * as apiClient      from "../api-client";
import DashboardLayout, { NavItem } from "../layouts/DashboardLayout";
import StatsCard           from "../components/dashboard/StatsCard";
import SectionCard         from "../components/dashboard/SectionCard";
import DashboardTable, { TableColumn } from "../components/dashboard/DashboardTable";
import {
  LayoutDashboard, Users, Hotel, CalendarDays, BarChart3,
  ShieldCheck, Globe, ArrowRight,
} from "lucide-react";
import { AiFillStar } from "react-icons/ai";

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { label: "Overview",   href: "/admin-dashboard",  icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: "All Hotels", href: "/admin/hotels",     icon: <Hotel           className="w-4 h-4" /> },
  { label: "All Users",  href: "/admin/users",      icon: <Users           className="w-4 h-4" /> },
  { label: "Analytics",  href: "/analytics",        icon: <BarChart3       className="w-4 h-4" /> },
  { label: "World Hotels", href: "/search?source=world", icon: <Globe      className="w-4 h-4" /> },
];

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "hotels" | "bookings";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview",  label: "Overview"  },
  { key: "hotels",    label: "Hotels"    },
  { key: "bookings",  label: "Bookings"  },
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
  { key: "country",      label: "Country" },
  {
    key: "pricePerNight", label: "Price/Night", align: "right",
    render: (v: number) => v ? `₹${v.toLocaleString("en-IN")}` : "—",
  },
  {
    key: "starRating", label: "Stars", align: "center",
    render: (v: number) => (
      <span className="flex items-center justify-center gap-0.5">
        <AiFillStar className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-sm font-medium">{v}</span>
      </span>
    ),
  },
  {
    key: "totalBookings", label: "Bookings", align: "center",
    render: (v: number) => <span className="font-medium text-teal-700">{v ?? 0}</span>,
  },
];

const BOOKING_COLUMNS: TableColumn[] = [
  {
    key: "hotelName", label: "Hotel",
    render: (v: string) => <span className="font-medium text-gray-900">{v || "—"}</span>,
  },
  { key: "firstName", label: "Guest" },
  {
    key: "checkIn", label: "Check-in",
    render: (v: string) => v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—",
  },
  {
    key: "checkOut", label: "Check-out",
    render: (v: string) => v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—",
  },
  {
    key: "totalCost", label: "Amount", align: "right",
    render: (v: number) => v ? `₹${v.toLocaleString("en-IN")}` : "—",
  },
  {
    key: "status", label: "Status", align: "center",
    render: (v: string) => (
      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
        v === "confirmed" ? "bg-green-100 text-green-700" :
        v === "cancelled" ? "bg-red-100 text-red-600"    :
                            "bg-gray-100 text-gray-600"
      }`}>{v ?? "confirmed"}</span>
    ),
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const { data: hotels   = [], isLoading: hotelsLoading  } = useQuery("adminHotels",   () => apiClient.fetchHotels(),     { retry: 1 });
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery("adminBookings", () => apiClient.fetchMyBookings(), { retry: 1 });

  // ── Platform stats ─────────────────────────────────────────────────────────
  const totalHotels   = hotels.length;
  const totalBookings = bookings.length;
  const totalRevenue  = hotels.reduce((a: number, h: any) => a + (h.totalRevenue ?? 0), 0);
  const activeHotels  = hotels.filter((h: any) => h.isActive !== false).length;

  const hotelRows = hotels.map((h: any) => ({
    _id:           h._id,
    name:          h.name,
    city:          h.city,
    country:       h.country,
    pricePerNight: h.pricePerNight,
    starRating:    h.starRating,
    totalBookings: h.totalBookings ?? 0,
  }));

  const bookingRows = bookings.slice(0, 20).map((b: any) => ({
    hotelName:  b.hotelId?.name ?? "—",
    firstName:  b.firstName ?? "Guest",
    checkIn:    b.checkIn,
    checkOut:   b.checkOut,
    totalCost:  b.totalCost,
    status:     b.status ?? "confirmed",
  }));

  return (
    <DashboardLayout
      role="admin"
      navItems={NAV_ITEMS}
      title="Admin Dashboard"
      subtitle="Platform-wide overview and management"
    >
      <div className="space-y-6 max-w-7xl">

        {/* ── Stats row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            label="Total Hotels"
            value={totalHotels}
            icon={<Hotel        className="w-5 h-5" />}
            color="teal"
            loading={hotelsLoading}
          />
          <StatsCard
            label="Active Hotels"
            value={activeHotels}
            icon={<ShieldCheck  className="w-5 h-5" />}
            color="emerald"
            loading={hotelsLoading}
          />
          <StatsCard
            label="Total Bookings"
            value={totalBookings}
            icon={<CalendarDays className="w-5 h-5" />}
            color="blue"
            loading={bookingsLoading}
          />
          <StatsCard
            label="Platform Revenue"
            value={totalRevenue > 0 ? `₹${Math.round(totalRevenue / 1_000)}K` : "₹0"}
            icon={<BarChart3    className="w-5 h-5" />}
            color="amber"
            loading={hotelsLoading}
          />
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="border-b border-gray-200">
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-semibold transition-colors duration-150 border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? "border-teal-600 text-teal-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Overview tab ──────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-5">
            {/* Revenue cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-2xl p-6 text-white">
                <p className="text-teal-200 text-sm mb-1">Total Platform Revenue</p>
                <p className="text-3xl font-extrabold">₹{totalRevenue.toLocaleString("en-IN")}</p>
                <p className="text-teal-300 text-xs mt-2">{totalBookings} confirmed bookings</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-6 text-white">
                <p className="text-emerald-200 text-sm mb-1">Avg. Revenue / Hotel</p>
                <p className="text-3xl font-extrabold">
                  ₹{totalHotels > 0 ? Math.round(totalRevenue / totalHotels).toLocaleString("en-IN") : 0}
                </p>
                <p className="text-emerald-300 text-xs mt-2">{totalHotels} properties on platform</p>
              </div>
            </div>

            {/* Link to full analytics (existing feature — DO NOT remove) */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center justify-between shadow-sm">
              <div>
                <p className="font-bold text-gray-900">Full Analytics Dashboard</p>
                <p className="text-sm text-gray-500 mt-0.5">Revenue trends, forecasts, and performance reports</p>
              </div>
              <Link
                to="/analytics"
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                View Analytics <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* ── Hotels tab ────────────────────────────────────────────────── */}
        {activeTab === "hotels" && (
          <SectionCard
            title="All Hotels"
            subtitle={`${totalHotels} hotel${totalHotels !== 1 ? "s" : ""} on the platform`}
          >
            <DashboardTable
              columns={HOTEL_COLUMNS}
              rows={hotelRows}
              loading={hotelsLoading}
              emptyText="No hotels found."
            />
          </SectionCard>
        )}

        {/* ── Bookings tab ───────────────────────────────────────────────── */}
        {activeTab === "bookings" && (
          <SectionCard
            title="All Bookings"
            subtitle={`${totalBookings} booking${totalBookings !== 1 ? "s" : ""} total`}
          >
            <DashboardTable
              columns={BOOKING_COLUMNS}
              rows={bookingRows}
              loading={bookingsLoading}
              emptyText="No bookings found."
            />
          </SectionCard>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;