import axiosInstance, { getApiBaseUrl } from "../../../lib/api-client";
import { queryClient } from "../../../main";

function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanBase = (base ?? "").replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text || text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    console.error(
      `[authApi] Non-JSON response from ${res.url} (${res.status}):`,
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
    data?.message ||
    data?.error ||
    res.statusText ||
    `Request failed with status ${res.status}`
  );
}

export const googleLogin = async (credential: string): Promise<any> => {
  console.log("[googleLogin] Sending credential to:", apiUrl("/api/auth/google-login"));

  const res = await fetch(apiUrl("/api/auth/google-login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ credential }),
  });

  console.log("[googleLogin] Response status:", res.status);

  const data = await safeJson(res);
  console.log("[googleLogin] Response data:", data);

  if (!res.ok) {
    throw new Error(extractError(res, data));
  }

  if (data?.token) {
    localStorage.setItem("auth_token", data.token);
    localStorage.setItem("session_id", data.token);
  }

  queryClient.invalidateQueries("validateToken");
  return data;
};

type RegisterPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export const register = async (payload: RegisterPayload): Promise<any> => {
  console.log("[register] Sending to /api/auth/register:", payload.email);
  try {
    const response = await axiosInstance.post("/api/auth/register", payload);
    const data = response.data;
    console.log("[register] Success:", data?.email);

    if (data?.token) {
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("session_id", data.token);
    }

    queryClient.invalidateQueries("validateToken");
    return data;
  } catch (err: any) {
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      "Registration failed. Please try again.";
    console.error("[register] Error:", msg);
    throw new Error(msg);
  }
};

type SignInPayload = { email: string; password: string };

export const signIn = async (payload: SignInPayload): Promise<any> => {
  console.log("[signIn] Sending to /api/auth/login:", payload.email);
  try {
    const response = await axiosInstance.post("/api/auth/login", payload);
    const data = response.data;
    console.log("[signIn] Success:", data?.email, "role:", data?.role);

    if (data?.token) {
      localStorage.setItem("session_id", data.token);
      localStorage.setItem("auth_token", data.token);
    }
    if (data?.userId) localStorage.setItem("user_id", data.userId);
    if (data?.email) localStorage.setItem("user_email", data.email);

    const name = [data?.firstName, data?.lastName].filter(Boolean).join(" ") || data?.email;
    if (name) localStorage.setItem("user_name", name);

    queryClient.invalidateQueries("validateToken");
    queryClient.refetchQueries("validateToken");

    return data;
  } catch (err: any) {
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      "Login failed. Please check your credentials.";
    console.error("[signIn] Error:", msg);
    throw new Error(msg);
  }
};

export const validateToken = async (): Promise<any> => {
  try {
    const response = await axiosInstance.get("/api/auth/validate-token");
    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 401) throw new Error("Token invalid");
    throw new Error("Token validation failed");
  }
};

export const signOut = async (): Promise<any> => {
  const response = await axiosInstance.post("/api/auth/logout");

  ["session_id", "auth_token", "user_id", "user_email", "user_name", "user_image"]
    .forEach((k) => localStorage.removeItem(k));

  return response.data;
};
