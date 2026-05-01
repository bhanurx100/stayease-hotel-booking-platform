/**
 * hotel-booking-frontend/src/pages/SignIn.tsx
 *
 * ── Fixes in this version ─────────────────────────────────────────────────────
 *
 * 1. GOOGLE LOGIN — PROPER ESM IMPORT
 *    `GoogleLogin` is now imported at the top level using proper ESM:
 *      import { GoogleLogin } from "@react-oauth/google";
 *    This works because GoogleOAuthProvider now correctly wraps the entire app
 *    in main.tsx — GoogleLogin can safely use hooks (useGoogleOAuth internally)
 *    because its context is available from the parent tree.
 *
 *    The "Invalid hook call" error was caused by TWO things together:
 *      a) GoogleOAuthProvider was NOT wrapping the tree (broken require() in main.tsx)
 *      b) GoogleLogin uses hooks internally — without the Provider, React throws
 *    Both are now fixed.
 *
 *    Visibility guard: button only renders when VITE_GOOGLE_CLIENT_ID is set.
 *    If env is missing → button hidden, no crash.
 *
 * 2. DEMO QUICK-FILL BUTTONS
 *    Three buttons (User / Owner / Admin) auto-fill email + password fields.
 *    Uses react-hook-form's `setValue` to properly update the form state.
 *    Does NOT auto-submit — user clicks "Sign in" manually.
 *    Placeholder text updated to show demo credentials format.
 *
 * 3. TOAST: uses `title` key — confirmed working by user ("title works, message won't")
 *
 * 4. TOKEN STORAGE: mirrors both "auth_token" and "session_id" for compatibility
 *    with the existing api-client.ts which uses "session_id".
 */

import { useState }          from "react";
import { useForm }           from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import * as apiClient        from "../api-client";
import useAppContext         from "../hooks/useAppContext";
import { Building2, Eye, EyeOff, Loader2, Zap } from "lucide-react";
// ── Proper top-level ESM import — works with Vite, requires GoogleOAuthProvider
//    to be present in the parent tree (main.tsx handles this) ─────────────────
import { GoogleLogin }       from "@react-oauth/google";

// ─── Form types ───────────────────────────────────────────────────────────────

interface SignInFormData {
  email:    string;
  password: string;
}

// ─── Demo account definitions ─────────────────────────────────────────────────

const DEMO_ACCOUNTS = [
  { role: "User",  email: "user@test.com",  password: "123456", color: "bg-teal-600 hover:bg-teal-700"    },
  { role: "Owner", email: "owner@test.com", password: "123456", color: "bg-amber-500 hover:bg-amber-600"  },
  { role: "Admin", email: "admin@test.com", password: "123456", color: "bg-purple-600 hover:bg-purple-700"},
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

const SignIn = () => {
  const { showToast } = useAppContext();
  const navigate      = useNavigate();
  const [showPwd,       setShowPwd]       = useState(false);
  const [isLoading,     setIsLoading]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,              // ← used by demo quick-fill
    formState: { errors },
  } = useForm<SignInFormData>();

  // Whether Google button is shown: env var must be present
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const showGoogleBtn  = !!googleClientId;

  // ── Demo quick-fill ────────────────────────────────────────────────────────
  // Fills email + password fields, does NOT submit.
  // Uses setValue so react-hook-form's state is properly updated.
  const fillDemo = (email: string, password: string) => {
    setValue("email",    email,    { shouldValidate: false, shouldDirty: true });
    setValue("password", password, { shouldValidate: false, shouldDirty: true });
  };

  // ── Email / password login ─────────────────────────────────────────────────
  const onSubmit = async (data: SignInFormData) => {
    setIsLoading(true);
    try {
      const response = await apiClient.signIn({
        email:    data.email.trim().toLowerCase(),
        password: data.password,
      });

      if (response?.token) {
        localStorage.setItem("auth_token", response.token);
        // session_id already set inside apiClient.signIn() per existing api-client.ts
      }

      showToast({ title: "Welcome back to Stayease!", type: "SUCCESS" });
      navigate("/");
    } catch (err: any) {
      showToast({
        title: err?.message ?? "Login failed. Check your email and password.",
        type:  "ERROR",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Google login ───────────────────────────────────────────────────────────
  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse?.credential) return;
    setGoogleLoading(true);
    try {
      const response = await apiClient.googleLogin(credentialResponse.credential);

      if (response?.token) {
        localStorage.setItem("auth_token", response.token);
        localStorage.setItem("session_id",  response.token);
      }

      showToast({
        title: `Welcome, ${response?.firstName ?? ""}! Signed in with Google.`,
        type:  "SUCCESS",
      });
      navigate("/");
    } catch (err: any) {
      showToast({
        title: err?.message ?? "Google sign-in failed. Please use email and password.",
        type:  "ERROR",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    showToast({
      title: "Google sign-in was cancelled. Please try email and password.",
      type:  "ERROR",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-950 via-teal-900 to-emerald-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="bg-white/15 p-2.5 rounded-xl">
              <Building2 className="w-6 h-6 text-emerald-300" />
            </div>
            <span className="text-2xl font-extrabold text-white">Stayease</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mt-6 mb-1">Welcome back</h1>
          <p className="text-teal-300 text-sm">Sign in to manage your stays</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {/* ── Google Sign-In ────────────────────────────────────────────── */}
          {/* Only rendered when VITE_GOOGLE_CLIENT_ID is set in .env ────────── */}
          {showGoogleBtn && (
            <div className="mb-5">
              {googleLoading ? (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-500 border border-gray-200 rounded-xl">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in with Google…
                </div>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="outline"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                  width="100%"
                />
              )}

              <div className="flex items-center gap-3 mt-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">or sign in with email</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            </div>
          )}

          {/* ── Email / Password form ──────────────────────────────────────── */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Email address
              </label>
              <input
                {...register("email", {
                  required: "Email is required",
                  pattern:  { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
                })}
                type="email"
                // Updated placeholder shows all demo accounts
                placeholder="user@test.com / owner@test.com / admin@test.com"
                autoComplete="email"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-semibold text-gray-700">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  {...register("password", { required: "Password is required" })}
                  type={showPwd ? "text" : "password"}
                  // Shows "123456" hint for demo accounts
                  placeholder="123456"
                  autoComplete="current-password"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || googleLoading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
              ) : (
                "Sign in"
              )}
            </button>

            <p className="text-center text-sm text-gray-500">
              Don't have an account?{" "}
              <Link to="/register" className="text-teal-600 font-semibold hover:text-teal-700">
                Create one
              </Link>
            </p>
          </form>
        </div>

        {/* ── Demo quick-fill section ────────────────────────────────────── */}
        <div className="mt-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-yellow-400" />
            <p className="text-teal-200 text-sm font-semibold">Quick demo login</p>
          </div>
          <p className="text-white/60 text-xs mb-3">
            Click any button below to auto-fill credentials, then press Sign in.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map(({ role, email, password, color }) => (
              <button
                key={role}
                type="button"
                onClick={() => fillDemo(email, password)}
                className={`
                  ${color} text-white text-xs font-bold
                  py-2.5 px-2 rounded-xl
                  transition-all duration-150 active:scale-95
                  flex flex-col items-center gap-0.5
                `}
              >
                <span>{role}</span>
                <span className="text-white/70 font-normal text-[10px]">Demo</span>
              </button>
            ))}
          </div>
          <p className="text-white/40 text-[10px] text-center mt-2">
            All demo accounts use password: 123456
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;