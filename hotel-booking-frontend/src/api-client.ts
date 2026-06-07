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

export { getApiBaseUrl };

// ─── User ─────────────────────────────────────────────────────────────────────

export const fetchCurrentUser = async (): Promise<UserType> => {
  const response = await axiosInstance.get("/api/users/me");
  return response.data;
};

export {
  googleLogin,
  register,
  signIn,
  validateToken,
  signOut,
} from "./features/auth/services/authApi";

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

/**
 * Fetch fully enriched hotel details from /api/hotels/details/:id.
 * Returns EnrichedHotel with rooms, pricing, reviews, nearby, images from
 * RapidAPI + Google Places + (optionally) Tripadvisor + Expedia.
 * Works for both DB hotels and external (booking_*) hotels.
 */
export const getHotelDetail = async (hotelId: string): Promise<any> => {
  console.log("[getHotelDetail] fetching details for:", hotelId);
  try {
    const response = await axiosInstance.get(`/api/hotels/details/${hotelId}`);
    console.log("[getHotelDetail] received:", response.data?.name, "source:", response.data?.source);
    return response.data;
  } catch (err: any) {
    console.error("[getHotelDetail] error:", err?.response?.data?.message ?? err?.message);
    throw err;
  }
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

export const createRoomBooking = async (
  formData: BookingFormData
): Promise<{ bookingId: string; message: string }> => {
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