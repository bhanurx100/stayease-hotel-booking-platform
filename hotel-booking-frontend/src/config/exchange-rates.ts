/** INR value of one unit of each currency (DB prices are stored in INR). */
export const INR_PER_UNIT = {
  INR: 1,
  USD: 83,
  EUR: 90,
  GBP: 105,
  JPY: 0.55,
} as const;

export type CurrencyCode = keyof typeof INR_PER_UNIT;

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
};

export const SUPPORTED_CURRENCIES: CurrencyCode[] = [
  "INR",
  "USD",
  "EUR",
  "GBP",
  "JPY",
];

export const STORAGE_KEY = "stayease_currency";

export function isCurrencyCode(code: string): code is CurrencyCode {
  return code in INR_PER_UNIT;
}
