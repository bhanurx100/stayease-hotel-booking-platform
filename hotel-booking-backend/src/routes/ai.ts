/**
 * hotel-booking-backend/src/routes/ai.ts
 *
 * POST /api/ai/chat
 *
 * ── Changes in this version ───────────────────────────────────────────────────
 *
 * 1. LOCALE-AWARE PRICE THRESHOLDS
 *    When the user's message mentions an Indian city (Mumbai, Delhi, Bangalore,
 *    Hyderabad, Chennai, Kolkata, Pune, Goa, Jaipur, etc.) the chatbot now:
 *    - Treats "cheap" as ≤ ₹2000/night  (not £100 which is meaningless for India)
 *    - Treats "budget" as ≤ ₹3000/night
 *    - Treats "luxury" as ≥ ₹8000/night
 *    - Shows ₹ in all reply messages instead of £
 *    - Parses "under 2000", "below 5000" as INR when Indian city is detected
 *
 * 2. INDIAN-CITY QUICK PROMPTS
 *    buildReply() greeting message now shows ₹-based examples alongside £ ones.
 *
 * 3. CORRECT CURRENCY IN REPLIES
 *    Price filter messages now show the correct symbol:
 *    "Under ₹2000/night" for India, "Under £100/night" for others.
 *
 * 4. EVERYTHING ELSE UNCHANGED:
 *    - DB + external parallel search
 *    - Session ring-buffer
 *    - extractIntent patterns
 *    - buildMongoQuery / buildSort / buildSearchPageUrl
 *    - filterExternalHotels / sortCombined
 *    - Route handler structure
 */

import express, { Request, Response } from "express";
import Hotel from "../models/hotel";
import { fetchExternalHotels } from "../services/externalHotelService";

const router = express.Router();

// ─── In-memory session store ──────────────────────────────────────────────────

const MAX_HISTORY = 5;

interface StoredMessage {
  role:      "user" | "assistant";
  content:   string;
  timestamp: Date;
}

const conversationStore: Record<string, StoredMessage[]> = {};

function getHistory(sid: string): StoredMessage[] {
  if (!conversationStore[sid]) conversationStore[sid] = [];
  return conversationStore[sid];
}

function pushMessage(sid: string, msg: StoredMessage): void {
  const h = getHistory(sid);
  h.push(msg);
  if (h.length > MAX_HISTORY) conversationStore[sid] = h.slice(-MAX_HISTORY);
}

// ─── Indian cities / keywords detection ───────────────────────────────────────

/**
 * Set of lowercase keywords that indicate the user is searching for an
 * Indian destination. When detected, price thresholds switch to INR.
 */
const INDIA_KEYWORDS = new Set([
  // Major cities
  "mumbai", "delhi", "bangalore", "bengaluru", "hyderabad", "chennai",
  "kolkata", "pune", "ahmedabad", "jaipur", "surat", "lucknow",
  "kanpur", "nagpur", "indore", "thane", "bhopal", "visakhapatnam",
  "pimpri", "patna", "vadodara", "ghaziabad", "ludhiana", "agra",
  "nashik", "faridabad", "meerut", "rajkot", "varanasi", "srinagar",
  "aurangabad", "dhanbad", "amritsar", "navi mumbai", "allahabad",
  "ranchi", "howrah", "coimbatore", "jabalpur", "gwalior", "vijayawada",
  "jodhpur", "madurai", "raipur", "kota", "chandigarh", "guwahati",
  "solapur", "hubballi", "tiruchirappalli", "bareilly", "moradabad",
  "mysore", "mysuru", "tirupur", "goa", "panaji", "margao",
  "udaipur", "pondicherry", "shimla", "manali", "darjeeling",
  "ooty", "kochi", "cochin", "thiruvananthapuram", "trivandrum",
  "bhubaneswar", "cuttack", "dehradun", "haridwar", "rishikesh",
  "varanasi", "puri", "pushkar", "mcleod ganj", "leh", "ladakh",
  // Country reference
  "india", "indian",
]);

