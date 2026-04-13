/**
 * hotel-booking-backend/src/routes/auth.ts
 *
 * Handles register, login, logout, and token validation.
 * Google OAuth is supported as an OPTIONAL enhancement — if the frontend
 * sends a Google ID token, we verify it; otherwise email/password works fully.
 *
 * ── Key fixes ─────────────────────────────────────────────────────────────────
 * 1. bcrypt.hash on register, bcrypt.compare on login — no raw password storage.
 * 2. JWT payload includes { userId, email, role } — verifyToken middleware reads
 *    req.userId from the same field used by all booking routes.
 * 3. verifyToken works with Bearer token in Authorization header OR httpOnly cookie.
 * 4. Google button only appears on the LOGIN page (not register), per spec.
 * 5. Fallback: if GOOGLE_CLIENT_ID is not set, Google endpoint returns 501 and
 *    the frontend gracefully falls back to email/password.
 *
 * ── Required .env vars ────────────────────────────────────────────────────────
 *   JWT_SECRET_KEY=<a long random string>
 *   GOOGLE_CLIENT_ID=<optional — enables Google OAuth>
 */

import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt    from "jsonwebtoken";
import { check, validationResult } from "express-validator";
import User from "../models/user";

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JWT_SECRET = () => {
  const s = process.env.JWT_SECRET_KEY;
  if (!s) throw new Error("JWT_SECRET_KEY environment variable is not set.");
  return s;
};

/** Issue a JWT that contains the fields verifyToken middleware expects. */
function signToken(userId: string, email: string, role: string): string {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET(),
    { expiresIn: "7d" }
  );
}

/** Set a short-lived httpOnly cookie with the JWT. */
function setAuthCookie(res: Response, token: string): void {
  res.cookie("auth_token", token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

router.post(
  "/register",
  [
    check("firstName", "First name is required").notEmpty().trim(),
    check("lastName",  "Last name is required").notEmpty().trim(),
    check("email",     "Valid email is required").isEmail().normalizeEmail(),
    check("password",  "Password must be at least 6 characters").isLength({ min: 6 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      const { firstName, lastName, email, password } = req.body;

      // Prevent duplicate accounts
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(400).json({ message: "An account with this email already exists." });
      }

      // Hash password — NEVER store plaintext
      const passwordHash = await bcrypt.hash(password, 12);

      const user = new User({
        firstName,
        lastName,
        email:    email.toLowerCase(),
        password: passwordHash,
        role:     "user",    // default role; admin/owner set manually or via seeder
      });
      await user.save();

      const token = signToken(user._id.toString(), user.email, user.role ?? "user");
      setAuthCookie(res, token);

      return res.status(201).json({
        userId:    user._id,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
        role:      user.role ?? "user",
        token,     // also returned in body for clients that use Authorization header
      });
    } catch (err: any) {
      console.error("[auth/register]", err?.message ?? err);
      return res.status(500).json({ message: "Something went wrong during registration." });
    }
  }
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post(
  "/login",
  [
    check("email",    "Valid email is required").isEmail().normalizeEmail(),
    check("password", "Password is required").notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        // Do not reveal whether the email exists (security best practice)
        return res.status(400).json({ message: "Invalid email or password." });
      }

      // bcrypt.compare — timing-safe comparison
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid email or password." });
      }

      const role  = user.role ?? "user";
      const token = signToken(user._id.toString(), user.email, role);
      setAuthCookie(res, token);

      return res.status(200).json({
        userId:    user._id,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
        role,
        token,
      });
    } catch (err: any) {
      console.error("[auth/login]", err?.message ?? err);
      return res.status(500).json({ message: "Something went wrong during login." });
    }
  }
);

// ─── POST /api/auth/google-login ──────────────────────────────────────────────
// ONLY for login page — not shown on register (per spec).
// If GOOGLE_CLIENT_ID is not set, returns 501 and frontend falls back to
// email/password.

router.post("/google-login", async (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res
      .status(501)
      .json({ message: "Google login is not configured on this server." });
  }

  try {
    // Dynamic import so the app doesn't crash if the package isn't installed
    const { OAuth2Client } = await import("google-auth-library").catch(() => {
      throw new Error("google-auth-library package not installed. Run: npm install google-auth-library");
    });

    const { credential } = req.body; // Google ID token sent by the frontend
    if (!credential) {
      return res.status(400).json({ message: "Google credential is required." });
    }

    const client  = new OAuth2Client(clientId);
    const ticket  = await client.verifyIdToken({
      idToken:  credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(400).json({ message: "Invalid Google token." });
    }

    // Find or create the user
    let user = await User.findOne({ email: payload.email.toLowerCase() });
    if (!user) {
      // Auto-register Google users
      const nameParts = (payload.name ?? "Google User").split(" ");
      user = new User({
        firstName: nameParts[0] ?? "Google",
        lastName:  nameParts.slice(1).join(" ") || "User",
        email:     payload.email.toLowerCase(),
        password:  await bcrypt.hash(Math.random().toString(36), 10), // random, unused
        role:      "user",
        googleId:  payload.sub,
      });
      await user.save();
    }

    const role  = user.role ?? "user";
    const token = signToken(user._id.toString(), user.email, role);
    setAuthCookie(res, token);

    return res.status(200).json({
      userId:    user._id,
      firstName: user.firstName,
      lastName:  user.lastName,
      email:     user.email,
      role,
      token,
    });
  } catch (err: any) {
    console.error("[auth/google-login]", err?.message ?? err);
    return res.status(400).json({
      message: err?.message ?? "Google authentication failed. Please use email and password.",
    });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

router.post("/logout", (_req: Request, res: Response) => {
  res.cookie("auth_token", "", {
    httpOnly: true,
    expires:  new Date(0),
    sameSite: "lax",
  });
  return res.status(200).json({ message: "Logged out successfully." });
});

// ─── GET /api/auth/validate-token ─────────────────────────────────────────────
// Lets the frontend check if a stored token is still valid on page load.

router.get("/validate-token", (req: Request, res: Response) => {
  // Token may come from cookie OR Authorization: Bearer <token>
  const cookieToken = req.cookies?.auth_token as string | undefined;
  const headerAuth  = req.headers.authorization;
  const bearerToken = headerAuth?.startsWith("Bearer ")
    ? headerAuth.slice(7)
    : undefined;

  const token = cookieToken || bearerToken;
  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET()) as {
      userId: string;
      email:  string;
      role:   string;
    };
    return res.status(200).json({
      userId: decoded.userId,
      email:  decoded.email,
      role:   decoded.role,
    });
  } catch {
    return res.status(401).json({ message: "Token is invalid or expired." });
  }
});

export default router;