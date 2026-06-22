/**
 * Reusable property-type labels for hotels, resorts, homestays, villas, etc.
 */

export type PropertyKind =
  | "hotel"
  | "resort"
  | "homestay"
  | "villa"
  | "apartment"
  | "pg"
  | "guesthouse"
  | "hostel"
  | "unknown";

const TYPE_ALIASES: Record<string, PropertyKind> = {
  hotel: "hotel",
  hotels: "hotel",
  resort: "resort",
  resorts: "resort",
  homestay: "homestay",
  "home stay": "homestay",
  homestays: "homestay",
  villa: "villa",
  villas: "villa",
  apartment: "apartment",
  apartments: "apartment",
  flat: "apartment",
  pg: "pg",
  "paying guest": "pg",
  guesthouse: "guesthouse",
  "guest house": "guesthouse",
  hostel: "hostel",
  bnb: "homestay",
  "bed and breakfast": "homestay",
};

export function resolvePropertyKind(types: string | string[] | undefined): PropertyKind {
  const list = Array.isArray(types) ? types : types ? [types] : [];
  for (const raw of list) {
    const key = String(raw).toLowerCase().trim();
    if (TYPE_ALIASES[key]) return TYPE_ALIASES[key];
    for (const [alias, kind] of Object.entries(TYPE_ALIASES)) {
      if (key.includes(alias)) return kind;
    }
  }
  return "hotel";
}

const LABELS: Record<PropertyKind, { singular: string; plural: string; stay: string }> = {
  hotel:      { singular: "Hotel",      plural: "Hotels",      stay: "Stay" },
  resort:     { singular: "Resort",     plural: "Resorts",     stay: "Stay" },
  homestay:   { singular: "Homestay",   plural: "Homestays",   stay: "Stay" },
  villa:      { singular: "Villa",      plural: "Villas",      stay: "Stay" },
  apartment:  { singular: "Apartment",  plural: "Apartments",  stay: "Stay" },
  pg:         { singular: "PG",         plural: "PGs",         stay: "Stay" },
  guesthouse: { singular: "Guesthouse", plural: "Guesthouses", stay: "Stay" },
  hostel:     { singular: "Hostel",     plural: "Hostels",     stay: "Stay" },
  unknown:    { singular: "Property",   plural: "Properties",  stay: "Stay" },
};

export function propertyLabel(kind: PropertyKind, form: "singular" | "plural" | "stay" = "singular"): string {
  return LABELS[kind][form];
}

export function aboutSectionTitle(kind: PropertyKind): string {
  return `About this ${LABELS[kind].singular.toLowerCase()}`;
}

export function roomsSectionTitle(kind: PropertyKind): string {
  if (kind === "apartment" || kind === "villa") return "Available units";
  if (kind === "pg") return "Available rooms";
  return "Available rooms";
}
