import mongoose, { Schema, model, models } from "mongoose";
import dotenv   from "dotenv";

dotenv.config();

// ─── Inline schema (avoids import path issues) ─────────────────────────────────

const bookingSchema = new mongoose.Schema({
  firstName:     String,
  lastName:      String,
  email:         String,
  adultCount:    Number,
  childCount:    Number,
  checkIn:       Date,
  checkOut:      Date,
  userId:        String,
  totalCost:     Number,
  paymentIntentId: String,
});

const hotelSchema = new mongoose.Schema({
  userId:        { type: String, required: true },
  name:          { type: String, required: true },
  city:          { type: String, required: true },
  country:       { type: String, required: true },
  description:   String,
  type:          [String],
  adultCount:    { type: Number, default: 2 },
  childCount:    { type: Number, default: 0 },
  facilities:    [String],
  pricePerNight: { type: Number, required: true },
  starRating:    { type: Number, default: 3 },
  imageUrls:     [String],
  lastUpdated:   { type: Date,   default: Date.now },
  bookings:      [bookingSchema],
  totalBookings: { type: Number, default: 0 },
  totalRevenue:  { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
  reviewCount:   { type: Number, default: 0 },
  isActive:      { type: Boolean, default: true  },
  isFeatured:    { type: Boolean, default: false },
});

interface IUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  googleId?: string;
}

const userSchema = new Schema<IUser>({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true, lowercase: true },
  password: String,
  role: { type: String, default: "user" },
  googleId: String,
}, { timestamps: true });

// ✅ FIX: proper model typing
interface IHotel {
  userId: string;
  name: string;
  city: string;
  country: string;
  description?: string;
  type: string[];
  facilities: string[];
  pricePerNight: number;
  starRating: number;
  imageUrls: string[];
  totalBookings: number;
  averageRating: number;
  reviewCount: number;
  isActive: boolean;
  isFeatured: boolean;
}

const Hotel =
  (models.Hotel as mongoose.Model<IHotel>) ||
  model<IHotel>("Hotel", hotelSchema);

const User =
  (models.User as mongoose.Model<IUser>) ||
  model<IUser>("User", userSchema);


// ─── Hotel data ────────────────────────────────────────────────────────────────

interface HotelSeed {
  name:          string;
  city:          string;
  country:       string;
  description:   string;
  type:          string[];
  facilities:    string[];
  pricePerNight: number;  // INR
  starRating:    number;  // 3–5
  imageUrls:     string[];
  isFeatured?:   boolean;
  totalBookings?: number;
  averageRating?: number;
  reviewCount?:   number;
}

