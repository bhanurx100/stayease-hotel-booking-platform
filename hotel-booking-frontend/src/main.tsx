/**
 * hotel-booking-frontend/src/main.tsx
 *
 * ── Google OAuth fix (root cause) ────────────────────────────────────────────
 *
 * PROBLEM: The previous version used require("@react-oauth/google") inside a
 * try/catch at module level. This DOES NOT WORK in Vite/ESM — Vite bundles
 * all modules as ES modules and does not support synchronous CJS require().
 * At runtime the require() call silently fails, GoogleOAuthProvider stays null,
 * and the Google button is never rendered even when the package is installed.
 *
 * FIX: Use a proper top-level ESM import for GoogleOAuthProvider.
 * The conditional logic moves to RENDER TIME — we check if clientId exists
 * before wrapping. If VITE_GOOGLE_CLIENT_ID is not set in .env, the app
 * renders without the wrapper (no crash, Google button hidden automatically).
 *
 * This is the ONLY pattern that works correctly with Vite:
 *   import { GoogleOAuthProvider } from "@react-oauth/google";
 *   const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
 *   render: id ? <GoogleOAuthProvider clientId={id}><App/></GoogleOAuthProvider>
 *              : <App/>
 *
 * ── Pre-requisite ─────────────────────────────────────────────────────────────
 *   npm install @react-oauth/google   (if not already installed)
 *   Add to frontend .env:
 *     VITE_GOOGLE_CLIENT_ID=1007459125897-173v8b43ivt7gnhjill13s...
 */

import React                                from "react";
import ReactDOM                             from "react-dom/client";
import App                                  from "./App.tsx";
import "./index.css";
import { QueryClient, QueryClientProvider } from "react-query";
import { AppContextProvider }               from "./contexts/AppContext.tsx";
import { SearchContextProvider }            from "./contexts/SearchContext.tsx";
import { CurrencyProvider }                 from "./contexts/CurrencyContext.tsx";
// ── Proper ESM import — works correctly with Vite ────────────────────────────
import { GoogleOAuthProvider }              from "@react-oauth/google";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 0 } },
});

// Read Google client ID — set in frontend .env as VITE_GOOGLE_CLIENT_ID
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// ── Core app tree (always rendered) ──────────────────────────────────────────

const AppTree = (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppContextProvider>
        <SearchContextProvider>
          <CurrencyProvider>
            <App />
          </CurrencyProvider>
        </SearchContextProvider>
      </AppContextProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

// ── Conditional GoogleOAuthProvider wrap ──────────────────────────────────────
// GoogleOAuthProvider MUST wrap the whole tree so that GoogleLogin (used in
// SignIn.tsx) has access to the OAuth context. Without this wrapper, GoogleLogin
// throws "Invalid hook call" because it internally calls useGoogleOAuth().
//
// We only wrap when clientId is present — if VITE_GOOGLE_CLIENT_ID is missing
// from .env, we render the bare AppTree (no crash, Google button hidden).

const Root = googleClientId
  ? (
    <GoogleOAuthProvider clientId={googleClientId}>
      {AppTree}
    </GoogleOAuthProvider>
  )
  : AppTree;

ReactDOM.createRoot(document.getElementById("root")!).render(Root);