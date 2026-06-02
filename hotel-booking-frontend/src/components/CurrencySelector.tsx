import { useCurrency } from "../contexts/CurrencyContext";
import {
  CURRENCY_SYMBOLS,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
} from "../config/exchange-rates";

const CurrencySelector = () => {
  const { currency, setCurrency } = useCurrency();

  return (
    <select
      value={currency}
      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
      className="bg-white/10 text-white text-sm font-medium border border-white/20 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
      aria-label="Select currency"
    >
      {SUPPORTED_CURRENCIES.map((code) => (
        <option key={code} value={code} className="bg-teal-800 text-white">
          {CURRENCY_SYMBOLS[code]} {code}
        </option>
      ))}
    </select>
  );
};

export default CurrencySelector;
