/**
 * Detail-page helpers: amenity grouping, metadata summaries, FAQs, review tags.
 * All outputs derive from API payloads — no hardcoded hotel facts.
 */

export type AmenityGroupKey =
  | "Popular"
  | "Wellness"
  | "Business"
  | "Family"
  | "Food & Dining"
  | "Room Features"
  | "Accessibility"
  | "Transport";

const GROUP_KEYWORDS: Record<AmenityGroupKey, string[]> = {
  Popular: [
    "wifi", "parking", "pool", "breakfast", "air conditioning", "restaurant",
    "bar", "front desk", "room service", "pet",
  ],
  Wellness: [
    "spa", "sauna", "gym", "fitness", "yoga", "massage", "hot tub", "wellness", "steam",
  ],
  Business: [
    "business", "meeting", "conference", "fax", "work", "desk", "cowork",
  ],
  Family: [
    "family", "kids", "children", "crib", "playground", "babysit",
  ],
  "Food & Dining": [
    "restaurant", "dining", "bar", "breakfast", "cafe", "coffee", "kitchen", "meal", "buffet",
  ],
  "Room Features": [
    "tv", "minibar", "safe", "balcony", "view", "bathroom", "shower", "bed", "linen", "iron",
  ],
  Accessibility: [
    "wheelchair", "accessible", "elevator", "ramp", "hearing",
  ],
  Transport: [
    "shuttle", "airport", "transfer", "metro", "train", "bus", "car rental", "parking", "valet",
  ],
};

export function groupAmenitiesDynamic(amenities: string[]): Record<AmenityGroupKey, string[]> {
  const result = {} as Record<AmenityGroupKey, string[]>;
  const keys = Object.keys(GROUP_KEYWORDS) as AmenityGroupKey[];
  for (const k of keys) result[k] = [];

  const assigned = new Set<string>();
  for (const a of amenities) {
    const lower = a.toLowerCase();
    let placed = false;
    for (const group of keys) {
      if (GROUP_KEYWORDS[group].some((kw) => lower.includes(kw))) {
        result[group].push(a);
        assigned.add(a);
        placed = true;
        break;
      }
    }
    if (!placed) result.Popular.push(a);
  }

  for (const group of keys) {
    result[group] = [...new Set(result[group])];
  }
  return result;
}

export function mergeFacilityGroups(
  flat: string[],
  facilities?:
    | string[]
    | {
        general?: string[];
        services?: string[];
        wellness?: string[];
        business?: string[];
        dining?: string[];
        accessibility?: string[];
      }
    | null
): string[] {
  if (Array.isArray(facilities)) {
    return [...new Set([...flat, ...facilities].map((a) => String(a).trim()).filter(Boolean))];
  }
  const fromGroups = facilities
    ? [
        ...(facilities.general ?? []),
        ...(facilities.services ?? []),
        ...(facilities.wellness ?? []),
        ...(facilities.business ?? []),
        ...(facilities.dining ?? []),
        ...(facilities.accessibility ?? []),
      ]
    : [];
  return [...new Set([...flat, ...fromGroups].map((a) => a.trim()).filter(Boolean))];
}

export interface AISummaryData {
  loves: { label: string; score: number; note: string }[];
  considerations: { text: string }[];
  bestFor: string[];
}

