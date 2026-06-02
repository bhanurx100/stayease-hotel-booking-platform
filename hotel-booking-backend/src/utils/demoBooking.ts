/**
 * Demo booking helpers — development / DEMO_BOOKING_MODE only.
 * Skips real Stripe charges while still persisting bookings in MongoDB.
 */

export function isDemoBookingEnabled(): boolean {
  if (process.env.DEMO_BOOKING_MODE === "true") return true;
  if (process.env.DEMO_BOOKING_MODE === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function isDemoPaymentIntentId(paymentIntentId: string): boolean {
  return typeof paymentIntentId === "string" && paymentIntentId.startsWith("demo_pi_");
}

export function createDemoPaymentIntentId(hotelId: string, userId: string): string {
  return `demo_pi_${hotelId}_${userId}_${Date.now()}`;
}
