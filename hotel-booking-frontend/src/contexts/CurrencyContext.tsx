/**
 * hotel-booking-frontend/src/contexts/CurrencyContext.tsx
 *
 * ── What changed in this version ─────────────────────────────────────────────
 *
 * ROOT CAUSE of wrong currency symbols on external hotels:
 *   The old context treated ALL prices as GBP and converted everything
 *   using a fixed multiplier. Indian hotels (pricePerNight in INR, e.g. ₹4500)
 *   were then shown as £4500 or — worse — multiplied: ₹4500 × 105 = ₹472,500.
 *
 * FIX:
 *   1. `formatExternal(price, nativeCurrency)` — NEW function.
 *      Use this for external hotels. It reads the hotel's OWN `currency` field
 *      (set by the backend from the API response) and:
 *      - If the user has selected the SAME currency → show price as-is with symbol.
 *      - If the user has selected a DIFFERENT currency → convert using exchange rates.
 *      Never double-converts. Never shows wrong symbol.
 *
 *   2. `format(gbpAmount)` — UNCHANGED. Still used for DB hotels (which store
 *      prices in GBP and need conversion to user's selected currency).
 *
 *   3. Added `CURRENCY_SYMBOLS` map so any currency code from the API can
 *      be rendered with the correct symbol (₹, $, €, £, etc.).
 *
 * Usage in components:
 *   DB hotel:      {format(hotel.pricePerNight)}
 *   External hotel:{formatExternal(hotel.pricePerNight, hotel.currency)}
 */

import React, { createContext, useContext, useState } from "react";

// ─── Supported display currencies ─────────────────────────────────────────────

export type CurrencyCode = "GBP" | "USD" | "INR";

interface CurrencyInfo {
  code:   CurrencyCode;
  symbol: string;
  rate:   number; // multiplier FROM GBP
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  GBP: { code: "GBP", symbol: "£",  rate: 1     },
  USD: { code: "USD", symbol: "$",  rate: 1.25  },
  INR: { code: "INR", symbol: "₹",  rate: 105   },
};

// ─── Symbol map for all currencies the API may return ─────────────────────────
// Covers every common currency Booking.com may return in `gross_amount_per_night.currency`.
// Add more as needed.

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  INR: "₹",
  EUR: "€",
  AED: "AED ",
  SGD: "S$",
  AUD: "A$",
  CAD: "C$",
  JPY: "¥",
  THB: "฿",
  MYR: "RM ",
  IDR: "Rp ",
  PHP: "₱",
  HKD: "HK$",
  KRW: "₩",
  SAR: "SAR ",
  QAR: "QR ",
  BHD: "BD ",
  OMR: "OMR ",
  KWD: "KD ",
  ZAR: "R ",
  TRY: "₺",
  CHF: "CHF ",
  SEK: "kr ",
  NOK: "kr ",
  DKK: "kr ",
};

function symbolFor(code: string): string {
  return CURRENCY_SYMBOLS[code?.toUpperCase()] ?? code + " ";
}

/**
 * Exchange rates FROM various currencies TO GBP (so we can then convert
 * to the user's selected display currency in two steps).
 * These are approximate mid-market rates — update periodically or use a live API.
 *
 * Conversion path: native → GBP → user currency
 */
const TO_GBP_RATE: Record<string, number> = {
  GBP: 1,
  USD: 0.80,
  INR: 0.0095,
  EUR: 0.86,
  AED: 0.218,
  SGD: 0.595,
  AUD: 0.523,
  CAD: 0.590,
  JPY: 0.0053,
  THB: 0.022,
  MYR: 0.172,
  SAR: 0.213,
  QAR: 0.219,
  BHD: 2.65,
  KWD: 3.28,
  OMR: 2.60,
  CHF: 0.90,
  SEK: 0.076,
  NOK: 0.076,
  DKK: 0.115,
  ZAR: 0.044,
  TRY: 0.026,
};

function toGBP(amount: number, fromCurrency: string): number {
  const rate = TO_GBP_RATE[fromCurrency?.toUpperCase()];
  if (!rate) return amount; // unknown currency → pass through
  return amount * rate;
}

// ─── Context types ─────────────────────────────────────────────────────────────

interface CurrencyContextType {
  currency:    CurrencyCode;
  symbol:      string;
  rate:        number;
  setCurrency: (c: CurrencyCode) => void;

  /**
   * Format a GBP amount for display.
   * Use this for DB hotels (prices stored in GBP).
   */
  format: (gbpAmount: number) => string;

  /**
   * Format an external hotel price that already has a known native currency.
   * Use this for external hotels — never blindly convert INR prices with GBP rates.
   *
   * @param price          Exact price from API (e.g. 4500 for ₹4500)
   * @param nativeCurrency Currency code from API (e.g. "INR", "GBP", "USD")
   */
  formatExternal: (price: number, nativeCurrency: string) => string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>("GBP");
  const info = CURRENCIES[currency];

  const setCurrency = (c: CurrencyCode) => setCurrencyState(c);

  /** DB hotel price: GBP amount → user's selected display currency */
  const format = (gbpAmount: number): string => {
    if (!gbpAmount || gbpAmount <= 0) return "Price on request";
    const converted = Math.round(gbpAmount * info.rate);
    return `${info.symbol}${converted.toLocaleString()}`;
  };

  /**
   * External hotel price: native currency → user's selected display currency.
   *
   * If nativeCurrency === user's selected currency → show as-is (no conversion).
   * If they differ → convert via GBP as an intermediate step.
   */
  const formatExternal = (price: number, nativeCurrency: string): string => {
    if (!price || price <= 0) return "Price on request";

    const nativeUpper = (nativeCurrency ?? "GBP").toUpperCase();
    const userCurrency = currency.toUpperCase();

    // Same currency — show with correct symbol, no math
    if (nativeUpper === userCurrency) {
      return `${symbolFor(nativeUpper)}${Math.round(price).toLocaleString()}`;
    }

    // Different currency — convert: native → GBP → user currency
    const gbpEquiv    = toGBP(price, nativeUpper);
    const converted   = Math.round(gbpEquiv * info.rate);
    return `${info.symbol}${converted.toLocaleString()}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        symbol:   info.symbol,
        rate:     info.rate,
        setCurrency,
        format,
        formatExternal,
      }}
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