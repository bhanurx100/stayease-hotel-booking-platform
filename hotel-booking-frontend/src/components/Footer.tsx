/**
 * hotel-booking-frontend/src/components/Footer.tsx
 *
 * ── Stayease branded footer ────────────────────────────────────────────────
 * Dark teal theme with three column sections: Company · Explore · Support
 * Contact info: Bengaluru, India | support@stayease.com | +91-9000000000
 * Bottom bar with copyright and legal links.
 */

import { Link }       from "react-router-dom";
import {
  Building2, MapPin, Mail, Phone,
  Instagram, Twitter, Facebook, Linkedin,
  Globe,
} from "lucide-react";

// ─── Nav link data ────────────────────────────────────────────────────────────

const COMPANY_LINKS = [
  { label: "About Stayease", href: "/about"   },
  { label: "Careers",        href: "/careers"  },
  { label: "Press & Media",  href: "/press"    },
  { label: "Blog",           href: "/blog"     },
  { label: "Partner with us",href: "/partner"  },
];

const EXPLORE_LINKS = [
  { label: "Hotels in Bangalore",  href: "/search?destination=Bangalore" },
  { label: "Hotels in Goa",        href: "/search?destination=Goa"       },
  { label: "Hotels in Delhi",      href: "/search?destination=Delhi"     },
  { label: "Hotels in Mumbai",     href: "/search?destination=Mumbai"    },
  { label: "Hotels in Coorg",      href: "/search?destination=Coorg"     },
  { label: "Hotels in Ooty",       href: "/search?destination=Ooty"      },
];

const SUPPORT_LINKS = [
  { label: "Help Centre",          href: "/help"        },
  { label: "Cancellation Policy",  href: "/cancellation" },
  { label: "Safety Information",   href: "/safety"       },
  { label: "Report an Issue",      href: "/report"       },
  { label: "Accessibility",        href: "/accessibility" },
];

const SOCIAL = [
  { icon: Instagram, href: "https://instagram.com",  label: "Instagram" },
  { icon: Twitter,   href: "https://twitter.com",    label: "Twitter"   },
  { icon: Facebook,  href: "https://facebook.com",   label: "Facebook"  },
  { icon: Linkedin,  href: "https://linkedin.com",   label: "LinkedIn"  },
];

// ─── Component ────────────────────────────────────────────────────────────────

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-b from-teal-950 to-teal-950 text-white">

      {/* ── Top CTA strip ──────────────────────────────────────────────────── */}
      <div className="bg-teal-800/60 border-b border-teal-700/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-white">List your property on Stayease</p>
            <p className="text-sm text-teal-300 mt-0.5">Reach thousands of guests across India and the globe.</p>
          </div>
          <Link
            to="/add-hotel"
            className="flex-shrink-0 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors duration-200"
          >
            Get started free →
          </Link>
        </div>
      </div>

      {/* ── Main footer grid ───────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-10">

          {/* Brand column */}
          <div className="space-y-5">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group w-fit">
              <div className="bg-teal-700 group-hover:bg-teal-600 transition-colors p-2.5 rounded-xl">
                <Building2 className="w-6 h-6 text-emerald-300" />
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-white">Stayease</span>
            </Link>

            <p className="text-teal-300 text-sm leading-relaxed max-w-xs">
              Discover and book verified hotels across India and worldwide.
              Transparent pricing, real reviews, seamless experience.
            </p>

            {/* Contact info */}
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-teal-200 leading-snug">
                  Koramangala, Bengaluru — 560034, Karnataka, India
                </span>
              </div>
              <a
                href="mailto:support@stayease.com"
                className="flex items-center gap-2.5 group"
              >
                <Mail className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-sm text-teal-200 group-hover:text-emerald-300 transition-colors">
                  support@stayease.com
                </span>
              </a>
              <a
                href="tel:+919000000000"
                className="flex items-center gap-2.5 group"
              >
                <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-sm text-teal-200 group-hover:text-emerald-300 transition-colors">
                  +91 90000 00000
                </span>
              </a>
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-sm text-teal-200">www.stayease.com</span>
              </div>
            </div>

            {/* Social links */}
            <div className="flex gap-3 pt-1">
              {SOCIAL.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-teal-800 hover:bg-teal-600 border border-teal-700 hover:border-teal-500 transition-all duration-200"
                >
                  <Icon className="w-4 h-4 text-teal-200" />
                </a>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-5">
              Company
            </h4>
            <ul className="space-y-3">
              {COMPANY_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    to={href}
                    className="text-sm text-teal-300 hover:text-white transition-colors duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Explore */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-5">
              Explore
            </h4>
            <ul className="space-y-3">
              {EXPLORE_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    to={href}
                    className="text-sm text-teal-300 hover:text-white transition-colors duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-5">
              Support
            </h4>
            <ul className="space-y-3">
              {SUPPORT_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    to={href}
                    className="text-sm text-teal-300 hover:text-white transition-colors duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* App badges placeholder */}
            <div className="mt-6 space-y-2">
              <p className="text-xs text-teal-400 uppercase tracking-wider">Available on</p>
              <div className="flex gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-teal-800 border border-teal-700 text-teal-200 text-xs px-3 py-1.5 rounded-lg">
                  📱 iOS App
                </span>
                <span className="inline-flex items-center gap-1.5 bg-teal-800 border border-teal-700 text-teal-200 text-xs px-3 py-1.5 rounded-lg">
                  🤖 Android
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ─────────────────────────────────────────────────────── */}
      <div className="border-t border-teal-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-teal-400">
          <p>© {currentYear} Stayease Technologies Pvt. Ltd. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy"  className="hover:text-teal-200 transition-colors">Privacy Policy</Link>
            <span className="text-teal-700">|</span>
            <Link to="/terms"    className="hover:text-teal-200 transition-colors">Terms of Service</Link>
            <span className="text-teal-700">|</span>
            <Link to="/cookies"  className="hover:text-teal-200 transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;