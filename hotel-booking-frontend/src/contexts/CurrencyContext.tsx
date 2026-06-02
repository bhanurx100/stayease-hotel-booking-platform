import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  CurrencyCode,
  CURRENCY_SYMBOLS,
  INR_PER_UNIT,
  STORAGE_KEY,
  SUPPORTED_CURRENCIES,
  isCurrencyCode,
} from "../config/exchange-rates";

export type { CurrencyCode };
export { SUPPORTED_CURRENCIES as CURRENCIES };

const LOCALE_CURRENCY: Record<string, CurrencyCode> = {
  IN: "INR",
  US: "USD",
  GB: "GBP",
  JP: "JPY",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  IE: "EUR",
  AT: "EUR",
  PT: "EUR",
  BE: "EUR",
};

function detectCurrencyFromLocale(): CurrencyCode {
  try {
    const locale = navigator.language || "en-IN";
    const region = new Intl.Locale(locale).region?.toUpperCase();
    if (region && LOCALE_CURRENCY[region]) return LOCALE_CURRENCY[region];
    if (locale.toLowerCase().includes("en-gb")) return "GBP";
    if (locale.toLowerCase().includes("en-us")) return "USD";
    if (locale.toLowerCase().includes("ja")) return "JPY";
  } catch {
    /* ignore */
  }
  return "INR";
}

function readInitialCurrency(): CurrencyCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isCurrencyCode(stored)) return stored;
  } catch {
    /* ignore */
  }
  return detectCurrencyFromLocale();
}

function normalizeCurrency(code?: string): CurrencyCode {
  const upper = (code ?? "INR").toUpperCase();
  return isCurrencyCode(upper) ? upper : "INR";
}

interface CurrencyContextType {
  currency: CurrencyCode;
  symbol: string;
  setCurrency: (c: CurrencyCode) => void;
  convertPrice: (
    amount: number,
    fromCurrency?: string,
    toCurrency?: CurrencyCode
  ) => number;
  formatPrice: (amount: number, fromCurrency?: string) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined
);

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>(readInitialCurrency);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* ignore */
    }
  }, []);

  const convertPrice = useCallback(
    (
      amount: number,
      fromCurrency?: string,
      toCurrency?: CurrencyCode
    ): number => {
      if (!amount || amount <= 0) return 0;
      const from = normalizeCurrency(fromCurrency);
      const to = toCurrency ?? currency;
      if (from === to) return amount;
      const inr = amount * INR_PER_UNIT[from];
      return inr / INR_PER_UNIT[to];
    },
    [currency]
  );

  const formatPrice = useCallback(
    (amount: number, fromCurrency?: string): string => {
      if (!amount || amount <= 0) return "Price on request";
      const converted = convertPrice(amount, fromCurrency);
      const sym = CURRENCY_SYMBOLS[currency];
      const locale =
        currency === "INR"
          ? "en-IN"
          : currency === "JPY"
            ? "ja-JP"
            : "en-US";
      const formatted = Math.round(converted).toLocaleString(locale);
      return `${sym}${formatted}`;
    },
    [currency, convertPrice]
  );

  const value = useMemo(
    () => ({
      currency,
      symbol: CURRENCY_SYMBOLS[currency],
      setCurrency,
      convertPrice,
      formatPrice,
    }),
    [currency, setCurrency, convertPrice, formatPrice]
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
};
