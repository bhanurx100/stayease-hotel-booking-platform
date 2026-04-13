/**
 * hotel-booking-frontend/src/main.tsx
 *
 * ── Change ────────────────────────────────────────────────────────────────────
 * Wrap the app with <CurrencyProvider> so useCurrency() works everywhere.
 * Everything else is unchanged.
 */

import React        from "react";
import ReactDOM     from "react-dom/client";
import App          from "./App.tsx";
import "./index.css";
import { QueryClient, QueryClientProvider } from "react-query";
import { AppContextProvider }               from "./contexts/AppContext.tsx";
import { SearchContextProvider }            from "./contexts/SearchContext.tsx";
import { CurrencyProvider }                 from "./contexts/CurrencyContext.tsx"; // ← NEW

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 0 } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppContextProvider>
        <SearchContextProvider>
          {/* ── NEW: global currency context ─────────────────────────── */}
          <CurrencyProvider>
            <App />
          </CurrencyProvider>
        </SearchContextProvider>
      </AppContextProvider>
    </QueryClientProvider>
  </React.StrictMode>
);