function isIndianSearch(message: string, destination?: string): boolean {
  const combined = `${message} ${destination ?? ""}`.toLowerCase();
  for (const kw of INDIA_KEYWORDS) {
    if (combined.includes(kw)) return true;
  }
  return false;
}

// ─── Intent types ─────────────────────────────────────────────────────────────

interface SearchIntent {
  destination?: string;
  maxPrice?:    number;
  starRating?:  number[];
  sortOption?:  string;
  hotelTypes?:  string[];
  adultCount?:  number;
  childCount?:  number;
  intent:       "search" | "greeting" | "unknown";
  // NEW: detected locale affects price thresholds & currency symbols in replies
  isIndian?:    boolean;
}

// ─── Intent extraction ────────────────────────────────────────────────────────

function extractIntent(message: string): SearchIntent {
  const lower  = message.toLowerCase().trim();
  const result: SearchIntent = { intent: "search" };

  // Greeting
  if (/^(hi|hello|hey|howdy|good\s*(morning|afternoon|evening)|namaste|sup|greetings)\b/.test(lower)) {
    result.intent = "greeting";
    return result;
  }

  // ── Destination ──────────────────────────────────────────────────────────────
  const cityPatterns = [
    /(?:best|cheap|top|luxury|good|find|show|search|sasta|budget)\s+hotels?\s+in\s+([a-zA-Z][a-zA-Z\s]{1,40}?)(?:\s+under|\s+below|\s+less|,|$)/i,
    /hotels?\s+in\s+([a-zA-Z][a-zA-Z\s]{1,40}?)(?:\s+under|\s+below|\s+less|,|$)/i,
    /\b(?:in|near|at|around)\s+([A-Z][a-zA-Z\s]{1,40}?)(?:\s+under|\s+below|\s+less|,|$)/,
    /(?:find|show|search|look|dhundho)\s+(?:me\s+)?(?:hotels?\s+)?(?:in|at|near)\s+([a-zA-Z][a-zA-Z\s]{1,40})/i,
    /\bin\s+([A-Za-z][a-zA-Z\s]{1,30})/i,
  ];
  for (const p of cityPatterns) {
    const m = message.match(p);
    if (m?.[1]) {
      const c = m[1].trim().replace(/\s+/g, " ");
      if (!/^(the|a|an|my|our|your|this|that|some|any|all|good|best|top|cheap|sasta)$/i.test(c)) {
        result.destination = c;
        break;
      }
    }
  }

  // ── Detect Indian context ─────────────────────────────────────────────────
  result.isIndian = isIndianSearch(message, result.destination);

  // ── Price — locale-aware ──────────────────────────────────────────────────
  // Detect explicit price: "under 2000", "below £100", "under ₹5000"
  const pm = message.match(
    /(?:under|below|less\s+than|max(?:imum)?|up\s*to|within|budget\s+of?)\s*[£$€₹]?\s*(\d[\d,]*)/i
  );
  if (pm) {
    result.maxPrice = parseInt(pm[1].replace(/,/g, ""), 10);
  }

  // Implicit "cheap" / "budget" → different thresholds for India vs rest
  if (!result.maxPrice) {
    if (/\b(cheap|sasta|budget|affordable|inexpensive|low[\s-]cost|economy)\b/.test(lower)) {
      // India: cheap = ₹2000/night; Others: cheap = £100/night
      result.maxPrice   = result.isIndian ? 2000 : 100;
      result.sortOption = "pricePerNightAsc";
    } else if (/\b(mid[\s-]range|moderate|decent)\b/.test(lower)) {
      result.maxPrice   = result.isIndian ? 5000 : 200;
      result.sortOption = "pricePerNightAsc";
    }
  }

  // ── Sort ──────────────────────────────────────────────────────────────────
  if (!result.sortOption) {
    if (/\b(best|top[- ]rated|highest[- ]rated|most\s+popular|recommend)\b/.test(lower))
      result.sortOption = "starRating";
    else if (/\b(cheapest|lowest\s+price|most\s+affordable|sabse\s+sasta)\b/.test(lower))
      result.sortOption = "pricePerNightAsc";
    else if (/\b(expensive|luxury|premium|high[\s-]end|5[\s-]star|five[\s-]star)\b/.test(lower))
      result.sortOption = "pricePerNightDesc";
  }

  // ── Stars ─────────────────────────────────────────────────────────────────
  const starWordMap: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
  };
  const sm = message.match(/(\d|one|two|three|four|five)[- ]?star/i);
  if (sm) {
    const v = starWordMap[sm[1].toLowerCase()];
    if (v) result.starRating = [v];
  }
  if (!result.starRating && /\b(luxury|luxurious|five[\s-]star)\b/.test(lower)) {
    result.starRating = [5];
    result.sortOption = result.sortOption ?? "pricePerNightDesc";
  }

  // ── Hotel type ────────────────────────────────────────────────────────────
  const typeMap: Record<string, string> = {
    "beach resort":  "Beach Resort",
    resort:          "Beach Resort",
    boutique:        "Boutique",
    motel:           "Motel",
    hostel:          "Budget",
    "all inclusive": "All Inclusive",
    family:          "Family",
    romantic:        "Romantic",
    business:        "Business",
    cabin:           "Cabin",
    "ski resort":    "Ski Resort",
    "pet friendly":  "Pet Friendly",
    "self catering": "Self Catering",
    heritage:        "Heritage",
    "hill station":  "Hill Station",
    "spa hotel":     "Spa",
  };
  const sortedKeys = Object.keys(typeMap).sort((a, b) => b.length - a.length);
  for (const k of sortedKeys) {
    if (lower.includes(k)) { result.hotelTypes = [typeMap[k]]; break; }
  }

  // ── Guests ────────────────────────────────────────────────────────────────
  const am = message.match(/(\d+)\s+adults?/i);
  const cm = message.match(/(\d+)\s+(?:children|child|kids?)/i);
  if (am) result.adultCount = parseInt(am[1], 10);
  if (cm) result.childCount = parseInt(cm[1], 10);

  return result;
}

