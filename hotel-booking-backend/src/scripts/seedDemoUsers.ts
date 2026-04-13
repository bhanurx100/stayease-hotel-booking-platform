import mongoose, { Model, Document } from "mongoose";
import bcrypt   from "bcryptjs";
import dotenv   from "dotenv";

// Load .env from the project root
dotenv.config();

// ─── Minimal inline User schema (avoids import path issues when running standalone)
// If your User model import works, replace this with: import User from "../models/user";

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName:  String,
  email:     { type: String, unique: true, lowercase: true },
  password:  String,
  role:      { type: String, default: "user" },
  googleId:  String,
}, { timestamps: true });

interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  googleId?: string;
}

const User =
  (mongoose.models.User as Model<IUser>) ||
  mongoose.model<IUser>("User", userSchema);
// ─── Demo accounts ─────────────────────────────────────────────────────────────

interface DemoUser {
  firstName: string;
  lastName:  string;
  email:     string;
  password:  string;  // plain — hashed below before saving
  role:      string;
}

const DEMO_USERS: DemoUser[] = [
  {
    firstName: "Test",
    lastName:  "User",
    email:     "user@test.com",
    password:  "123456",
    role:      "user",
  },
  {
    firstName: "Hotel",
    lastName:  "Owner",
    email:     "owner@test.com",
    password:  "123456",
    role:      "owner",
  },
  {
    firstName: "Site",
    lastName:  "Admin",
    email:     "admin@test.com",
    password:  "123456",
    role:      "admin",
  },
];

// ─── Main ──────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  const mongoUri = process.env.MONGODB_CONNECTION_STRING;
  if (!mongoUri) {
    console.error(
      "❌  MONGODB_CONNECTION_STRING is not set in .env\n" +
      "    Example: MONGODB_CONNECTION_STRING=mongodb://localhost:27017/stayease"
    );
    process.exit(1);
  }

  console.log("🔌  Connecting to MongoDB…");
  await mongoose.connect(mongoUri);
  console.log("✅  Connected.\n");

  const SALT_ROUNDS = 12;

  for (const demo of DEMO_USERS) {
    const existing = await User.findOne({ email: demo.email });

    if (existing) {
      console.log(`⏭️   Skipped  ${demo.email}  (already exists)`);
      continue;
    }

    const hashed = await bcrypt.hash(demo.password, SALT_ROUNDS);

    await User.create({
      firstName: demo.firstName,
      lastName:  demo.lastName,
      email:     demo.email.toLowerCase(),
      password:  hashed,
      role:      demo.role,
    });

    console.log(`✅  Created  ${demo.email}  [role: ${demo.role}]`);
  }

  console.log("\n🎉  Seeding complete.");
  console.log("\n── Demo credentials ──────────────────────────────────────");
  console.log("  user@test.com   / 123456  (regular user)");
  console.log("  owner@test.com  / 123456  (hotel owner)");
  console.log("  admin@test.com  / 123456  (site admin)");
  console.log("──────────────────────────────────────────────────────────\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌  Seeder failed:", err?.message ?? err);
  mongoose.disconnect().finally(() => process.exit(1));
});