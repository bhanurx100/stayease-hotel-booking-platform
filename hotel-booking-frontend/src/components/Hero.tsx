/**
 * hotel-booking-frontend/src/components/Hero.tsx
 *
 * ── Changes ───────────────────────────────────────────────────────────────────
 * 1. Premium heading & subheading copy ("Find Your Perfect Stay…")
 * 2. Teal/emerald gradient background instead of blue
 * 3. Full-bleed hero with layered background image + overlay
 * 4. Trust badges row (verified hotels, instant booking, 24/7 support)
 * 5. Stats bar showing platform numbers
 * 6. Search bar container lifted with glass-morphism card
 * 7. Better spacing, typography, and micro-details
 *
 * Existing SearchBar component is kept exactly as-is — only wrapped differently.
 */

import SearchBar         from "./SearchBar";
import { Shield, Zap, HeadphonesIcon } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative w-full overflow-hidden">

      {/* ── Background: full-bleed image + layered gradient overlays ──────── */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1600&q=85"
          alt="Luxury hotel lobby"
          className="w-full h-full object-cover object-center"
          loading="eager"
        />
        {/* Primary overlay: dark teal gradient from bottom */}
        <div className="absolute inset-0 bg-gradient-to-br from-teal-950/90 via-teal-900/75 to-emerald-800/60" />
        {/* Subtle vignette on edges */}
        <div className="absolute inset-0 bg-gradient-to-t from-teal-950/50 via-transparent to-teal-950/30" />
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">

        {/* ── Headline block ──────────────────────────────────────────────── */}
        <div className="text-center mb-10 md:mb-12">

          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Trusted by 50,000+ travellers across India & worldwide
          </div>

          {/* Main heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight tracking-tight mb-4 drop-shadow-lg">
            Find Your Perfect Stay
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-200">
              Anywhere in the World
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto leading-relaxed font-light">
            Book verified hotels on our platform — or explore live global inventory instantly.
            Transparent pricing, no hidden fees.
          </p>
        </div>

        {/* ── Search bar glass card ────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-4 md:p-6 border border-white/60">
            <SearchBar />
          </div>
        </div>

        {/* ── Trust badges ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap justify-center gap-6 mt-10">
          {[
            { icon: Shield,           text: "Verified Properties"    },
            { icon: Zap,              text: "Instant Confirmation"   },
            { icon: HeadphonesIcon,   text: "24/7 Guest Support"     },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-white/85 text-sm font-medium">
              <div className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-white/20">
                <Icon className="w-4 h-4 text-emerald-300" />
              </div>
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <div className="relative z-10 bg-teal-900/80 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10 py-4">
            {[
              { value: "500+",    label: "Properties Listed"   },
              { value: "50K+",    label: "Happy Guests"        },
              { value: "25+",     label: "Indian Cities"       },
              { value: "4.8★",    label: "Average Rating"      },
            ].map(({ value, label }) => (
              <div key={label} className="text-center px-4 py-1">
                <p className="text-xl sm:text-2xl font-bold text-emerald-300">{value}</p>
                <p className="text-xs sm:text-sm text-white/60 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;