/**
 * hotel-booking-frontend/src/pages/Register.tsx
 *
 * ── Google + Register relationship ────────────────────────────────────────────
 * There is NO separate "Google Register" button — this is by design.
 * When a user clicks "Sign in with Google" on the SignIn page for the FIRST TIME,
 * the backend (auth.ts /api/auth/google-login) automatically creates their account.
 * So Google always handles both sign-in and sign-up in one flow.
 *
 * This Register page handles email + password account creation only.
 *
 * ── Payload: { firstName, lastName, email, password } ─────────────────────────
 * Matches the backend POST /api/auth/register handler exactly.
 *
 * ── Toast: uses `title` key ───────────────────────────────────────────────────
 * Confirmed working in AppContext.
 */

import { useState }          from "react";
import { useForm }           from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import * as apiClient        from "../api-client";
import useAppContext         from "../hooks/useAppContext";
import { Building2, Eye, EyeOff, Loader2, CheckCircle, LogIn } from "lucide-react";

interface RegisterFormData {
  firstName:       string;
  lastName:        string;
  email:           string;
  password:        string;
  confirmPassword: string;
}

const Register = () => {
  const { showToast } = useAppContext();
  const navigate      = useNavigate();
  const [showPwd,   setShowPwd]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>();

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      const response = await apiClient.register({
        firstName: data.firstName.trim(),
        lastName:  data.lastName.trim(),
        email:     data.email.trim().toLowerCase(),
        password:  data.password,
      });

      // Store token under both keys for api-client compatibility
      if (response?.token) {
        localStorage.setItem("auth_token", response.token);
        localStorage.setItem("session_id",  response.token);
      }

      // `title` key — confirmed working in AppContext
      showToast({ title: "Account created! Welcome to Stayease.", type: "SUCCESS" });
      navigate("/");
    } catch (err: any) {
      showToast({
        title: err?.message ?? "Registration failed. Please try again.",
        type:  "ERROR",
      });
    } finally {
      setIsLoading(false);
    }
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
          <h1 className="text-3xl font-bold text-white mt-6 mb-1">Create your account</h1>
          <p className="text-teal-300 text-sm">Join thousands of travellers on Stayease</p>
        </div>

        {/* Google tip banner */}
        <div className="mb-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 flex items-start gap-3">
          <LogIn className="w-4 h-4 text-emerald-300 flex-shrink-0 mt-0.5" />
          <p className="text-teal-200 text-xs leading-relaxed">
            <span className="font-semibold text-white">Have a Google account?</span>{" "}
            No need to register separately — just{" "}
            <Link to="/sign-in" className="text-emerald-300 font-semibold underline hover:text-white">
              sign in with Google
            </Link>{" "}
            and your account will be created automatically.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("firstName", {
                    required:  "First name is required",
                    minLength: { value: 2, message: "At least 2 characters" },
                  })}
                  type="text"
                  placeholder="Arjun"
                  autoComplete="given-name"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                />
                {errors.firstName && (
                  <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("lastName", {
                    required:  "Last name is required",
                    minLength: { value: 2, message: "At least 2 characters" },
                  })}
                  type="text"
                  placeholder="Sharma"
                  autoComplete="family-name"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                />
                {errors.lastName && (
                  <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Email address <span className="text-red-500">*</span>
              </label>
              <input
                {...register("email", {
                  required: "Email is required",
                  pattern:  { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
                })}
                type="email"
                placeholder="arjun@example.com"
                autoComplete="email"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  {...register("password", {
                    required:  "Password is required",
                    minLength: { value: 6, message: "At least 6 characters required" },
                  })}
                  type={showPwd ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
                />
                <button type="button" onClick={() => setShowPwd((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                {...register("confirmPassword", {
                  required: "Please confirm your password",
                  validate: (v) => v === watch("password") || "Passwords do not match",
                })}
                type={showPwd ? "text" : "password"}
                placeholder="Re-enter password"
                autoComplete="new-password"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Hints */}
            <ul className="text-xs text-gray-400 space-y-1">
              {["At least 6 characters", "Mix of letters and numbers recommended"].map((rule) => (
                <li key={rule} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3 text-teal-400 flex-shrink-0" />{rule}
                </li>
              ))}
            </ul>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-semibold py-3 rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>
              ) : (
                "Create Account"
              )}
            </button>

            <p className="text-center text-sm text-gray-500 mt-4">
              Already have an account?{" "}
              <Link to="/sign-in" className="text-teal-600 font-semibold hover:text-teal-700">
                Sign in
              </Link>
            </p>
          </form>
        </div>

        <p className="text-center text-xs text-teal-400/70 mt-6">
          By creating an account, you agree to our{" "}
          <Link to="/terms" className="underline hover:text-teal-300">Terms of Service</Link>
          {" "}and{" "}
          <Link to="/privacy" className="underline hover:text-teal-300">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
};

export default Register;