const INDIAN_HOTELS: HotelSeed[] = [

  // ──────────────── BANGALORE (4 hotels) ─────────────────────────────────────

  {
    name:         "The Koramangala Nest",
    city:         "Bangalore",
    country:      "India",
    description:  "A cosy boutique guesthouse tucked in the heart of Koramangala, Bangalore's most vibrant neighbourhood. Walking distance to cafes, restaurants, and tech parks. Clean rooms with AC, free Wi-Fi, and a rooftop seating area. Perfect for solo travellers and business visitors on a budget.",
    type:         ["Boutique"],
    facilities:   ["Free WiFi", "Air Conditioning", "24-Hour Front Desk", "Rooftop Seating", "Room Service", "Daily Housekeeping"],
    pricePerNight: 1200,
    starRating:   3,
    imageUrls:    [
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80",
      "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80",
    ],
    totalBookings: 142,
    averageRating: 4.2,
    reviewCount:   89,
    isFeatured:   true,
  },
  {
    name:         "Indiranagar Budget Inn",
    city:         "Bangalore",
    country:      "India",
    description:  "Simple, clean, and affordable stay in Indiranagar — one of Bangalore's most sought-after areas. Rooms are compact but well-maintained with powerful Wi-Fi, ideal for remote workers. Just 10 minutes from MG Road metro station.",
    type:         ["Budget"],
    facilities:   ["Free WiFi", "Air Conditioning", "24-Hour Front Desk", "Laundry Service", "Daily Housekeeping"],
    pricePerNight: 750,
    starRating:   3,
    imageUrls:    [
      "https://images.unsplash.com/photo-1505693314120-0d443867891c?w=800&q=80",
      "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&q=80",
    ],
    totalBookings: 78,
    averageRating: 3.8,
    reviewCount:   45,
  },
  {
    name:         "Whitefield Comfort Stay",
    city:         "Bangalore",
    country:      "India",
    description:  "Located in the IT corridor of Whitefield, this comfortable mid-range hotel is ideal for corporate guests visiting Prestige Tech Park or ITPL. Spacious rooms, strong Wi-Fi, and complimentary breakfast make long stays easy and affordable.",
    type:         ["Business"],
    facilities:   ["Free WiFi", "Air Conditioning", "Free Breakfast", "Business Center", "24-Hour Front Desk", "Free Parking", "Daily Housekeeping"],
    pricePerNight: 1450,
    starRating:   4,
    imageUrls:    [
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80",
      "https://images.unsplash.com/photo-1631049421450-348ccd7f8949?w=800&q=80",
    ],
    totalBookings: 203,
    averageRating: 4.4,
    reviewCount:   130,
    isFeatured:   true,
  },
  {
    name:         "Jayanagar Heritage House",
    city:         "Bangalore",
    country:      "India",
    description:  "A beautifully restored old Bangalore home in the quiet, tree-lined Jayanagar 4th Block. Original mosaic floors, high ceilings, and a garden courtyard create an authentic Karnataka atmosphere. Walking distance to local temples, markets, and South Indian restaurants.",
    type:         ["Boutique", "Heritage"],
    facilities:   ["Free WiFi", "Garden", "Daily Housekeeping", "Room Service", "Air Conditioning"],
    pricePerNight: 1100,
    starRating:   4,
    imageUrls:    [
      "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80",
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&q=80",
    ],
    totalBookings: 56,
    averageRating: 4.6,
    reviewCount:   38,
  },

  // ──────────────── HYDERABAD (4 hotels) ─────────────────────────────────────

  {
    name:         "Banjara Hills Executive Stay",
    city:         "Hyderabad",
    country:      "India",
    description:  "Modern and efficient hotel in the upscale Banjara Hills neighbourhood. Close to Jubilee Hills shopping, restaurants, and corporate offices. Rooms feature flat-screen TVs, fast Wi-Fi, and 24-hour room service. Excellent value for Hyderabad.",
    type:         ["Business"],
    facilities:   ["Free WiFi", "Air Conditioning", "24-Hour Front Desk", "Room Service", "Daily Housekeeping", "Free Parking"],
    pricePerNight: 1350,
    starRating:   4,
    imageUrls:    [
      "https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&q=80",
      "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80",
    ],
    totalBookings: 167,
    averageRating: 4.1,
    reviewCount:   102,
    isFeatured:   true,
  },
  {
    name:         "Old City Haveli Guest House",
    city:         "Hyderabad",
    country:      "India",
    description:  "Step into Hyderabad's history in this traditional haveli-style guesthouse near Charminar. Colourful Hyderabadi decor, authentic Nawabi hospitality, and the aroma of Haleem and biryani from the lane outside. A cultural immersion unlike any modern hotel.",
    type:         ["Heritage", "Boutique"],
    facilities:   ["Free WiFi", "Daily Housekeeping", "24-Hour Front Desk", "Rooftop Seating", "Room Service"],
    pricePerNight: 850,
    starRating:   3,
    imageUrls:    [
      "https://images.unsplash.com/photo-1617952739453-a937c01fd18d?w=800&q=80",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80",
    ],
    totalBookings: 91,
    averageRating: 4.3,
    reviewCount:   67,
  },
  {
    name:         "Gachibowli Tech Traveller Inn",
    city:         "Hyderabad",
    country:      "India",
    description:  "Purpose-built for tech professionals visiting HITEC City, Gachibowli, and Financial District. Studio-style rooms with work desks, ultrafast fibre Wi-Fi, and ergonomic chairs. Shuttle service available to major IT parks on request.",
    type:         ["Business", "Budget"],
    facilities:   ["Free WiFi", "Air Conditioning", "24-Hour Front Desk", "Laundry Service", "Daily Housekeeping"],
    pricePerNight: 1000,
    starRating:   3,
    imageUrls:    [
      "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&q=80",
      "https://images.unsplash.com/photo-1505693314120-0d443867891c?w=800&q=80",
    ],
    totalBookings: 119,
    averageRating: 4.0,
    reviewCount:   74,
  },
  {
    name:         "Secunderabad Comforts",
    city:         "Hyderabad",
    country:      "India",
    description:  "Well-located near Secunderabad railway station, this clean and dependable hotel is the go-to choice for budget travellers arriving by train. Simple rooms, hot water, and a friendly staff who can arrange local auto-rickshaw tours.",
    type:         ["Budget"],
    facilities:   ["Free WiFi", "Air Conditioning", "24-Hour Front Desk", "Daily Housekeeping"],
    pricePerNight: 650,
    starRating:   3,
    imageUrls:    [
      "https://images.unsplash.com/photo-1586611292717-f828b167408c?w=800&q=80",
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&q=80",
    ],
    totalBookings: 44,
    averageRating: 3.7,
    reviewCount:   29,
  },

  // ──────────────── GOA (4 hotels) ────────────────────────────────────────────

  {
    name:         "Anjuna Beach House",
    city:         "Goa",
    country:      "India",
    description:  "A laid-back Portuguese-style beach house just 200 metres from Anjuna Beach. Whitewashed walls, hammocks in the garden, and the sound of waves at night. Ideal for backpackers and digital nomads looking for an authentic Goan experience under budget.",
    type:         ["Beach Resort", "Budget"],
    facilities:   ["Free WiFi", "Garden", "Outdoor Shower", "Daily Housekeeping", "Bicycle Rental"],
    pricePerNight: 900,
    starRating:   3,
    imageUrls:    [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
      "https://images.unsplash.com/photo-1540541338537-1220059ec600?w=800&q=80",
    ],
    totalBookings: 215,
    averageRating: 4.5,
    reviewCount:   148,
    isFeatured:   true,
  },
  {
    name:         "Palolem Palms Retreat",
    city:         "Goa",
    country:      "India",
    description:  "Nestled between swaying palms just off Palolem Beach, this eco-friendly retreat offers bamboo huts and AC cottages. Enjoy kayaking, yoga sessions at sunrise, and fresh seafood from the beach shacks next door. A true Goan hideaway.",
    type:         ["Beach Resort"],
    facilities:   ["Free WiFi", "Beach Access", "Yoga Classes", "Outdoor Seating", "Daily Housekeeping", "Bicycle Rental"],
    pricePerNight: 1300,
    starRating:   4,
    imageUrls:    [
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80",
      "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80",
    ],
    totalBookings: 178,
    averageRating: 4.7,
    reviewCount:   122,
    isFeatured:   true,
  },
  {
    name:         "Panaji Heritage Inn",
    city:         "Goa",
    country:      "India",
    description:  "Located in Fontainhas — Goa's Latin Quarter — this inn occupies a 200-year-old Portuguese mansion. Terracotta tiles, antique furniture, and vibrantly painted walls. Excellent base for exploring Old Goa churches, the Mandovi river, and local Goan cuisine.",
    type:         ["Heritage", "Boutique"],
    facilities:   ["Free WiFi", "Daily Housekeeping", "Courtyard Garden", "24-Hour Front Desk", "Air Conditioning"],
    pricePerNight: 1200,
    starRating:   4,
    imageUrls:    [
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80",
      "https://images.unsplash.com/photo-1617952739453-a937c01fd18d?w=800&q=80",
    ],
    totalBookings: 93,
    averageRating: 4.6,
    reviewCount:   71,
  },
  {
    name:         "Calangute Budget Rooms",
    city:         "Goa",
    country:      "India",
    description:  "No-frills, affordable rooms a 5-minute walk from Calangute Beach — one of North Goa's most popular stretches. Clean bathrooms, AC rooms, and a helpful owner who knows all the best shacks and beach clubs. Great value in peak season.",
    type:         ["Budget"],
    facilities:   ["Free WiFi", "Air Conditioning", "24-Hour Front Desk", "Daily Housekeeping"],
    pricePerNight: 700,
    starRating:   3,
    imageUrls:    [
      "https://images.unsplash.com/photo-1540541338537-1220059ec600?w=800&q=80",
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
    ],
    totalBookings: 61,
    averageRating: 3.9,
    reviewCount:   40,
  },

  // ──────────────── DELHI (4 hotels) ──────────────────────────────────────────

  {
    name:         "Paharganj Travellers Lodge",
    city:         "Delhi",
    country:      "India",
    description:  "The legendary Paharganj Main Bazaar meets modern comfort at this friendly lodge. A 10-minute walk from New Delhi Railway Station and Ramakrishna Ashram Metro. Clean dorms and private rooms, luggage storage, travel desk, and 24-hour reception.",
    type:         ["Budget"],
    facilities:   ["Free WiFi", "24-Hour Front Desk", "Luggage Storage", "Travel Desk", "Daily Housekeeping"],
    pricePerNight: 600,
    starRating:   3,
    imageUrls:    [
      "https://images.unsplash.com/photo-1586611292717-f828b167408c?w=800&q=80",
      "https://images.unsplash.com/photo-1505693314120-0d443867891c?w=800&q=80",
    ],
    totalBookings: 88,
    averageRating: 3.8,
    reviewCount:   55,
  },
  {
    name:         "Connaught Place Business Hotel",
    city:         "Delhi",
    country:      "India",
    description:  "Prime location in the iconic Connaught Place business hub. Spacious rooms with city views, a rooftop restaurant serving North Indian cuisine, and a fully-equipped meeting room. Steps away from Rajiv Chowk metro — the nerve centre of Delhi.",
    type:         ["Business"],
    facilities:   ["Free WiFi", "Air Conditioning", "Restaurant", "24-Hour Front Desk", "Meeting Rooms", "Daily Housekeeping", "Rooftop Dining"],
    pricePerNight: 1400,
    starRating:   4,
    imageUrls:    [
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80",
      "https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800&q=80",
    ],
    totalBookings: 156,
    averageRating: 4.3,
    reviewCount:   98,
    isFeatured:   true,
  },
  {
    name:         "Hauz Khas Village Stay",
    city:         "Delhi",
    country:      "India",
    description:  "Boutique apartment-hotel in the artsy Hauz Khas Village — surrounded by indie cafes, galleries, and a medieval deer park. Studio apartments with kitchenettes, perfect for longer stays or travellers who prefer home-like independence. Weekly rates available.",
    type:         ["Boutique", "Self Catering"],
    facilities:   ["Free WiFi", "Air Conditioning", "Kitchenette", "Self-Check-In", "Daily Housekeeping", "Rooftop Seating"],
    pricePerNight: 1250,
    starRating:   4,
    imageUrls:    [
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&q=80",
      "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80",
    ],
    totalBookings: 72,
    averageRating: 4.5,
    reviewCount:   49,
  },
  {
    name:         "Lajpat Nagar Family Guest House",
    city:         "Delhi",
    country:      "India",
    description:  "Family-run guest house in South Delhi's bustling Lajpat Nagar market area. Homely atmosphere, home-cooked meals on request, and a warm, welcoming host family. Close to Lajpat Nagar metro station and Central Market shopping.",
    type:         ["Family"],
    facilities:   ["Free WiFi", "Air Conditioning", "Home-cooked Meals", "Daily Housekeeping", "24-Hour Front Desk"],
    pricePerNight: 850,
    starRating:   3,
    imageUrls:    [
      "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&q=80",
      "https://images.unsplash.com/photo-1631049421450-348ccd7f8949?w=800&q=80",
    ],
    totalBookings: 38,
    averageRating: 4.2,
    reviewCount:   26,
  },

  // ──────────────── CHENNAI (3 hotels) ────────────────────────────────────────

  {
    name:         "T. Nagar Comfort Inn",
    city:         "Chennai",
    country:      "India",
    description:  "Centrally located in T. Nagar — Chennai's shopping and commercial heart. Clean rooms, reliable AC, and a South Indian restaurant serving idli, dosa, and filter coffee from 6am. Perfect for business visits and shopping trips to Ranganathan Street.",
    type:         ["Business", "Budget"],
    facilities:   ["Free WiFi", "Air Conditioning", "Restaurant", "24-Hour Front Desk", "Daily Housekeeping"],
    pricePerNight: 950,
    starRating:   3,
    imageUrls:    [
      "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80",
      "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&q=80",
    ],
    totalBookings: 103,
    averageRating: 4.0,
    reviewCount:   66,
  },
  {
    name:         "Besant Nagar Beach Homestay",
    city:         "Chennai",
    country:      "India",
    description:  "Wake up to the sound of the ocean at this charming homestay in Besant Nagar, steps from Elliot's Beach. The host family serves authentic Chettinad breakfasts. Quiet neighbourhood ideal for families and couples who want a taste of real Chennai life.",
    type:         ["Family", "Boutique"],
    facilities:   ["Free WiFi", "Air Conditioning", "Home-cooked Breakfast", "Beach Access", "Daily Housekeeping"],
    pricePerNight: 1100,
    starRating:   4,
    imageUrls:    [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80",
    ],
    totalBookings: 54,
    averageRating: 4.7,
    reviewCount:   37,
  },
  {
    name:         "Egmore Railway Hotel",
    city:         "Chennai",
    country:      "India",
    description:  "Reliable and no-frills hotel adjacent to Egmore railway station — perfect for early departures or late arrivals. AC rooms, 24-hour reception, and a small dining area serving South Indian thali. The most practical choice for transit travellers in Chennai.",
    type:         ["Budget"],
    facilities:   ["Free WiFi", "Air Conditioning", "24-Hour Front Desk", "Dining Area", "Daily Housekeeping"],
    pricePerNight: 700,
    starRating:   3,
    imageUrls:    [
      "https://images.unsplash.com/photo-1505693314120-0d443867891c?w=800&q=80",
      "https://images.unsplash.com/photo-1586611292717-f828b167408c?w=800&q=80",
    ],
    totalBookings: 66,
    averageRating: 3.6,
    reviewCount:   43,
  },

  // ──────────────── COORG (3 hotels) ──────────────────────────────────────────

  {
    name:         "Madikeri Mist Cottage",
    city:         "Coorg",
    country:      "India",
    description:  "Perched on a misty hillside above Madikeri town, this cosy cottage has breathtaking views over coffee and spice plantations. Wake up to tea from the host's estate, take a guided plantation walk, and enjoy a bonfire under the stars. Pure Coorg magic.",
    type:         ["Boutique", "Cabin"],
    facilities:   ["Free WiFi", "Garden", "Plantation Walk", "Bonfire Area", "Home-cooked Meals", "Daily Housekeeping"],
    pricePerNight: 1400,
    starRating:   4,
    imageUrls:    [
      "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&q=80",
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80",
    ],
    totalBookings: 131,
    averageRating: 4.8,
    reviewCount:   92,
    isFeatured:   true,
  },
  {
    name:         "Coffee Estate Bungalow",
    city:         "Coorg",
    country:      "India",
    description:  "Stay inside a working 10-acre Arabica coffee estate, 12km from Kushalnagar. The bungalow has original planters-era furniture, a veranda overlooking the estate, and a kitchen where breakfast is cooked fresh with estate-grown produce. Estate tours included.",
    type:         ["Heritage"],
    facilities:   ["Free WiFi", "Garden", "Estate Tour", "Free Breakfast", "Daily Housekeeping", "Free Parking"],
    pricePerNight: 1500,
    starRating:   5,
    imageUrls:    [
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80",
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
    ],
    totalBookings: 87,
    averageRating: 4.9,
    reviewCount:   63,
    isFeatured:   true,
  },
  {
    name:         "Virajpet Riverside Room",
    city:         "Coorg",
    country:      "India",
    description:  "Affordable rooms on the banks of the Cauvery tributary near Virajpet. Fishing from the riverbank, birding walks through bamboo groves, and the freshest rice-and-curry meals served on banana leaves. The simplest and most authentic stay in Coorg.",
    type:         ["Budget"],
    facilities:   ["Free WiFi", "River Access", "Home-cooked Meals", "Daily Housekeeping", "Fishing Spot"],
    pricePerNight: 800,
    starRating:   3,
    imageUrls:    [
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80",
    ],
    totalBookings: 43,
    averageRating: 4.4,
    reviewCount:   31,
  },

  // ──────────────── OOTY (3 hotels) ────────────────────────────────────────────

  {
    name:         "Nilgiri Highlands Homestay",
    city:         "Ooty",
    country:      "India",
    description:  "A warm family homestay on the slopes of the Nilgiri Hills, 3km from Ooty town. Rooms with valley views, thick quilts, and a log fireplace in the sitting room. The host serves fresh garden vegetables and Nilgiri tea at breakfast. Perfect for couples.",
    type:         ["Boutique", "Family"],
    facilities:   ["Free WiFi", "Garden", "Fireplace", "Home-cooked Breakfast", "Daily Housekeeping"],
    pricePerNight: 1200,
    starRating:   4,
    imageUrls:    [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
    ],
    totalBookings: 97,
    averageRating: 4.7,
    reviewCount:   68,
    isFeatured:   true,
  },
  {
    name:         "Botanical Garden Budget Lodge",
    city:         "Ooty",
    country:      "India",
    description:  "Simple, tidy rooms near the famous Ooty Government Botanical Garden and Rose Garden. An easy 15-minute walk to Ooty Lake and the toy train station. Best suited for budget travellers and school trip groups. Hot water available mornings and evenings.",
    type:         ["Budget"],
    facilities:   ["Free WiFi", "Hot Water", "Daily Housekeeping", "24-Hour Front Desk"],
    pricePerNight: 650,
    starRating:   3,
    imageUrls:    [
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    ],
    totalBookings: 52,
    averageRating: 3.8,
    reviewCount:   36,
  },
  {
    name:         "Coonoor Tea Garden Retreat",
    city:         "Ooty",
    country:      "India",
    description:  "Just 20km from Ooty in quieter Coonoor, this retreat sits inside a working tea estate with panoramic views of the Nilgiris. Guests can walk the tea rows at dawn, visit the on-site factory, and sip freshly processed Nilgiri OP tea on the estate veranda.",
    type:         ["Heritage", "Boutique"],
    facilities:   ["Free WiFi", "Tea Estate Tour", "Home-cooked Meals", "Garden", "Daily Housekeeping", "Free Parking"],
    pricePerNight: 1350,
    starRating:   4,
    imageUrls:    [
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80",
    ],
    totalBookings: 74,
    averageRating: 4.8,
    reviewCount:   54,
    isFeatured:   true,
  },
];