export function buildAISummaryFromHotel(hotel: any, revSum: any, amenities: string[]): AISummaryData {
  const cats = revSum?.categories ?? {};
  const amenLower = amenities.map((a) => a.toLowerCase()).join(" ");

  const loves = [
    {
      label: "Staff",
      score: Number(cats.staff ?? cats.service ?? 0),
      note: scoreNote(cats.staff ?? cats.service, "service"),
    },
    {
      label: "Location",
      score: Number(cats.location ?? 0),
      note: scoreNote(cats.location, "location"),
    },
    {
      label: "Cleanliness",
      score: Number(cats.cleanliness ?? 0),
      note: scoreNote(cats.cleanliness, "cleanliness"),
    },
    {
      label: "Value",
      score: Number(cats.value ?? 0),
      note: scoreNote(cats.value, "value"),
    },
  ].filter((x) => x.score > 0 || x.note);

  const considerations: { text: string }[] = [];
  const city = String(hotel?.city ?? "").toLowerCase();
  if (/(delhi|mumbai|bangalore|london|new york|paris|tokyo)/i.test(city)) {
    considerations.push({ text: "Busy urban area — expect traffic during peak hours." });
  }
  if (Number(hotel?.reviewCount ?? 0) > 500) {
    considerations.push({ text: "Popular property — book early during peak season." });
  }
  if (Number(hotel?.pricePerNight ?? 0) > 0 && Number(hotel?.starRating ?? 0) >= 4) {
    considerations.push({ text: "Premium pricing may apply on weekends and holidays." });
  }
  if (amenLower.includes("metro") || amenLower.includes("train")) {
    considerations.push({ text: "Near public transport — check last train times." });
  }
  if (!considerations.length) {
    considerations.push({ text: "Verify check-in times and local taxes with the property." });
  }

  const bestFor: string[] = [];
  if (amenLower.match(/family|kids|children|playground/)) bestFor.push("Families");
  if (amenLower.match(/spa|romantic|couple|honeymoon/)) bestFor.push("Couples");
  if (amenLower.match(/business|meeting|conference/)) bestFor.push("Business");
  if (Number(hotel?.pricePerNight ?? 0) > 0 && Number(hotel?.pricePerNight) < 5000) bestFor.push("Solo");
  if (!bestFor.length) {
    if (Number(hotel?.starRating ?? 0) >= 4) bestFor.push("Couples", "Business");
    else bestFor.push("Families", "Solo");
  }

  return { loves, considerations, bestFor: [...new Set(bestFor)] };
}

function scoreNote(score: number, aspect: string): string {
  if (!score || score <= 0) {
    return aspect === "service"
      ? "Service quality varies — see guest reviews."
      : `See guest feedback on ${aspect}.`;
  }
  if (score >= 8.5) return "Consistently praised by guests.";
  if (score >= 7) return "Generally well rated.";
  return "Mixed feedback — read recent reviews.";
}

export interface FAQItem {
  question: string;
  answer: string;
}

export function buildDynamicFAQs(_hotel: any, policies: any, amenities: string[]): FAQItem[] {
  const amen = amenities.map((a) => a.toLowerCase()).join(" ");
  const p = policies ?? {};
  const faqs: FAQItem[] = [];

  const checkIn = p.checkIn ?? p.checkInTime;
  const checkOut = p.checkOut ?? p.checkOutTime;
  if (checkIn) faqs.push({ question: "What time is check-in?", answer: String(checkIn) });
  if (checkOut) faqs.push({ question: "What time is check-out?", answer: String(checkOut) });

  if (amen.match(/breakfast|meal/)) {
    faqs.push({
      question: "Is breakfast included?",
      answer: amen.match(/breakfast included|breakfast available/)
        ? "Breakfast options are listed in room rates and amenities."
        : "Breakfast may be available — confirm when booking your room.",
    });
  }
  if (amen.match(/parking|valet/)) {
    faqs.push({
      question: "Is parking available?",
      answer: "Parking is listed in the property amenities. Fees may apply on site.",
    });
  }
  if (amen.match(/pool|swimming/)) {
    faqs.push({
      question: "Is there a swimming pool?",
      answer: "Yes — pool access is included in the amenities for this property.",
    });
  }
  if (p.pets || amen.match(/pet/)) {
    faqs.push({
      question: "Are pets allowed?",
      answer: String(p.pets || "Contact the property for pet policy details."),
    });
  }
  if (amen.match(/airport|shuttle|transfer/)) {
    faqs.push({
      question: "Is airport transfer available?",
      answer: "Airport shuttle or transfer may be available — ask the front desk when booking.",
    });
  }
  if (p.cancellation || p.cancellationPolicy) {
    faqs.push({
      question: "What is the cancellation policy?",
      answer: String(p.cancellation ?? p.cancellationPolicy),
    });
  }

  return faqs.slice(0, 8);
}

