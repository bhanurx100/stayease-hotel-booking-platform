/**
 * hotel-booking-frontend/src/api-client.ts
 *
 * ── Root cause of JSON errors fixed here ─────────────────────────────────────
 *
 * ISSUE: `googleLogin` was using `fetch("/api/auth/google-login")` — a RELATIVE
 * URL. In Vite dev mode, relative fetch calls go to the Vite dev server (port
 * 5173), NOT the Express backend (port 5000). The Vite dev server doesn't know
 * this route and returns an HTML 404 page. `JSON.parse("<html>…")` throws:
 *   "Unexpected token <, "<html>..." is not valid JSON"
 *
 * FIX: Use `getApiBaseUrl()` to build the full URL for ALL raw fetch() calls.
 * axiosInstance already has the correct baseURL configured — this aligns fetch
 * calls with the same base.
 *
 * Same fix applied to `safeJson` calls in Detail.tsx (see that file).
 *
 * ── Everything else ───────────────────────────────────────────────────────────
 * All other functions (signIn, register, fetchHotels, etc.) use axiosInstance
 * which already has the correct baseURL — they are NOT changed.
 */

import axiosInstance, { getApiBaseUrl } from "./lib/api-client";
import {
  HotelSearchResponse,
  HotelType,
  PaymentIntentResponse,
  UserType,
  HotelWithBookingsType,
  BookingType,
} from "../../shared/types";
import { BookingFormData } from "./forms/BookingForm/BookingForm";
import { queryClient }     from "./main";

export { getApiBaseUrl };

// ─── URL builder ──────────────────────────────────────────────────────────────

/**
 * Build a full API URL.
 * In dev:  http://localhost:5000/api/auth/google-login
 * In prod: /api/auth/google-login (same origin)
 *
 * This ensures raw fetch() calls reach the Express backend, not Vite's dev server.
 */
function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  // base may be "" (production, same origin) or "http://localhost:5000" (dev)
  // Remove trailing slash from base, ensure path starts with /
  const cleanBase = (base ?? "").replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

// ─── Safe JSON helper ─────────────────────────────────────────────────────────

/**
 * Parse a fetch Response as JSON safely.
 * If the server returns HTML (nginx error, proxy miss, etc.) instead of JSON,
 * this returns { message: "..." } instead of crashing with "Unexpected token <".
 */
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text || text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    console.error(
      `[api-client] Non-JSON response from ${res.url} (${res.status}):`,
      text.slice(0, 300)
    );
    return {
      message: `Server error (${res.status}). ${
        text.startsWith("<") ? "Got HTML — check API proxy/baseURL config." : text.slice(0, 100)
      }`,
    };
  }
}

function extractError(res: Response, data: any): string {
  return (
    data?.message  ||
    data?.error    ||
    res.statusText ||
    `Request failed with status ${res.status}`
  );
}

// ─── User ─────────────────────────────────────────────────────────────────────

export const fetchCurrentUser = async (): Promise<UserType> => {
  const response = await axiosInstance.get("/api/users/me");
  return response.data;
};

// ─── Auth: Google Login ───────────────────────────────────────────────────────

export const googleLogin = async (credential: string): Promise<any> => {
  // ── BUG FIX: was fetch("/api/auth/google-login") — relative URL hits Vite,
  //    not Express. Now uses apiUrl() to build the full backend URL. ──────────
  console.log("[googleLogin] Sending credential to:", apiUrl("/api/auth/google-login"));

  const res = await fetch(apiUrl("/api/auth/google-login"), {
    method:      "POST",
    headers:     { "Content-Type": "application/json" },
    credentials: "include",
    body:        JSON.stringify({ credential }),
  });

  console.log("[googleLogin] Response status:", res.status);

  const data = await safeJson(res);
  console.log("[googleLogin] Response data:", data);

  if (!res.ok) {
    throw new Error(extractError(res, data));
  }

  if (data?.token) {
    localStorage.setItem("auth_token", data.token);
    localStorage.setItem("session_id",  data.token);
  }

  queryClient.invalidateQueries("validateToken");
  return data;
};

// ─── Auth: Register ───────────────────────────────────────────────────────────

type RegisterPayload = {
  firstName: string;
  lastName:  string;
  email:     string;
  password:  string;
};

export const register = async (payload: RegisterPayload): Promise<any> => {
  console.log("[register] Sending to /api/auth/register:", payload.email);
  try {
    const response = await axiosInstance.post("/api/auth/register", payload);
    const data = response.data;
    console.log("[register] Success:", data?.email);

    if (data?.token) {
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("session_id",  data.token);
    }

    queryClient.invalidateQueries("validateToken");
    return data;
  } catch (err: any) {
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error   ||
      err?.message                  ||
      "Registration failed. Please try again.";
    console.error("[register] Error:", msg);
    throw new Error(msg);
  }
};

// ─── Auth: Sign In ────────────────────────────────────────────────────────────

type SignInPayload = { email: string; password: string };

export const signIn = async (payload: SignInPayload): Promise<any> => {
  console.log("[signIn] Sending to /api/auth/login:", payload.email);
  try {
    const response = await axiosInstance.post("/api/auth/login", payload);
    const data = response.data;
    console.log("[signIn] Success:", data?.email, "role:", data?.role);

    if (data?.token) {
      localStorage.setItem("session_id",  data.token);
      localStorage.setItem("auth_token",  data.token);
    }
    if (data?.userId)    localStorage.setItem("user_id",    data.userId);
    if (data?.email)     localStorage.setItem("user_email", data.email);

    const name = [data?.firstName, data?.lastName].filter(Boolean).join(" ") || data?.email;
    if (name) localStorage.setItem("user_name", name);

    // Invalidate — do NOT call validateToken() directly (can fail in incognito)
    queryClient.invalidateQueries("validateToken");
    queryClient.refetchQueries("validateToken");

    return data;
  } catch (err: any) {
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error   ||
      err?.message                  ||
      "Login failed. Please check your credentials.";
    console.error("[signIn] Error:", msg);
    throw new Error(msg);
  }
};

