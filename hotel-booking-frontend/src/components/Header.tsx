/**
 * hotel-booking-frontend/src/components/Header.tsx
 *
 * ── Changes ───────────────────────────────────────────────────────────────────
 * 1. Brand name: "MernHolidays" → "Stayease"
 * 2. Color: blue (primary-*) → teal (teal-700/teal-800)
 * 3. Logo icon: Building2 with teal accent — cleaner feel
 * 4. CurrencySelector — already present, now better aligned with gap-3
 * 5. Header height increased slightly to 76px for breathing room
 * 6. Mobile nav button: styled consistently
 * ─────────────────────────────────────────────────────────────────────────────
 * Everything else (MainNav, MobileNav, search context clear) untouched.
 */

import { useNavigate }   from "react-router-dom";
import useSearchContext  from "../hooks/useSearchContext";
import MobileNav         from "./MobileNav";
import MainNav           from "./MainNav";
import { Hotel }         from "lucide-react";
import CurrencySelector  from "./CurrencySelector";

const Header = () => {
  const search   = useSearchContext();
  const navigate = useNavigate();

  const handleLogoClick = () => {
    search.clearSearchValues();
    navigate("/");
  };

  return (
    <header className="bg-gradient-to-r from-teal-800 to-teal-700 shadow-lg sticky top-0 z-50 h-[72px] flex items-center shrink-0 border-b border-teal-600/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex justify-between items-center gap-4">

          {/* ── Logo & Wordmark ───────────────────────────────────────────── */}
          <button
            onClick={handleLogoClick}
            className="flex items-center gap-2.5 group flex-shrink-0"
            aria-label="Stayease home"
          >
            <div className="bg-white/15 group-hover:bg-white/25 transition-colors duration-200 p-2 rounded-xl border border-white/20">
              <Hotel className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="hidden sm:flex flex-col items-start">
              <span className="text-xl font-extrabold text-white tracking-tight leading-tight group-hover:text-emerald-100 transition-colors">
                Stayease
              </span>
              <span className="text-[10px] text-teal-300 leading-none font-medium tracking-wide -mt-0.5">
                Hotels & Stays
              </span>
            </div>
          </button>

          {/* ── Centre: Currency selector (desktop only) ─────────────────── */}
          <div className="hidden md:flex items-center flex-1 justify-center">
            <CurrencySelector />
          </div>

          {/* ── Right: Mobile nav + Desktop nav ──────────────────────────── */}
          <div className="flex items-center gap-2">
            {/* Mobile */}
            <div className="md:hidden">
              <MobileNav />
            </div>
            {/* Desktop */}
            <div className="hidden md:flex items-center">
              <MainNav />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;