const MENTION_PATTERNS: { tag: string; re: RegExp }[] = [
  { tag: "clean rooms", re: /\b(clean|spotless|tidy)\b/i },
  { tag: "great breakfast", re: /\b(breakfast|morning meal)\b/i },
  { tag: "helpful staff", re: /\b(staff|service|friendly|helpful)\b/i },
  { tag: "great location", re: /\b(location|central|walkable|near)\b/i },
  { tag: "comfortable beds", re: /\b(bed|sleep|comfortable|mattress)\b/i },
  { tag: "good value", re: /\b(value|worth|price|affordable)\b/i },
  { tag: "spacious rooms", re: /\b(spacious|large room|big room)\b/i },
  { tag: "nice view", re: /\b(view|scenic|balcony)\b/i },
];

export function extractPopularMentions(reviews: { text?: string }[]): string[] {
  const counts = new Map<string, number>();
  for (const r of reviews) {
    const text = String(r.text ?? "");
    if (text.length < 20) continue;
    for (const { tag, re } of MENTION_PATTERNS) {
      if (re.test(text)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);
}

function pickRoomImage(raw: any, _index: number, _hotelImages: string[]): string {
  const photoLists = [
    raw.photos,
    raw.images,
    raw.gallery,
    raw.room_photos,
  ];
  for (const list of photoLists) {
    if (!Array.isArray(list)) continue;
    for (const v of list) {
      const url = typeof v === "string" ? v : (v?.url ?? v?.url_max ?? v?.url_1440 ?? "");
      if (typeof url === "string" && url.startsWith("http")) {
        return url.startsWith("http://") ? url.replace("http://", "https://") : url;
      }
    }
  }
  const direct = [
    raw.imageUrl,
    raw.image,
    raw.thumbnail,
  ];
  for (const v of direct) {
    const url = typeof v === "string" ? v : (v?.url ?? v?.url_max ?? "");
    if (typeof url === "string" && url.startsWith("http")) {
      return url.startsWith("http://") ? url.replace("http://", "https://") : url;
    }
  }
  return "";
}

export function normalizeRoom(raw: any, index: number, hotelImages: string[]): DetailRoom {
  const amenities: string[] = Array.isArray(raw.amenities) ? raw.amenities : [];
  const amenLower = amenities.join(" ").toLowerCase();
  const typeStr = String(raw.type ?? raw.name ?? "Room");

  let viewType = "";
  if (/sea|ocean|beach/i.test(typeStr + amenLower)) viewType = "Sea view";
  else if (/city/i.test(typeStr + amenLower)) viewType = "City view";
  else if (/garden|park/i.test(typeStr + amenLower)) viewType = "Garden view";
  else if (/mountain/i.test(typeStr + amenLower)) viewType = "Mountain view";

  const meals: string[] = Array.isArray(raw.meals) ? raw.meals : [];
  const hasBreakfast = meals.some((m) => /breakfast/i.test(m)) || amenLower.includes("breakfast");

  const roomImage = pickRoomImage(raw, index, hotelImages);

  return {
    id: String(raw.id ?? raw.room_id ?? `${typeStr}-${index}`),
    type: typeStr,
    imageUrl: roomImage,
    size: raw.size && raw.size !== "—" ? String(raw.size) : "",
    beds: String(raw.beds ?? "—"),
    maxGuests: Number(raw.maxGuests ?? 2),
    viewType,
    freeBreakfast: hasBreakfast,
    cancellationPolicy: String(raw.cancellationPolicy ?? "See property policy"),
    amenities,
    price: Number(raw.price ?? raw.pricePerNight ?? 0),
    originalPrice: Number(raw.originalPrice ?? raw.price ?? 0),
    discountPercent: Number(raw.discountPercent ?? 0),
    available: raw.available !== false,
    refundable: /free cancel|refund/i.test(String(raw.cancellationPolicy ?? "")),
    hasWifi: amenLower.includes("wifi") || amenities.some((a) => /wifi/i.test(a)),
    hasParking: amenLower.includes("parking") || amenities.some((a) => /parking/i.test(a)),
  };
}

export interface DetailRoom {
  id: string;
  type: string;
  imageUrl: string;
  size: string;
  beds: string;
  maxGuests: number;
  viewType: string;
  freeBreakfast: boolean;
  cancellationPolicy: string;
  amenities: string[];
  price: number;
  originalPrice: number;
  discountPercent: number;
  available: boolean;
  refundable: boolean;
  hasWifi: boolean;
  hasParking: boolean;
}

export function estimateTravelTime(distance?: string): string {
  if (!distance) return "";
  const km = parseFloat(distance.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(km) || km <= 0) return "";
  const mins = Math.max(3, Math.round(km * 12));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
}

export function categorizeTransport(place: { name?: string; type?: string }) {
  const n = `${place.name ?? ""} ${place.type ?? ""}`.toLowerCase();
  if (/airport/.test(n)) return "airport";
  if (/metro|subway|tube|train|station|bus/.test(n)) return "metro";
  return "transport";
}

// ─── Hero photos & metadata ───────────────────────────────────────────────────

function normalizePhotoUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const url = raw.trim().startsWith("http://")
    ? raw.trim().replace("http://", "https://")
    : raw.trim();
  return url.startsWith("https://") ? url : null;
}

function dedupePhotoUrls(sources: (string[] | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of sources) {
    for (const raw of list ?? []) {
      const url = normalizePhotoUrl(raw);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

/** Owner → Expedia → Google → other providers; all available URLs, deduped. */
export function mergeAllPhotos(hotel: any, extra: any | null): string[] {
  const id = String(hotel?._id ?? hotel?.id ?? "");
  const isDb =
    hotel?.source === "db" ||
    (!id.startsWith("booking_") && !!hotel?.userId);

  const owner = isDb && Array.isArray(hotel?.imageUrls) ? hotel.imageUrls : [];
  const expedia = Array.isArray(extra?.expediaImages) ? extra.expediaImages : [];
  const google = Array.isArray(extra?.googleImages)
    ? extra.googleImages
    : Array.isArray(extra?.googlePhotos)
      ? extra.googlePhotos.map((p: any) => (typeof p === "string" ? p : p?.url)).filter(Boolean)
      : [];
  const provider =
    !isDb && Array.isArray(hotel?.imageUrls) ? hotel.imageUrls : [];
  const enriched = Array.isArray(extra?.images) ? extra.images : [];

  return dedupePhotoUrls([owner, expedia, google, provider, enriched]);
}

const HERO_AMENITY_RULES: { label: string; re: RegExp }[] = [
  { label: "Free WiFi", re: /\b(wifi|wi-fi|internet)\b/i },
  { label: "Pool", re: /\b(pool|swimming)\b/i },
  { label: "Spa", re: /\bspa\b/i },
  { label: "Breakfast", re: /\bbreakfast\b/i },
  { label: "Parking", re: /\b(parking|valet)\b/i },
  { label: "Airport Shuttle", re: /\b(airport shuttle|shuttle|airport transfer)\b/i },
];

/** Up to six hero amenity chips in a fixed priority order. */
export function pickHeroAmenities(amenities: string[]): string[] {
  const lower = amenities.map((a) => a.toLowerCase());
  const picked: string[] = [];
  for (const { label, re } of HERO_AMENITY_RULES) {
    if (picked.length >= 6) break;
    const idx = lower.findIndex((a) => re.test(a));
    if (idx >= 0) {
      picked.push(label);
      lower[idx] = "";
    }
  }
  return picked;
}

export interface HeroHighlight {
  text: string;
}

export function buildHeroHighlights(
  hotel: any,
  revSum: any,
  amenities: string[]
): HeroHighlight[] {
  const out: HeroHighlight[] = [];
  const amenLower = amenities.map((a) => a.toLowerCase()).join(" ");
  const bestFor = buildAISummaryFromHotel(hotel, revSum, amenities).bestFor;

  if (bestFor.some((b) => /couple/i.test(b))) out.push({ text: "Popular With Couples" });
  if (bestFor.some((b) => /business/i.test(b))) out.push({ text: "Business Friendly" });
  if (bestFor.some((b) => /famil/i.test(b))) out.push({ text: "Family Friendly" });

  const locScore = Number(revSum?.categories?.location ?? 0);
  if (locScore > 0) out.push({ text: `Location Score ${locScore.toFixed(1)}` });

  if (amenLower.match(/romantic|honeymoon/) && !out.some((h) => /couple/i.test(h.text))) {
    out.push({ text: "Popular With Couples" });
  }

  return out.slice(0, 4);
}

export function displayRating10(overallRating: number): string {
  if (!overallRating || overallRating <= 0) return "";
  const scaled = overallRating <= 5 ? overallRating * 2 : overallRating;
  return scaled.toFixed(1);
}

// ─── About property ───────────────────────────────────────────────────────────

export interface AboutSection {
  title: string;
  paragraphs: string[];
}

export interface PropertyHighlightCard {
  text: string;
  icon: "location" | "couples" | "business" | "family" | "shuttle" | "spa" | "breakfast" | "metro" | "parking" | "wifi" | "default";
}

export function resolvePropertyDescription(hotel: any, extra: any | null): string {
  const booking = String(hotel?.description ?? "").trim();
  if (booking.length > 40) return booking;
  const expedia = String(extra?.propertyDescription ?? "").trim();
  if (expedia.length > 40) return expedia;
  if (booking) return booking;
  return expedia;
}

function splitDescriptionParagraphs(text: string): string[] {
  return text
    .split(/\n\n+|\r\n\r\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 30);
}

const SECTION_HEADINGS = [
  { re: /\b(overview|welcome|about|introduction)\b/i, title: "Overview" },
  { re: /\b(location|situated|neighbour|district|centre|center|walking distance)\b/i, title: "Location Advantage" },
  { re: /\b(experience|atmosphere|ambience|vibe|stay)\b/i, title: "Property Experience" },
  { re: /\b(room|suite|bed|accommodation)\b/i, title: "Room Experience" },
  { re: /\b(dining|restaurant|breakfast|bar|cuisine|meal)\b/i, title: "Dining Experience" },
  { re: /\b(couple|romantic|honeymoon|family|business|traveller|traveler)\b/i, title: "Who This Property Is Best For" },
  { re: /\b(nearby|attraction|landmark|museum|beach|park)\b/i, title: "Nearby Attractions" },
];

function guessSectionTitle(paragraph: string, index: number): string {
  for (const { re, title } of SECTION_HEADINGS) {
    if (re.test(paragraph)) return title;
  }
  if (index === 0) return "Overview";
  return "Property Experience";
}

export function buildAboutSections(
  description: string,
  hotel: any,
  amenities: string[],
  revSum: any,
  nearby: any
): AboutSection[] {
  const sections: AboutSection[] = [];
  const paragraphs = splitDescriptionParagraphs(description);

  if (paragraphs.length > 0) {
    const used = new Set<string>();
    for (let i = 0; i < paragraphs.length; i++) {
      const title = guessSectionTitle(paragraphs[i], i);
      const key = `${title}-${paragraphs[i].slice(0, 40)}`;
      if (used.has(key)) continue;
      used.add(key);
      const existing = sections.find((s) => s.title === title);
      if (existing) existing.paragraphs.push(paragraphs[i]);
      else sections.push({ title, paragraphs: [paragraphs[i]] });
    }
  }

  const city = String(hotel?.city ?? "").trim();
  const address = String(hotel?.address ?? "").trim();
  const locScore = Number(revSum?.categories?.location ?? 0);

  if (!sections.some((s) => s.title === "Location Advantage") && (city || address)) {
    const bits = [
      address ? `Located at ${address}.` : "",
      city ? `In ${city}${hotel?.country ? `, ${hotel.country}` : ""}.` : "",
      locScore > 0 ? `Guests rate the location ${locScore.toFixed(1)}/10.` : "",
    ].filter(Boolean);
    if (bits.length) sections.push({ title: "Location Advantage", paragraphs: [bits.join(" ")] });
  }

  const bestFor = buildAISummaryFromHotel(hotel, revSum, amenities).bestFor;
  if (!sections.some((s) => s.title === "Who This Property Is Best For") && bestFor.length) {
    sections.push({
      title: "Who This Property Is Best For",
      paragraphs: [`Ideal for ${bestFor.join(", ").toLowerCase()} travellers.`],
    });
  }

  const nearbyNames: string[] = [];
  if (nearby && typeof nearby === "object") {
    for (const key of ["attractions", "restaurants", "transport"] as const) {
      const list = nearby[key];
      if (Array.isArray(list)) {
        for (const p of list) {
          const n = String(p?.name ?? "").trim();
          if (n) nearbyNames.push(n);
        }
      }
    }
  }
  if (!sections.some((s) => s.title === "Nearby Attractions") && nearbyNames.length) {
    sections.push({
      title: "Nearby Attractions",
      paragraphs: [`Close to ${nearbyNames.slice(0, 6).join(", ")}.`],
    });
  }

  const amenLower = amenities.map((a) => a.toLowerCase()).join(" ");
  if (!sections.some((s) => s.title === "Dining Experience") && /breakfast|restaurant|dining|bar/.test(amenLower)) {
    const dining = amenities.filter((a) => /breakfast|restaurant|dining|bar|meal/i.test(a));
    if (dining.length) {
      sections.push({
        title: "Dining Experience",
        paragraphs: [`On-site options include ${dining.slice(0, 5).join(", ")}.`],
      });
    }
  }

  return sections;
}

export function buildPropertyHighlightCards(
  hotel: any,
  amenities: string[],
  revSum: any,
  nearby: any
): PropertyHighlightCard[] {
  const cards: PropertyHighlightCard[] = [];
  const amen = amenities.map((a) => a.toLowerCase()).join(" ");
  const locScore = Number(revSum?.categories?.location ?? 0);
  const bestFor = buildAISummaryFromHotel(hotel, revSum, amenities).bestFor;

  if (locScore >= 8.5 || /city centre|downtown|central/i.test(String(hotel?.address ?? "") + amen)) {
    cards.push({ text: "Located in city centre", icon: "location" });
  } else if (locScore >= 7) {
    cards.push({ text: "Great location", icon: "location" });
  }

  if (bestFor.some((b) => /couple/i.test(b)) || /romantic|honeymoon/i.test(amen)) {
    cards.push({ text: "Popular with couples", icon: "couples" });
  }
  if (bestFor.some((b) => /business/i.test(b)) || /business|meeting|conference/i.test(amen)) {
    cards.push({ text: "Business traveller favourite", icon: "business" });
  }
  if (bestFor.some((b) => /famil/i.test(b)) || /family|kids|children/i.test(amen)) {
    cards.push({ text: "Family friendly", icon: "family" });
  }
  if (/airport shuttle|airport transfer/i.test(amen)) {
    cards.push({ text: "Airport shuttle", icon: "shuttle" });
  }
  if (/\bspa\b|wellness|sauna/i.test(amen)) {
    cards.push({ text: "Spa & wellness", icon: "spa" });
  }
  if (/breakfast/i.test(amen)) {
    cards.push({ text: "Breakfast available", icon: "breakfast" });
  }
  if (/metro|subway|train|station/i.test(amen)) {
    const transport = [
      ...(nearby?.transport ?? []),
      ...(nearby?.attractions ?? []),
    ];
    const metro = transport.find((p: any) =>
      /metro|subway|train|station/i.test(`${p?.name ?? ""} ${p?.type ?? ""}`)
    );
    cards.push({ text: metro?.name ? `Near ${metro.name}` : "Near metro", icon: "metro" });
  }
  if (/parking|valet/i.test(amen)) {
    cards.push({ text: "Parking available", icon: "parking" });
  }
  if (/wifi|internet/i.test(amen)) {
    cards.push({ text: "Free WiFi", icon: "wifi" });
  }

  const seen = new Set<string>();
  return cards.filter((c) => {
    const k = c.text.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
