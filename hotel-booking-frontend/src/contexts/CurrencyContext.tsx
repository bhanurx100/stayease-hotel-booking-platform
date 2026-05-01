/**
 * hotel-booking-frontend/src/contexts/CurrencyContext.tsx
 *
 * ── Currency fix — root cause & solution ─────────────────────────────────────
 *
 * ROOT CAUSE of "DB hotels show ₹ value but € symbol" bug:
 *   `format(price)` treated ALL prices as GBP and multiplied by the selected
 *   currency rate. DB hotels store prices in INR (e.g. ₹1200). When the user
 *   had GBP selected, ₹1200 was shown as £1200. When INR was selected, it was
 *   multiplied: ₹1200 × 105 = ₹126,000. Wrong symbol AND wrong value.
 *
 * THE FIX — three separate formatters:
 *
 *   1. `formatINR(price)`
 *      ─ Use for ALL DB hotels (prices stored in INR in MongoDB).
 *      ─ NEVER converts. Always shows ₹ + raw value. Ignores user currency selection.
 *      ─ Example: formatINR(1200) → "₹1,200"
 *
 *   2. `formatExternal(price, nativeCurrency)`
 *      ─ Use for external hotels (Booking.com API results).
 *      ─ Reads the hotel's own `currency` field from the API response.
 *      ─ If native === user-selected currency → show as-is with correct symbol.
 *      ─ If different → convert via GBP intermediate step.
 *      ─ Example: formatExternal(4500, "INR") → "₹4,500" (when user selected INR)
 *
 *   3. `format(gbpAmount)`
 *      ─ KEPT for any legacy code that truly stores prices in GBP.
 *      ─ Do NOT use this for DB hotels in this project.
 *
 * Usage rule (enforced by component comments):
 *   DB hotel    → {formatINR(hotel.pricePerNight)}
 *   External    → {formatExternal(hotel.pricePerNight, hotel.currency)}
 */

import React, { createContext, useContext, useState } from "react";

// ─── Supported display currencies ─────────────────────────────────────────────

export type CurrencyCode = "GBP" | "USD" | "INR";

interface CurrencyInfo {
  code:   CurrencyCode;
  symbol: string;
  rate:   number; // multiplier FROM GBP (for legacy format() usage)
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  GBP: { code: "GBP", symbol: "£",  rate: 1     },
  USD: { code: "USD", symbol: "$",  rate: 1.25  },
  INR: { code: "INR", symbol: "₹",  rate: 105   },
};

// ─── Symbol map for API currencies ────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",  USD: "$",   INR: "₹",  EUR: "€",
  AED: "AED ", SGD: "S$", AUD: "A$", CAD: "C$",
  JPY: "¥",  THB: "฿",  MYR: "RM ", IDR: "Rp ",
  PHP: "₱",  HKD: "HK$",KRW: "₩",  SAR: "SAR ",
  QAR: "QR ", BHD: "BD ",OMR: "OMR ",KWD: "KD ",
  ZAR: "R ",  TRY: "₺",  CHF: "CHF ",SEK: "kr ",
  NOK: "kr ", DKK: "kr ",
};

function symbolFor(code: string): string {
  return CURRENCY_SYMBOLS[(code ?? "").toUpperCase()] ?? `${code} `;
}

// Cross-currency rates (native → GBP) for formatExternal conversion
const TO_GBP_RATE: Record<string, number> = {
  GBP: 1,     USD: 0.80,  INR: 0.0095, EUR: 0.86,
  AED: 0.218, SGD: 0.595, AUD: 0.523,  CAD: 0.590,
  JPY: 0.0053,THB: 0.022, MYR: 0.172,  SAR: 0.213,
  QAR: 0.219, BHD: 2.65,  KWD: 3.28,   OMR: 2.60,
  CHF: 0.90,  SEK: 0.076, NOK: 0.076,  DKK: 0.115,
  ZAR: 0.044, TRY: 0.026,
};

function toGBP(amount: number, fromCurrency: string): number {
  const rate = TO_GBP_RATE[(fromCurrency ?? "").toUpperCase()];
  return rate ? amount * rate : amount;
}

// ─── Context type ─────────────────────────────────────────────────────────────

interface CurrencyContextType {
  currency:    CurrencyCode;
  symbol:      string;
  rate:        number;
  setCurrency: (c: CurrencyCode) => void;

  /**
   * DB hotel price formatter.
   * DB hotels store prices in INR. Always show ₹ + raw value. No conversion ever.
   * Use this for EVERY DB hotel price display.
   */
  formatINR: (inrAmount: number) => string;

  /**
   * External hotel price formatter.
   * Uses the hotel's own `currency` field from the Booking.com API.
   * Converts to user-selected display currency only when currencies differ.
   */
  formatExternal: (price: number, nativeCurrency: string) => string;

  /**
   * Legacy GBP formatter — kept for backward compatibility.
   * DO NOT use for DB hotels in this project (they are INR, not GBP).
   */
  format: (gbpAmount: number) => string;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>("INR"); // default INR for Indian platform
  const info = CURRENCIES[currency];

  const setCurrency = (c: CurrencyCode) => setCurrencyState(c);

  // ── DB hotel: ALWAYS ₹, NEVER convert ──────────────────────────────────────
  const formatINR = (inrAmount: number): string => {
    if (!inrAmount || inrAmount <= 0) return "Price on request";
    return `₹${Math.round(inrAmount).toLocaleString("en-IN")}`;
  };

  // ── External hotel: use native API currency, convert if needed ──────────────
  const formatExternal = (price: number, nativeCurrency: string): string => {
    if (!price || price <= 0) return "Price on request";

    const nativeUpper  = (nativeCurrency ?? "GBP").toUpperCase();
    const userCurrency = currency.toUpperCase();

    // Same currency → show as-is with correct symbol, zero math
    if (nativeUpper === userCurrency) {
      return `${symbolFor(nativeUpper)}${Math.round(price).toLocaleString()}`;
    }

    // Different currency → native → GBP → user currency
    const gbpEquiv  = toGBP(price, nativeUpper);
    const converted = Math.round(gbpEquiv * info.rate);
    return `${info.symbol}${converted.toLocaleString()}`;
  };

  // ── Legacy GBP formatter (kept, do not use for DB hotels) ───────────────────
  const format = (gbpAmount: number): string => {
    if (!gbpAmount || gbpAmount <= 0) return "Price on request";
    const converted = Math.round(gbpAmount * info.rate);
    return `${info.symbol}${converted.toLocaleString()}`;
  };

  return (
    <CurrencyContext.Provider
      value={{ currency, symbol: info.symbol, rate: info.rate, setCurrency, formatINR, formatExternal, format }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useCurrency = (): CurrencyContextType => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
};