// ─── Mongo query builder ──────────────────────────────────────────────────────

function buildMongoQuery(intent: SearchIntent): Record<string, any> {
  const q: Record<string, any> = {};
  if (intent.destination) {
    const safe = intent.destination.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    q.$or = [
      { city:    { $regex: safe, $options: "i" } },
      { country: { $regex: safe, $options: "i" } },
    ];
  }
  if (intent.maxPrice && intent.maxPrice > 0) q.pricePerNight = { $lte: intent.maxPrice };
  if (intent.starRating?.length)              q.starRating    = { $in: intent.starRating };
  if (intent.hotelTypes?.length)              q.type          = { $in: intent.hotelTypes };
  if (intent.adultCount)                      q.adultCount    = { $gte: intent.adultCount };
  if (intent.childCount)                      q.childCount    = { $gte: intent.childCount };
  return q;
}

function buildSort(sortOption?: string): Record<string, any> {
  switch (sortOption) {
    case "starRating":        return { starRating: -1 };
    case "pricePerNightAsc":  return { pricePerNight: 1 };
    case "pricePerNightDesc": return { pricePerNight: -1 };
    default:                  return { lastUpdated: -1 };
  }
}

// ─── Search page URL builder ──────────────────────────────────────────────────

function buildSearchPageUrl(intent: SearchIntent): string {
  const params: Record<string, string> = { page: "1", limit: "10" };
  if (intent.destination)        params.destination = intent.destination;
  if (intent.maxPrice)           params.maxPrice    = String(intent.maxPrice);
  if (intent.starRating?.length) params.stars       = String(intent.starRating[0]);
  if (intent.hotelTypes?.length) params.types       = intent.hotelTypes[0];
  if (intent.sortOption)         params.sortOption  = intent.sortOption;
  if (intent.adultCount)         params.adultCount  = String(intent.adultCount);
  if (intent.childCount)         params.childCount  = String(intent.childCount);
  return "/search?" + new URLSearchParams(params).toString();
}

