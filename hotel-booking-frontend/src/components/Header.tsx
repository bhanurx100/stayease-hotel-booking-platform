/**
 * hotel-booking-frontend/src/components/Header.tsx
 *
 * ── Change ────────────────────────────────────────────────────────────────────
 * Added <CurrencySelector /> between the logo and the nav.
 * Everything else (logo, MainNav, MobileNav, search context clear) is unchanged.
 */

import { useNavigate }      from "react-router-dom";
import useSearchContext      from "../hooks/useSearchContext";
import MobileNav             from "./MobileNav";
import MainNav               from "./MainNav";
import { Building2 }         from "lucide-react";
import CurrencySelector      from "./CurrencySelector";

const Header = () => {
  const search   = useSearchContext();
  const navigate = useNavigate();

  const handleLogoClick = () => {
    search.clearSearchValues();
    navigate("/");
  };

  return (
    <header className="bg-gradient-to-r from-primary-600 to-primary-700 shadow-large sticky top-0 z-50 h-[72px] flex items-center shrink-0">
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex justify-between items-center h-full gap-4">

          {/* Logo */}
          <button onClick={handleLogoClick} className="flex items-center space-x-2 group flex-shrink-0">
            <div className="bg-white p-2 rounded-lg shadow-soft group-hover:shadow-medium transition-all duration-300">
              <Building2 className="w-6 h-6 text-primary-600" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight group-hover:text-primary-100 transition-colors hidden sm:block">
              MernHolidays
            </span>
          </button>

          {/* ── NEW: Currency selector ──────────────────────────────────── */}
          <div className="hidden md:block">
            <CurrencySelector />
          </div>

          {/* Mobile nav */}
          <div className="md:hidden">
            <MobileNav />
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center">
            <MainNav />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;