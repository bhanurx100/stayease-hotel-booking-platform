/**
 * hotel-booking-backend/src/middleware/auth.ts  (verifyToken middleware)
 *
 * ── What this does ────────────────────────────────────────────────────────────
 * Reads the JWT from either:
 *   1. Cookie:                  req.cookies.auth_token
 *   2. Authorization header:    Bearer <token>
 *
 * On success: sets req.userId and req.userRole, then calls next().
 * On failure: returns 401.
 *
 * ── Why both sources ─────────────────────────────────────────────────────────
 * Browser requests (SSR / cookie-based apps) send the cookie automatically.
 * Mobile apps or Postman tests send Bearer tokens in the header.
 * Supporting both keeps the API flexible without breaking anything.
 *
 * ── TypeScript augmentation ───────────────────────────────────────────────────
 * Adds userId and userRole to the Express Request type so TypeScript
 * doesn't complain when routes access req.userId.
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Express Request so TypeScript knows about userId / userRole
declare global {
  namespace Express {
    interface Request {
      userId:   string;
      userRole: string;
    }
  }
}

const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  // ── Source 1: httpOnly cookie ─────────────────────────────────────────────
  const cookieToken = req.cookies?.auth_token as string | undefined;

  // ── Source 2: Authorization: Bearer <token> header ────────────────────────
  const authHeader  = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : undefined;

  const token = cookieToken || bearerToken;

  if (!token) {
    res.status(401).json({ message: "Unauthorized: no token provided." });
    return;
  }

  const secret = process.env.JWT_SECRET_KEY;
  if (!secret) {
    console.error("[verifyToken] JWT_SECRET_KEY is not set in environment.");
    res.status(500).json({ message: "Server configuration error." });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as {
      userId: string;
      email:  string;
      role:   string;
    };

    // Attach to request for downstream handlers
    req.userId   = decoded.userId;
    req.userRole = decoded.role ?? "user";

    next();
  } catch (err: any) {
    const msg = err?.name === "TokenExpiredError"
      ? "Session expired — please log in again."
      : "Unauthorized: invalid token.";
    res.status(401).json({ message: msg });
  }
};

export default verifyToken;