// ─── Auth: Validate Token ─────────────────────────────────────────────────────

export const validateToken = async (): Promise<any> => {
  try {
    const response = await axiosInstance.get("/api/auth/validate-token");
    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 401) throw new Error("Token invalid");
    throw new Error("Token validation failed");
  }
};

// ─── Auth: Sign Out ───────────────────────────────────────────────────────────

export const signOut = async (): Promise<any> => {
  const response = await axiosInstance.post("/api/auth/logout");

  ["session_id", "auth_token", "user_id", "user_email", "user_name", "user_image"]
    .forEach((k) => localStorage.removeItem(k));

  return response.data;
};

// ─── Hotels ───────────────────────────────────────────────────────────────────

export const addMyHotel = async (hotelFormData: FormData): Promise<any> => {
  const response = await axiosInstance.post("/api/my-hotels", hotelFormData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const fetchMyHotels = async (): Promise<HotelType[]> => {
  const response = await axiosInstance.get("/api/my-hotels");
  return response.data;
};

export const fetchMyHotelById = async (hotelId: string): Promise<HotelType> => {
  const response = await axiosInstance.get(`/api/my-hotels/${hotelId}`);
  return response.data;
};

export const updateMyHotelById = async (hotelFormData: FormData): Promise<any> => {
  const hotelId = hotelFormData.get("hotelId");
  const response = await axiosInstance.put(
    `/api/my-hotels/${hotelId}`,
    hotelFormData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return response.data;
};

export type SearchParams = {
  destination?: string;
  checkIn?:     string;
  checkOut?:    string;
  adultCount?:  string;
  childCount?:  string;
  page?:        string;
  facilities?:  string[];
  types?:       string[];
  stars?:       string[];
  maxPrice?:    string;
  sortOption?:  string;
  limit?:       string;
};

export const searchHotels = async (
  searchParams: SearchParams
): Promise<HotelSearchResponse> => {
  const queryParams = new URLSearchParams();

  if (searchParams.destination?.trim())
    queryParams.append("destination", searchParams.destination.trim());

  queryParams.append("checkIn",    searchParams.checkIn    || "");
  queryParams.append("checkOut",   searchParams.checkOut   || "");
  queryParams.append("adultCount", searchParams.adultCount || "");
  queryParams.append("childCount", searchParams.childCount || "");
  queryParams.append("page",       searchParams.page       || "");
  queryParams.append("maxPrice",   searchParams.maxPrice   || "");
  queryParams.append("sortOption", searchParams.sortOption || "");
  if (searchParams.limit) queryParams.append("limit", searchParams.limit);

  searchParams.facilities?.forEach((f) => queryParams.append("facilities", f));
  searchParams.types?.forEach((t)      => queryParams.append("types", t));
  searchParams.stars?.forEach((s)      => queryParams.append("stars", s));

  const response = await axiosInstance.get(`/api/hotels/search?${queryParams}`);
  return response.data;
};

export const fetchHotels = async (): Promise<HotelType[]> => {
  const response = await axiosInstance.get("/api/hotels");
  return Array.isArray(response.data) ? response.data : [];
};

export const fetchHotelById = async (hotelId: string): Promise<HotelType> => {
  const response = await axiosInstance.get(`/api/hotels/${hotelId}`);
  return response.data;
};

// ─── Bookings ─────────────────────────────────────────────────────────────────

export const createPaymentIntent = async (
  hotelId:        string,
  numberOfNights: string
): Promise<PaymentIntentResponse> => {
  const response = await axiosInstance.post(
    `/api/hotels/${hotelId}/bookings/payment-intent`,
    { numberOfNights }
  );
  return response.data;
};

export const createRoomBooking = async (formData: BookingFormData): Promise<any> => {
  const response = await axiosInstance.post(
    `/api/hotels/${formData.hotelId}/bookings`,
    formData
  );
  return response.data;
};

export const fetchMyBookings = async (): Promise<HotelWithBookingsType[]> => {
  const response = await axiosInstance.get("/api/my-bookings");
  return Array.isArray(response.data) ? response.data : [];
};

export const fetchHotelBookings = async (hotelId: string): Promise<BookingType[]> => {
  const response = await axiosInstance.get(`/api/bookings/hotel/${hotelId}`);
  return Array.isArray(response.data) ? response.data : [];
};

// ─── Business Insights ────────────────────────────────────────────────────────

export const fetchBusinessInsightsDashboard = async (): Promise<any> => {
  const response = await axiosInstance.get("/api/business-insights/dashboard/public");
  return response.data;
};

export const fetchBusinessInsightsForecast = async (): Promise<any> => {
  const response = await axiosInstance.get("/api/business-insights/forecast/public");
  return response.data;
};

export const fetchBusinessInsightsPerformance = async (): Promise<any> => {
  const response = await axiosInstance.get("/api/business-insights/system-stats/public");
  return response.data;
};

// ─── Dev utility ──────────────────────────────────────────────────────────────

export const clearAllStorage = (): void => {
  localStorage.clear();
  sessionStorage.clear();
  document.cookie.split(";").forEach((c) => {
    document.cookie = c
      .replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
};