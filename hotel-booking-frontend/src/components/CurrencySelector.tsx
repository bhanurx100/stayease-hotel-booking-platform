/**
 * hotel-booking-frontend/src/components/CurrencySelector.tsx
 *
 * Compact dropdown placed in the Header.
 * Reads/writes the global CurrencyContext.
 */

import { useCurrency, CURRENCIES, CurrencyCode } from "../contexts/CurrencyContext";

const CurrencySelector = () => {
  const { currency, setCurrency } = useCurrency();

  return (
    <select
      value={currency}
      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
      className="
        bg-white/10 text-white text-sm font-medium
        border border-white/20 rounded-lg
        px-2 py-1.5 cursor-pointer
        hover:bg-white/20 transition-colors
        focus:outline-none focus:ring-2 focus:ring-white/40
      "
      aria-label="Select currency"
    >
      {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
        <option key={code} value={code} className="bg-primary-700 text-white">
          {CURRENCIES[code].symbol} {code}
        </option>
      ))}
    </select>
  );
};

export default CurrencySelector;