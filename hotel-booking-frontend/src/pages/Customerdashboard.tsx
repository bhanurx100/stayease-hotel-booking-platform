/**
 * hotel-booking-frontend/src/pages/CustomerDashboard.tsx
 *
 * Wrapped with DashboardLayout. Uses StatsCard, SectionCard, DashboardTable.
 * Fetches real booking data from existing apiClient endpoints.
 * Existing functionality (bookings, hotel cards) is 100% preserved.
 */

import { useQuery }         from "react-query";
import { Link }             from "react-router-dom";
import * as apiClient       from "../api-client";
import DashboardLayout, { NavItem } from "../layouts/DashboardLayout";
import StatsCard            from "../components/dashboard/StatsCard";
import SectionCard          from "../components/dashboard/SectionCard";
import DashboardTable, { TableColumn } from "../components/dashboard/DashboardTable";
import {
  LayoutDashboard, CalendarDays, Hotel, CreditCard,
  Search, Globe, Clock, ArrowRight,
} from "lucide-react";
import { AiFillStar } from "react-icons/ai";

// ─── Nav items for customer ───────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { label: "Overview",       href: "/my-bookings",         icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: "My Bookings",    href: "/my-bookings/list",    icon: <CalendarDays    className="w-4 h-4" /> },
  { label: "Search Hotels",  href: "/search",              icon: <Search          className="w-4 h-4" /> },
  { label: "World Hotels",   href: "/search?source=world", icon: <Globe           className="w-4 h-4" /> },
];

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    confirmed: "bg-green-100 text-green-700",
    pending:   "bg-amber-100 text-amber-700",
    cancelled: "bg-red-100 text-red-600",
    completed: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
};

// ─── Booking table columns ────────────────────────────────────────────────────

const BOOKING_COLUMNS: TableColumn[] = [
  {
    key: "hotelName", label: "Hotel",
    render: (v: string) => <span className="font-medium text-gray-900">{v || "—"}</span>,
  },
  {
    key: "checkIn", label: "Check-in",
    render: (v: string) => v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—",
  },
  {
    key: "checkOut", label: "Check-out",
    render: (v: string) => v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—",
  },
  {
    key: "totalCost", label: "Amount", align: "right",
    render: (v: number) => v ? `₹${v.toLocaleString("en-IN")}` : "—",
  },
  {
    key: "status", label: "Status", align: "center",
    render: (v: string) => <StatusBadge status={v ?? "confirmed"} />,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

const CustomerDashboard = () => {
  // Fetch bookings using the existing hook
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery(
    "fetchMyBookings",
    () => apiClient.fetchMyBookings(),
    { retry: 1 }
  );

  // Fetch recommended hotels from DB
  const { data: allHotels = [] } = useQuery(
    "fetchHotelsRecommended",
    () => apiClient.fetchHotels(),
    { staleTime: 5 * 60_000 }
  );

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalBookings   = bookings.length;
  const now             = new Date();
  const upcomingStays   = bookings.filter((b: any) => new Date(b.checkIn) > now).length;
  const totalSpent      = bookings.reduce((acc: number, b: any) => acc + (b.totalCost ?? 0), 0);

  // Normalise booking rows for the table
  const bookingRows = bookings.slice(0, 8).map((b: any) => ({
    hotelName: b.hotelId?.name ?? b.hotelName ?? "—",
    checkIn:   b.checkIn,
    checkOut:  b.checkOut,
    totalCost: b.totalCost,
    status:    b.status ?? "confirmed",
  }));

  // Top 3 recommended hotels (highest rated)
  const recommended = [...allHotels]
    .sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0))
    .slice(0, 3);

  return (
    <DashboardLayout
      role="user"
      navItems={NAV_ITEMS}
      title="My Dashboard"
      subtitle="Track your bookings and discover your next stay"
    >
      <div className="space-y-6 max-w-6xl">

        {/* ── Stats row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard
            label="Total Bookings"
            value={totalBookings}
            icon={<CalendarDays className="w-5 h-5" />}
            color="teal"
            loading={bookingsLoading}
          />
          <StatsCard
            label="Upcoming Stays"
            value={upcomingStays}
            icon={<Clock className="w-5 h-5" />}
            color="emerald"
            loading={bookingsLoading}
          />
          <StatsCard
            label="Total Spent"
            value={totalSpent > 0 ? `₹${totalSpent.toLocaleString("en-IN")}` : "₹0"}
            icon={<CreditCard className="w-5 h-5" />}
            color="amber"
            loading={bookingsLoading}
          />
        </div>

        {/* ── Quick actions ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Search Hotels",   href: "/search",              icon: <Search className="w-4 h-4" />,  color: "bg-teal-600"   },
            { label: "World Hotels",    href: "/search?source=world", icon: <Globe  className="w-4 h-4" />,  color: "bg-emerald-600"},
            { label: "My Bookings",     href: "/my-bookings/list",    icon: <CalendarDays className="w-4 h-4" />, color: "bg-amber-500" },
            { label: "Hotel Details",   href: "/search",              icon: <Hotel  className="w-4 h-4" />,  color: "bg-purple-600" },
          ].map(({ label, href, icon, color }) => (
            <Link
              key={label}
              to={href}
              className={`flex flex-col items-center gap-2 ${color} text-white py-4 px-3 rounded-2xl hover:opacity-90 transition-opacity text-center`}
            >
              {icon}
              <span className="text-xs font-semibold leading-tight">{label}</span>
            </Link>
          ))}
        </div>

        {/* ── Recent Bookings ────────────────────────────────────────────── */}
        <SectionCard
          title="Recent Bookings"
          subtitle={`${totalBookings} total bookings`}
          isEmpty={bookingRows.length === 0}
          emptyState={
            <div>
              <CalendarDays className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">No bookings yet</p>
              <p className="text-xs mt-1">Find your perfect hotel and book your first stay!</p>
              <Link
                to="/search"
                className="inline-flex items-center gap-1 mt-4 text-sm text-teal-600 font-semibold hover:text-teal-700"
              >
                Search hotels <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          }
          action={
            <Link
              to="/my-bookings/list"
              className="text-xs text-teal-600 font-semibold hover:text-teal-700 flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          <DashboardTable
            columns={BOOKING_COLUMNS}
            rows={bookingRows}
            loading={bookingsLoading}
            emptyText="No bookings to display."
          />
        </SectionCard>

        {/* ── Recommended Hotels ─────────────────────────────────────────── */}
        {recommended.length > 0 && (
          <SectionCard
            title="Recommended for You"
            subtitle="Top-rated hotels on our platform"
            action={
              <Link
                to="/search"
                className="text-xs text-teal-600 font-semibold hover:text-teal-700 flex items-center gap-1"
              >
                See all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5">
              {recommended.map((hotel: any) => (
                <Link
                  key={hotel._id}
                  to={`/detail/${hotel._id}`}
                  className="group rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="h-36 overflow-hidden bg-gray-100">
                    <img
                      src={hotel.imageUrls?.[0] ?? "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=70"}
                      alt={hotel.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-gray-900 text-sm truncate">{hotel.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{hotel.city}, {hotel.country}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <AiFillStar className="w-3 h-3" />
                        {hotel.averageRating?.toFixed(1) ?? "—"}
                      </span>
                      <span className="text-xs font-bold text-teal-700">
                        ₹{hotel.pricePerNight?.toLocaleString("en-IN")}/night
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CustomerDashboard;