// ─── Reply builder — locale-aware currency in messages ───────────────────────

function buildReply(
  intent:    SearchIntent,
  total:     number,
  dbCount:   number,
  extCount:  number,
  pageCount: number,
  page:      number,
  pages:     number,
  history:   StoredMessage[]
): string {
  // Currency symbol to use in reply messages
  const sym = intent.isIndian ? "₹" : "£";

  // ── Greeting ──────────────────────────────────────────────────────────────
  if (intent.intent === "greeting") {
    return (
      "Hello! 👋 I'm your hotel search assistant — I search our platform AND live worldwide inventory.\n\n" +
      "Try asking me:\n" +
      '• **"Hotels in Mumbai"** or **"Hotels in London"**\n' +
      '• **"Cheap hotels in Delhi under ₹2000"**\n' +
      '• **"Budget hotels in Goa under ₹3000"**\n' +
      '• **"5-star hotels in Dubai"**\n' +
      '• **"Luxury hotels in Paris under £300"**\n' +
      '• **"Family hotels in Jaipur"**'
    );
  }

  // ── No parseable intent ───────────────────────────────────────────────────
  if (!intent.destination && !intent.maxPrice && !intent.starRating && !intent.hotelTypes) {
    if (intent.isIndian) {
      return (
        "I didn't quite catch that. Try:\n" +
        '• **"Hotels in Mumbai"**\n' +
        '• **"Cheap hotels in Delhi under ₹2000"**\n' +
        '• **"5-star hotels in Goa"**\n' +
        '• **"Budget stays in Bangalore under ₹3000"**'
      );
    }
    return (
      "I didn't quite catch that. Try:\n" +
      '• **"Hotels in London"**\n' +
      '• **"Budget hotels under £80"**\n' +
      '• **"Best 5-star hotels in Dubai"**'
    );
  }

  // ── Zero results ──────────────────────────────────────────────────────────
  if (total === 0) {
    const dest  = intent.destination ? ` in **${intent.destination}**` : "";
    const price = intent.maxPrice ? ` under ${sym}${intent.maxPrice.toLocaleString()}` : "";
    return (
      `I searched${dest}${price} but found no matching hotels. Try:\n` +
      "• A different city spelling\n" +
      "• Removing the price or star filter\n" +
      "• A nearby city or region"
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────
  const isFollowUp = history.filter((m) => m.role === "user").length > 1;
  const parts: string[] = [];

  if (isFollowUp) {
    parts.push("Updated results for your request:");
  } else if (intent.destination) {
    parts.push(`Found **${total} hotel${total !== 1 ? "s" : ""}** in **${intent.destination}**.`);
  } else {
    parts.push(`Found **${total} hotel${total !== 1 ? "s" : ""}** matching your request.`);
  }

  if (dbCount > 0 && extCount > 0)
    parts.push(`(${dbCount} from our platform + ${extCount} worldwide)`);

  if (pageCount < total)
    parts.push(`Showing **${pageCount}** (page ${page} of ${pages}).`);

  // ── Price filter message — correct currency symbol ─────────────────────────
  if (intent.maxPrice) {
    parts.push(`Under **${sym}${intent.maxPrice.toLocaleString()}**/night.`);
  }

  if (intent.starRating?.length)
    parts.push(`**${intent.starRating[0]}-star** properties.`);

  switch (intent.sortOption) {
    case "starRating":        parts.push("Sorted by highest rating."); break;
    case "pricePerNightAsc":  parts.push("Cheapest first."); break;
    case "pricePerNightDesc": parts.push("Most luxurious first."); break;
  }

  if (total > pageCount) {
    parts.push('Hit **"View all results"** below to see everything. 🏨');
  } else {
    parts.push("Tap any card to view details! 🏨");
  }

  return parts.join(" ");
}

// ─── External filter helper ───────────────────────────────────────────────────

function filterExternalHotels(hotels: any[], intent: SearchIntent): any[] {
  return hotels.filter((h) => {
    if (intent.maxPrice && h.pricePerNight > 0 && h.pricePerNight > intent.maxPrice)
      return false;
    if (intent.starRating?.length && !intent.starRating.includes(h.starRating))
      return false;
    return true;
  });
}

function sortCombined(hotels: any[], sortOption?: string): any[] {
  const copy = [...hotels];
  if (sortOption === "pricePerNightAsc")
    copy.sort((a, b) => (a.pricePerNight ?? 0) - (b.pricePerNight ?? 0));
  else if (sortOption === "pricePerNightDesc")
    copy.sort((a, b) => (b.pricePerNight ?? 0) - (a.pricePerNight ?? 0));
  else if (sortOption === "starRating")
    copy.sort((a, b) => (b.starRating ?? 0) - (a.starRating ?? 0));
  return copy;
}

// ─── Route handler ────────────────────────────────────────────────────────────

router.post("/chat", async (req: Request, res: Response) => {
  try {
    const { message, sessionId: clientSid, page: reqPage, limit: reqLimit } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ message: "Message is required." });
    }

    const sessionId: string =
      typeof clientSid === "string" && clientSid.length > 0
        ? clientSid
        : `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const trimmed = message.trim();
    pushMessage(sessionId, { role: "user", content: trimmed, timestamp: new Date() });
    const history = getHistory(sessionId);

    const intent = extractIntent(trimmed);
    const limit  = Math.min(Math.max(parseInt(String(reqLimit ?? 5), 10), 1), 20);
    const page   = Math.max(parseInt(String(reqPage  ?? 1), 10), 1);
    const skip   = (page - 1) * limit;

    let dbHotels:  any[] = [];
    let extHotels: any[] = [];

    if (intent.intent === "search") {
      const mongoQuery  = buildMongoQuery(intent);
      const sortOptions = buildSort(intent.sortOption);

      // DB + external in parallel
      const [dbResults, externalResults] = await Promise.all([
        Hotel.find(mongoQuery).sort(sortOptions).lean(),
        intent.destination
          ? fetchExternalHotels(intent.destination, 20).catch((err) => {
              console.warn("[ai/chat] External search failed:", err?.message);
              return [];
            })
          : Promise.resolve([]),
      ]);

      dbHotels  = dbResults.map((h) => ({ ...h, source: "db" as const }));
      extHotels = filterExternalHotels(externalResults, intent);

      const combined  = sortCombined([...dbHotels, ...extHotels], intent.sortOption);
      const total     = combined.length;
      const pages     = Math.ceil(total / limit);
      const pageSlice = combined.slice(skip, skip + limit);

      const reply = buildReply(
        intent, total, dbHotels.length, extHotels.length,
        pageSlice.length, page, pages, history
      );
      pushMessage(sessionId, { role: "assistant", content: reply, timestamp: new Date() });

      return res.status(200).json({
        reply,
        hotels:        pageSlice,
        total,
        dbCount:       dbHotels.length,
        externalCount: extHotels.length,
        page,
        pages,
        sessionId,
        searchPageUrl: buildSearchPageUrl(intent),
        intent,
      });
    }

    // Non-search intent
    const reply = buildReply(intent, 0, 0, 0, 0, page, 0, history);
    pushMessage(sessionId, { role: "assistant", content: reply, timestamp: new Date() });

    return res.status(200).json({
      reply,
      hotels:        [],
      total:         0,
      dbCount:       0,
      externalCount: 0,
      page:          1,
      pages:         0,
      sessionId,
      searchPageUrl: buildSearchPageUrl(intent),
      intent,
    });

  } catch (error) {
    console.error("[ai/chat] Error:", error);
    return res.status(500).json({ message: "Something went wrong with the AI assistant." });
  }
});

router.get("/history/:sessionId", (req: Request, res: Response) => {
  const { sessionId } = req.params;
  res.json({ sessionId, history: conversationStore[sessionId] ?? [] });
});

export default router;