// ─── Seeder main ───────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  const mongoUri = process.env.MONGODB_CONNECTION_STRING;
  if (!mongoUri) {
    console.error("❌  MONGODB_CONNECTION_STRING not set in .env");
    process.exit(1);
  }

  console.log("🔌  Connecting to MongoDB…");
  await mongoose.connect(mongoUri);
  console.log("✅  Connected.\n");

  // Find the owner account to attach hotels to
  let owner = await User.findOne({ email: "owner@test.com" });
  if (!owner) {
    console.log('⚠️   owner@test.com not found — run seedDemoUsers.ts first. Using placeholder userId.');
  }
  const ownerId = owner?._id?.toString() ?? "000000000000000000000001";

  let created = 0;
  let skipped = 0;

  for (const h of INDIAN_HOTELS) {
    // De-duplicate by name + city
    const existing = await Hotel.findOne({ name: h.name, city: h.city });
    if (existing) {
      console.log(`  ⏭️  Skip   "${h.name}" in ${h.city} (already exists)`);
      skipped++;
      continue;
    }

    await Hotel.create({
      userId:        ownerId,
      name:          h.name,
      city:          h.city,
      country:       h.country,
      description:   h.description,
      type:          h.type,
      adultCount:    2,
      childCount:    0,
      facilities:    h.facilities,
      pricePerNight: h.pricePerNight,
      starRating:    h.starRating,
      imageUrls:     h.imageUrls,
      lastUpdated:   new Date(Date.now() - Math.random() * 30 * 86_400_000), // random within last 30 days
      totalBookings: h.totalBookings ?? 0,
      averageRating: h.averageRating ?? 0,
      reviewCount:   h.reviewCount   ?? 0,
      isActive:      true,
      isFeatured:    h.isFeatured ?? false,
    });

    console.log(`  ✅  Created "${h.name}" — ${h.city} (₹${h.pricePerNight}/night, ⭐${h.starRating})`);
    created++;
  }

  console.log(`\n🎉  Done! Created ${created} hotels, skipped ${skipped}.\n`);
  console.log("── City breakdown ────────────────────────────────────────────");
  const cities = [...new Set(INDIAN_HOTELS.map((h) => h.city))];
  for (const city of cities) {
    const count = INDIAN_HOTELS.filter((h) => h.city === city).length;
    console.log(`  ${city.padEnd(12)} ${count} hotels`);
  }
  console.log("──────────────────────────────────────────────────────────────\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌  Seeder failed:", err?.message ?? err);
  mongoose.disconnect().finally(() => process.exit(1));
});