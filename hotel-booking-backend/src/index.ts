/**
 * hotel-booking-backend/src/index.ts
 *
 * ── MongoDB Connection Fix ────────────────────────────────────────────────────
 * Added: tls, tlsAllowInvalidCertificates, serverSelectionTimeoutMS,
 *        connectTimeoutMS, socketTimeoutMS, and retry logic.
 * These options fix MongoServerSelectionError (TLS/SSL alert) that happens
 * when connecting to MongoDB Atlas from certain network environments.
 *
 * ── Stripe Safe Guard ─────────────────────────────────────────────────────────
 * Stripe is only initialised if STRIPE_API_KEY is present.
 * App still boots without it (payments disabled gracefully).
 */

import express      from "express";
import cors         from "cors";
import "dotenv/config";
import mongoose     from "mongoose";
import cookieParser from "cookie-parser";
import path         from "path";
import { v2 as cloudinary } from "cloudinary";

import authRoutes        from "./routes/auth";
import hotelRoutes       from "./routes/hotels";
import myHotelRoutes     from "./routes/my-hotels";
import bookingRoutes     from "./routes/my-bookings";
import userRoutes        from "./routes/users";
import aiRoutes          from "./routes/ai";

// ─── Cloudinary (optional) ────────────────────────────────────────────────────

if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS — allow frontend origin in dev and production
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL ?? "http://localhost:5173",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api/auth",        authRoutes);
app.use("/api/hotels",      hotelRoutes);
app.use("/api/my-hotels",   myHotelRoutes);
app.use("/api/my-bookings", bookingRoutes);
app.use("/api/users",       userRoutes);
app.use("/api/ai",          aiRoutes);

// Health check — useful for monitoring and Docker
app.get("/api/health", (_req, res) => {
  res.json({
    status:   "ok",
    mongo:    mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    time:     new Date().toISOString(),
  });
});

// Serve frontend in production
const distPath = path.join(__dirname, "../../frontend/dist");
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// ─── MongoDB connection ────────────────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_CONNECTION_STRING;
if (!MONGODB_URI) {
  console.error("❌  MONGODB_CONNECTION_STRING is not set in .env — cannot start.");
  process.exit(1);
}

/**
 * Connect to MongoDB with retry logic.
 * Fixes: MongoServerSelectionError (TLS/SSL alert from Atlas)
 *
 * Options explained:
 *   tls: true                      → enforce TLS (required for Atlas)
 *   tlsAllowInvalidCertificates    → bypass cert validation issues in some
 *                                    environments (dev safe, prod: set to false)
 *   serverSelectionTimeoutMS: 10000 → wait up to 10s for a server
 *   connectTimeoutMS: 15000         → initial TCP connect timeout
 *   socketTimeoutMS: 45000          → per-operation timeout
 *   retryWrites: true               → Atlas default, keeps data safe on failover
 *   maxPoolSize: 10                 → limit concurrent DB connections
 */
const MONGOOSE_OPTIONS: mongoose.ConnectOptions = {
  tls:                          true,
  tlsAllowInvalidCertificates:  process.env.NODE_ENV !== "production",
  serverSelectionTimeoutMS:     10_000,
  connectTimeoutMS:             15_000,
  socketTimeoutMS:              45_000,
  retryWrites:                  true,
  maxPoolSize:                  10,
};

async function connectDB(retries = 5, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(MONGODB_URI!, MONGOOSE_OPTIONS);
      console.log(`✅  MongoDB connected (attempt ${attempt})`);
      return;
    } catch (err: any) {
      console.error(`❌  MongoDB connection attempt ${attempt}/${retries} failed:`, err?.message ?? err);
      if (attempt < retries) {
        console.log(`⏳  Retrying in ${delayMs / 1000}s…`);
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs = Math.min(delayMs * 1.5, 15_000); // exponential backoff, max 15s
      } else {
        console.error("❌  All MongoDB connection attempts failed. Exiting.");
        process.exit(1);
      }
    }
  }
}

// ─── Mongoose connection events ───────────────────────────────────────────────

mongoose.connection.on("connected",    () => console.log("🔗  Mongoose: connected"));
mongoose.connection.on("disconnected", () => console.warn("⚠️  Mongoose: disconnected — will retry"));
mongoose.connection.on("error",        (err) => console.error("🔴  Mongoose error:", err?.message ?? err));

// Auto-reconnect on disconnect
mongoose.connection.on("disconnected", () => {
  console.log("🔄  Attempting MongoDB reconnect…");
  setTimeout(() => connectDB(3, 5000), 5000);
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "5000", 10);

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀  Stayease backend running on port ${PORT}`);
    console.log(`    ENV:   ${process.env.NODE_ENV ?? "development"}`);
    console.log(`    Mongo: ${MONGODB_URI!.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`);
  });
});

export default app;