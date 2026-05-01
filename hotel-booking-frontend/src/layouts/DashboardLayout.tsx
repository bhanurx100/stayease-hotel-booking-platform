/**
 * hotel-booking-frontend/src/layouts/DashboardLayout.tsx
 *
 * Shared layout wrapper for CustomerDashboard, OwnerDashboard, AdminDashboard.
 * Provides: sidebar navigation + top header + content area.
 *
 * Usage:
 *   <DashboardLayout role="user" navItems={USER_NAV} title="My Dashboard">
 *     <MyContent />
 *   </DashboardLayout>
 *
 * DO NOT use for non-dashboard pages. Routing is unchanged — this only wraps content.
 */

import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Settings,
  LogOut, Menu, X, Bell, ChevronRight, Building2,
} from "lucide-react";
//import useAppContext from "../hooks/useAppContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NavItem {
  label:   string;
  href:    string;
  icon:    React.ReactNode;
  badge?:  number;
}

interface DashboardLayoutProps {
  children:  React.ReactNode;
  role:      "user" | "owner" | "admin";
  navItems:  NavItem[];
  title:     string;
  subtitle?: string;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const Sidebar = ({
  role, navItems, isOpen, onClose,
}: {
  role: string;
  navItems: NavItem[];
  isOpen: boolean;
  onClose: () => void;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const handleSignOut = () => {
  localStorage.removeItem("auth_token");
  navigate("/");
};

  const roleBadgeColors: Record<string, string> = {
    user:  "bg-teal-100 text-teal-800",
    owner: "bg-amber-100 text-amber-800",
    admin: "bg-red-100 text-red-800",
  };

  return (
    <>
      {/* Backdrop (mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-64 z-40 bg-teal-950 text-white
          flex flex-col transition-transform duration-300 ease-in-out
          lg:static lg:translate-x-0 lg:z-auto lg:flex-shrink-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-teal-800/60">
          <div className="bg-teal-700 p-2 rounded-xl">
            <Building2 className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight">Stayease</span>
            <p className="text-[10px] text-teal-400 uppercase tracking-wider">
              {role} portal
            </p>
          </div>
          <button onClick={onClose} className="ml-auto lg:hidden text-teal-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role badge */}
        <div className="px-5 py-3">
          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${roleBadgeColors[role] ?? "bg-gray-200 text-gray-700"}`}>
            {role}
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-150 group
                  ${active
                    ? "bg-teal-700 text-white"
                    : "text-teal-300 hover:bg-teal-800/60 hover:text-white"
                  }
                `}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {item.badge}
                  </span>
                )}
                {active && <ChevronRight className="w-4 h-4 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer: Settings + Sign out */}
        <div className="px-3 py-4 border-t border-teal-800/60 space-y-1">
          <Link
            to="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-teal-300 hover:bg-teal-800/60 hover:text-white transition-all"
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            Settings
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-all"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
};

// ─── Top header ───────────────────────────────────────────────────────────────

const TopBar = ({
  title, subtitle, onMenuClick,
}: {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
}) => {  
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center gap-4">
      {/* Hamburger (mobile) */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">{subtitle}</p>
        )}
      </div>

      {/* Right: notifications + home link */}
      <div className="flex items-center gap-2">
        <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <Link
          to="/"
          className="text-xs text-teal-600 hover:text-teal-700 font-medium px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-colors hidden sm:block"
        >
          ← Back to site
        </Link>
      </div>
    </header>
  );
};

// ─── Main layout ──────────────────────────────────────────────────────────────

const DashboardLayout = ({
  children, role, navItems, title, subtitle,
}: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        role={role}
        navItems={navItems}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;