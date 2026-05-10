<div align="center">

# 🏨 StayEase — Hotel Booking Platform

### *A production-grade, full-stack hotel booking ecosystem with live worldwide inventory, AI-powered search, multi-source enrichment, and role-based analytics dashboards.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18.2-blue?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-20-green?logo=node.js)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.0-green?logo=mongodb)](https://www.mongodb.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.3-38B2AC?logo=tailwind-css)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://www.docker.com)
[![Playwright](https://img.shields.io/badge/E2E-Playwright-orange?logo=playwright)](https://playwright.dev)

**[🌐 Live Demo](https://stayease-hotel-booking-platform.vercel.app)** · **[📖 API Docs](https://stayease-hotel-booking-platform-1-49bo.onrender.com/api-docs)** · **[📊 API Status](https://stayease-hotel-booking-platform.vercel.app/api-status)**

</div>

---

## 📸 Screenshots

<div align="center">

| Home — Hero & Search | Search Results |
|---|---|
| ![Home](assets/1.png) | ![Search](assets/2.png) |

| Hotel Detail — Gallery & Rooms | Booking Flow |
|---|---|
| ![Detail](assets/3.png) | ![Booking](assets/4.png) |

| AI Hotel Chatbot | Analytics Dashboard |
|---|---|
| ![AI Chatbot](assets/5.png) | ![Analytics](assets/6.png) |

| Owner Dashboard | Admin & Business Insights |
|---|---|
| ![Owner Dashboard](assets/7.png) | ![Admin](assets/8.png) |

</div>

---

## 🎯 Project Overview

StayEase is a **full-stack hotel booking platform** built for scale, designed to go well beyond a basic CRUD application. It combines a live worldwide hotel inventory (via the Booking.com RapidAPI), on-platform property management, Google Places enrichment, and a multi-source data aggregation pipeline — delivering an experience comparable to industry booking platforms.

### What makes this different from a tutorial project:

| Capability | Implementation |
|---|---|
| **Live worldwide inventory** | Booking.com RapidAPI integration with INR/GBP currency detection |
| **Multi-source enrichment** | Google Places + Tripadvisor + Expedia APIs merged per hotel |
| **AI hotel chatbot** | Custom NLP intent parser with locale-aware pricing (₹/£) |
| **Role-based dashboards** | Customer, Owner, and Admin portals with distinct UIs |
| **Business analytics** | Revenue forecasting, trend analysis, system performance metrics |
| **Currency-aware pricing** | DB hotels always ₹ (INR), external hotels use native API currency |
| **E2E test suite** | Playwright tests covering auth, hotel management, booking flows |
| **Docker-ready backend** | Multi-stage Dockerfile with health checks |
| **Swagger API docs** | Auto-generated interactive API documentation |

---

## ✨ Feature Highlights

### 🔍 Search & Discovery
- Full-text hotel search with destination, check-in/out, adult/child count
- Real-time filter sidebar: star rating, hotel type, facilities, max price
- Live worldwide hotel results merged with on-platform DB hotels
- Sort by: recommended, top rated, price ascending/descending
- Popular city quick-links with default date pre-fill
- Autocomplete dropdown from DB hotel cities

### 🤖 AI Hotel Assistant
- Floating chatbot with session ring-buffer (last 5 messages)
- Custom intent extractor: destination, price, star rating, hotel type, guest count
- Locale-aware pricing — Indian cities auto-switch to ₹ thresholds
- Parallel DB + external hotel search with unified results
- "View all results" deep-links to search page, hotel cards link to detail page
- Load-more pagination within chat, external hotel cache for Detail page

### 🏨 Hotel Detail Page (Booking.com-grade)
- Hero image grid (1 large + 4 thumbnails) → fullscreen gallery modal with keyboard nav
- Sticky tab bar: Overview | About | Rooms | Accessibility | Policies
- Room selection cards with pricing breakdown (GST for DB, native currency for external)
- Grouped amenities (WiFi & Tech / Pool & Wellness / Dining / Services / Safety)
- Google-authenticated guest reviews with category scores & distribution bars
- Lazy-loaded map (Google Static Maps or OpenStreetMap fallback)
- Nearby places: restaurants, attractions, transport, shopping — with Google Maps links
- Full policies + contact section

### 💳 Booking & Payments
- Stripe PaymentIntent-based booking flow
- GuestInfoForm with live date picker, adult/child count, total price calculation
- Booking confirmation with status tracking (pending → confirmed → completed)
- Test credentials helper with one-click copy

### 👥 Role-based Dashboards
- **Customer Dashboard**: booking history table, upcoming stays, recommended hotels
- **Owner Dashboard**: property management, per-hotel revenue/booking stats, booking log modal
- **Admin Dashboard**: platform-wide stats, all hotels table, analytics deep-link

### 📊 Business Analytics (3 tabs)
- **Overview**: revenue charts, daily bookings bar chart, popular destinations pie chart, top hotels table
- **Forecasting**: 4-week linear regression forecast for bookings and revenue
- **Performance**: system memory/CPU, database metrics, application KPIs

### 🔐 Authentication
- JWT dual-auth: httpOnly cookie + `Authorization: Bearer` header
- Google OAuth (optional, enabled via `VITE_GOOGLE_CLIENT_ID`)
- bcrypt password hashing (12 rounds on register)
- Token stored in localStorage as fallback for privacy browsers

### 🌍 Currency System
- `formatINR()` — DB hotels, always ₹, never converts
- `formatExternal()` — external hotels, uses API-native currency code
- User-selectable display currency (GBP / USD / INR) with cross-rate conversion
- Currency selector in header (desktop) and mobile nav

### 🗺️ Map Integration
- Google Maps Static API (single `<img>` tag, no JS SDK required)
- OpenStreetMap iframe fallback when no Google key is set
- Nearby places from Google Places Nearby Search API (restaurant / attraction / transport / shopping)

### 🧪 E2E Testing
- Playwright test suite covering sign-in, registration, add hotel, edit hotel, search, detail, and full booking flow

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                           │
│                                                                     │
│  React 18 + TypeScript + Vite + Tailwind CSS                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │  Pages   │ │Components│ │ Contexts │ │ Forms    │             │
│  │ (Routes) │ │  + UI    │ │ App/     │ │ Booking/ │             │
│  │          │ │  Lib     │ │ Search/  │ │ Hotel/   │             │
│  │          │ │          │ │ Currency │ │ Guest    │             │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘             │
│       └────────────┴────────────┴────────────┘                    │
│                    API Client (Axios + React Query)                 │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ HTTPS / REST
┌─────────────────────────────▼───────────────────────────────────────┐
│                    BACKEND (Express + TypeScript)                    │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │  /auth   │ │ /hotels  │ │/my-hotels│ │/bookings │             │
│  │  /users  │ │ /search  │ │/my-      │ │/my-      │             │
│  │          │ │ /details │ │bookings  │ │bookings  │             │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘             │
│       │             │            │              │                   │
│  ┌────▼─────────────▼────────────▼──────────────▼──────┐          │
│  │              Service Layer                            │          │
│  │  aggregatorService │ externalHotelService            │          │
│  │  googlePlacesService │ tripadvisorService             │          │
│  │  expediaService │ bookingExtractors                   │          │
│  └───────────────────────┬──────────────────────────────┘          │
│                          │                                          │
│  ┌───────────────────────▼──────────────────────────────┐          │
│  │              Database Layer (MongoDB / Mongoose)      │          │
│  │  User │ Hotel │ Booking │ Review │ Analytics          │          │
│  └──────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼─────────────────────┐
         │                    │                     │
    ┌────▼────┐         ┌─────▼────┐         ┌─────▼────┐
    │ Booking │         │  Google  │         │Tripadvisor│
    │.com API │         │  Places  │         │  + Expedia│
    │(RapidAPI│         │   API    │         │  (RapidAPI│
    └─────────┘         └──────────┘         └──────────┘
```

### Data Flow: External Hotel Enrichment

```
GET /api/hotels/details/:id
        │
        ▼
   Is external? (booking_*)
        │                   │
       YES                  NO
        │                   │
   getRapidDetails()   Hotel.findById()
        │                   │
        └────────┬──────────┘
                 │
         getEnrichedHotelDetails()
                 │
    ┌────────────┼─────────────┐
    │            │             │
getGoogleDetails()  getTripAdvisor()  getExpediaData()
    │            │             │
    └────────────┴─────────────┘
                 │
         Merge + Deduplicate
         (images/amenities/reviews)
                 │
         10-min in-memory cache
                 │
         EnrichedHotel response
```

---

## 📁 Project Structure

```
stayease-hotel-booking-platform/
│
├── assets/                          # Screenshots for README
│   ├── 1.png … 8.png
│
├── shared/                          # Shared TypeScript types
│   ├── types.ts                     # UserType, HotelType, BookingType, etc.
│   └── types.js                     # Compiled JS
│
├── hotel-booking-frontend/          # React + Vite frontend
│   ├── public/
│   ├── src/
│   │   ├── api-client.ts            # All API call functions
│   │   ├── App.tsx                  # Routes + layout wrappers
│   │   ├── main.tsx                 # App entry, Google OAuth provider
│   │   ├── index.css                # Tailwind base
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui primitives
│   │   │   ├── dashboard/           # StatsCard, SectionCard, DashboardTable
│   │   │   ├── AIChatbot.tsx        # Floating AI assistant
│   │   │   ├── HotelHeader.tsx      # Image grid + sticky tabs + highlights
│   │   │   ├── Map.tsx              # Google Static / OSM map
│   │   │   ├── SearchResultsCard.tsx
│   │   │   ├── LatestDestinationCard.tsx
│   │   │   ├── PopularCities.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── BookingLogModal.tsx
│   │   │   ├── CurrencySelector.tsx
│   │   │   └── …
│   │   │
│   │   ├── contexts/
│   │   │   ├── AppContext.tsx        # isLoggedIn, toast, global loading
│   │   │   ├── SearchContext.tsx     # destination, dates, guest count
│   │   │   └── CurrencyContext.tsx  # formatINR / formatExternal / format
│   │   │
│   │   ├── forms/
│   │   │   ├── BookingForm/         # Stripe card + booking submit
│   │   │   ├── GuestInfoForm/       # Date picker + guest counts
│   │   │   └── ManageHotelForm/     # Multi-section hotel form
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAppContext.ts
│   │   │   ├── useSearchContext.ts
│   │   │   ├── useLoadingHooks.ts   # useQueryWithLoading, useMutationWithLoading
│   │   │   └── use-toast.ts
│   │   │
│   │   ├── layouts/
│   │   │   ├── Layout.tsx           # Header + Footer + AIChatbot
│   │   │   ├── AuthLayout.tsx       # Minimal header/footer
│   │   │   └── DashboardLayout.tsx  # Sidebar + topbar for dashboards
│   │   │
│   │   ├── lib/
│   │   │   ├── api-client.ts        # Axios instance + interceptors
│   │   │   ├── nav-utils.ts
│   │   │   └── utils.ts             # cn() helper
│   │   │
│   │   └── pages/
│   │       ├── Home.tsx
│   │       ├── Search.tsx
│   │       ├── Detail.tsx
│   │       ├── Booking.tsx
│   │       ├── MyBookings.tsx
│   │       ├── MyHotels.tsx
│   │       ├── AddHotel.tsx
│   │       ├── EditHotel.tsx
│   │       ├── Register.tsx
│   │       ├── SignIn.tsx
│   │       ├── AuthCallback.tsx
│   │       ├── Customerdashboard.tsx
│   │       ├── Ownerdashboard.tsx
│   │       ├── Admindashboard.tsx
│   │       ├── AnalyticsDashboard.tsx
│   │       ├── ApiDocs.tsx
│   │       └── ApiStatus.tsx
│   │
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── vercel.json
│
├── hotel-booking-backend/           # Express + TypeScript backend
│   ├── src/
│   │   ├── index.ts                 # Express app, MongoDB connect w/ retry
│   │   ├── swagger.ts               # Swagger/OpenAPI config
│   │   │
│   │   ├── middleware/
│   │   │   └── auth.ts              # verifyToken (cookie + Bearer)
│   │   │
│   │   ├── models/
│   │   │   ├── user.ts
│   │   │   ├── hotel.ts
│   │   │   ├── booking.ts
│   │   │   ├── review.ts
│   │   │   └── analytics.ts
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.ts              # register, login, google-login, logout, validate-token
│   │   │   ├── hotels.ts            # search, list, details/:id, external/:id, booking
│   │   │   ├── my-hotels.ts         # CRUD for owner's hotels + image upload
│   │   │   ├── bookings.ts          # Admin booking management
│   │   │   ├── my-bookings.ts       # User's own bookings
│   │   │   ├── users.ts             # /me, register
│   │   │   ├── ai.ts                # POST /chat, GET /history/:sessionId
│   │   │   ├── business-insights.ts # dashboard, forecast, system-stats
│   │   │   └── health.ts            # /, /detailed
│   │   │
│   │   ├── services/
│   │   │   ├── aggregatorService.ts       # EnrichedHotel builder, 10-min cache
│   │   │   ├── externalHotelService.ts    # Booking.com RapidAPI, currency fix
│   │   │   ├── googlePlacesService.ts     # findPlaceId, getPlaceDetails, getNearbyPlaces
│   │   │   ├── tripadvisorService.ts      # Reviews + rating aggregation
│   │   │   ├── expediaService.ts          # Images + amenities + rooms
│   │   │   └── bookingExtractors.ts       # extractBookingDetails, extractGoogleDetails
│   │   │
│   │   └── scripts/
│   │       ├── seedDemoUsers.ts     # Seeds user/owner/admin accounts
│   │       └── seedIndianHotels.ts  # Seeds 25 Indian hotels (Bangalore/Hyderabad/Goa/Delhi/etc.)
│   │
│   ├── .env.example
│   ├── Dockerfile                   # Multi-stage build
│   └── package.json
│
├── e2e-tests/                       # Playwright E2E test suite
│   ├── tests/
│   │   ├── auth.spec.ts
│   │   ├── manage-hotels.spec.ts
│   │   └── search-hotels.spec.ts
│   └── playwright.config.ts
│
├── data/
│   ├── test-hotel.json
│   ├── test-users.json
│   └── hotel_images/
│
└── shared/
    └── types.ts
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.2 | UI library |
| TypeScript | 5.0 | Type safety |
| Vite | 7.x | Build tool & dev server |
| Tailwind CSS | 3.3 | Utility-first styling |
| React Router DOM | 6.x | Client-side routing |
| React Query | 3.x | Server state + caching |
| React Hook Form | 7.x | Form handling & validation |
| @stripe/react-stripe-js | 3.x | Payment UI |
| @react-oauth/google | 0.13 | Google OAuth |
| Lucide React | 0.54 | Icon library |
| Recharts | 3.x | Analytics charts |
| shadcn/ui | — | Component primitives |
| Axios | 1.x | HTTP client |
| js-cookie | 3.x | Cookie utilities |
| react-datepicker | 4.x | Date selection |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 20 | Runtime |
| Express.js | 4.18 | Web framework |
| TypeScript | 5.x | Type safety |
| MongoDB | 6+ | Database |
| Mongoose | 8.x | ODM |
| jsonwebtoken | 9.x | JWT auth |
| bcryptjs | 2.x | Password hashing |
| Multer | 1.4 | File upload |
| Cloudinary | 1.x | Image storage |
| Stripe | 14.x | Payment processing |
| Axios | 1.x | External API calls |
| express-validator | 7.x | Input validation |
| swagger-jsdoc | 6.x | API documentation |
| Helmet | 8.x | Security headers |
| Morgan | 1.x | HTTP logging |
| cookie-parser | 1.x | Cookie parsing |

### External Integrations
| Service | Purpose |
|---|---|
| Booking.com RapidAPI | Live worldwide hotel inventory + pricing |
| Google Places API | Coordinates, photos, reviews, nearby places |
| Tripadvisor RapidAPI | Authentic reviews + subratings |
| Expedia RapidAPI | High-res images + full amenity lists + rooms |
| Stripe | Secure payment processing |
| Cloudinary | Hotel image upload + transformation |

---

## 🔐 Authentication Flow

```
┌─────────┐     POST /api/auth/login      ┌─────────────────┐
│ Browser │ ──────────────────────────── ▶ │   Express Auth  │
│         │                               │   Route         │
│         │ ◀ ─────────────────────────── │                 │
│         │   Set-Cookie: auth_token      │  bcrypt.compare │
│         │   + JSON { token, userId }    │  jwt.sign()     │
└────┬────┘                               └─────────────────┘
     │
     │  Subsequent requests
     │
     ├── Cookie browser: auth_token in cookie (auto-sent)
     │
     └── Privacy/mobile: Authorization: Bearer <token>
                                    │
                          ┌─────────▼───────────┐
                          │  verifyToken        │
                          │  middleware         │
                          │  reads EITHER       │
                          │  cookie OR header   │
                          │  → sets req.userId  │
                          └─────────────────────┘
```

**Google OAuth Flow:**
1. User clicks "Sign in with Google" → `GoogleLogin` component fires
2. Credential sent to `POST /api/auth/google-login`
3. Backend verifies with `google-auth-library`, finds or creates user
4. Returns same JWT response as email login
5. `AuthCallback.tsx` handles redirect-based OAuth if configured

---

## 💾 Database Design Overview

### Collections & Indexes

```
Users
  ├── email (unique, indexed)
  ├── role: "user" | "admin" | "hotel_owner"
  ├── totalBookings, totalSpent (denormalized counters)
  └── preferences: { preferredDestinations, budgetRange }

Hotels
  ├── userId (indexed — links to owner)
  ├── city, country (indexed)
  ├── pricePerNight (indexed)
  ├── starRating (indexed)
  ├── compound indexes: (city, starRating), (price, starRating)
  ├── location: { latitude, longitude, address }
  ├── contact, policies, amenities (optional enrichment)
  └── totalBookings, totalRevenue (denormalized analytics)

Bookings
  ├── userId (indexed)
  ├── hotelId (indexed)
  ├── status: pending | confirmed | cancelled | completed | refunded
  ├── paymentStatus: pending | paid | failed | refunded
  ├── compound indexes: (userId, createdAt), (hotelId, checkIn)
  └── specialRequests, cancellationReason, refundAmount

Reviews
  ├── userId, hotelId, bookingId (all indexed)
  ├── rating (1-5), categories: { cleanliness, service, location, value, amenities }
  └── isVerified, helpfulCount

Analytics
  ├── date (indexed)
  ├── metrics: { totalBookings, totalRevenue, conversionRate, cancellationRate }
  └── breakdown: { byStatus, byPaymentStatus, byDestination, byHotelType }
```

---

## 🚀 Local Development Setup

### Prerequisites

- Node.js ≥ 18
- MongoDB (local or Atlas)
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/bhanurx100/stayease-hotel-booking-platform.git
cd stayease-hotel-booking-platform
```

### 2. Backend Setup

```bash
cd hotel-booking-backend
npm install
cp .env.example .env
# Edit .env with your values (see Environment Variables below)
npm run dev
# Backend starts at http://localhost:5000
```

### 3. Frontend Setup

```bash
cd hotel-booking-frontend
npm install
# Create .env file:
echo "VITE_API_BASE_URL=http://localhost:5000" > .env
echo "VITE_STRIPE_PUB_KEY=pk_test_..." >> .env
npm run dev
# Frontend starts at http://localhost:5174
```

### 4. Seed the Database (optional but recommended)

```bash
cd hotel-booking-backend

# Seed demo users (user@test.com / owner@test.com / admin@test.com — password: 123456)
npx ts-node src/scripts/seedDemoUsers.ts

# Seed 25 Indian hotels across Bangalore, Hyderabad, Goa, Delhi, Chennai, Coorg, Ooty
npx ts-node src/scripts/seedIndianHotels.ts
```

---

## 🔧 Environment Variables

### Backend — `.env`

```env
# ── Server ────────────────────────────────────────
PORT=5000
NODE_ENV=development

# ── Database ─────────────────────────────────────
MONGODB_CONNECTION_STRING=mongodb+srv://user:pass@cluster.mongodb.net/stayease

# ── Auth ─────────────────────────────────────────
JWT_SECRET_KEY=your-very-long-random-secret-here

# ── Frontend ─────────────────────────────────────
FRONTEND_URL=http://localhost:5174
BACKEND_URL=http://localhost:5000  # optional, for Swagger server URL

# ── Cloudinary (image upload) ────────────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ── Stripe ───────────────────────────────────────
STRIPE_API_KEY=sk_test_...

# ── External Hotel APIs (RapidAPI) ───────────────
RAPID_API_KEY=your_rapidapi_key
RAPID_API_HOST=booking-com.p.rapidapi.com

# ── Google Places ────────────────────────────────
GOOGLE_PLACES_API_KEY=AIza...
# OR
GOOGLE_MAPS_API_KEY=AIza...

# ── Tripadvisor (optional) ───────────────────────
TRIPADVISOR_API_KEY=your_rapidapi_key
TRIPADVISOR_API_HOST=tripadvisor16.p.rapidapi.com

# ── Expedia (optional) ───────────────────────────
EXPEDIA_API_KEY=your_rapidapi_key
EXPEDIA_API_HOST=expedia-com2.p.rapidapi.com

# ── Google OAuth (optional) ──────────────────────
GOOGLE_CLIENT_ID=your_google_client_id
```

> **Graceful degradation**: The app runs without Tripadvisor, Expedia, or Google Places keys — those enrichment layers simply return empty/fallback data.

### Frontend — `.env`

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_STRIPE_PUB_KEY=pk_test_...
VITE_GOOGLE_CLIENT_ID=optional_google_oauth_client_id
VITE_GOOGLE_MAPS_API_KEY=optional_for_static_maps
```

---

## 🐳 Docker Setup

The backend ships with a production-ready multi-stage Dockerfile.

```bash
# Build the Docker image (run from repo root)
docker build -f hotel-booking-backend/Dockerfile -t stayease-backend .

# Run the container
docker run -p 3000:3000 \
  -e MONGODB_CONNECTION_STRING="..." \
  -e JWT_SECRET_KEY="..." \
  -e STRIPE_API_KEY="..." \
  stayease-backend
```

**Dockerfile highlights:**
- Stage 1 (`builder`): installs all deps, compiles TypeScript
- Stage 2 (`runner`): production deps only, copies compiled `dist/`
- `HEALTHCHECK` polls `/api/health` every 30 seconds
- Exposes port 3000 (map to any host port)

**Coolify / VPS deployment:**
- Base Directory: `.` (repo root)
- Dockerfile path: `hotel-booking-backend/Dockerfile`
- Set `PORT=3000` and map `host:container` accordingly

---

## 🧪 Testing

### E2E Tests (Playwright)

```bash
cd e2e-tests
npm install
npx playwright install  # install browsers

# Run all tests
npx playwright test

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test file
npx playwright test tests/auth.spec.ts
```

**Test coverage:**
- `auth.spec.ts` — sign-in and registration flows
- `manage-hotels.spec.ts` — add hotel, view hotels list, edit hotel
- `search-hotels.spec.ts` — search results, hotel detail, full booking flow

Tests run against `http://localhost:5174` with a pre-seeded MongoDB.

---

## 🌐 Deployment

### Frontend → Vercel

```bash
cd hotel-booking-frontend
npm run build
# Push to GitHub, connect repo to Vercel
# Set environment variables in Vercel dashboard
```

`vercel.json` is pre-configured with SPA rewrites and API base URL.

### Backend → Render / Railway / Coolify

- Set all backend environment variables in your hosting dashboard
- Use the `hotel-booking-backend/Dockerfile` for containerized deployment
- MongoDB: use Atlas for production

### Backend → Coolify (self-hosted VPS)

1. Connect GitHub repository
2. Select `hotel-booking-backend/Dockerfile` as the Dockerfile path
3. Set Base Directory to `.` (repo root, required for `shared/` access)
4. Configure environment variables
5. Deploy

---

## 🗺️ Roadmap

- [ ] WebSocket real-time booking notifications
- [ ] Review submission after completed stays
- [ ] Hotel availability calendar (room-level)
- [ ] Email confirmation system (Nodemailer/Resend)
- [ ] Multi-language support (i18n)
- [ ] Mobile app (React Native)
- [ ] Redis caching for high-traffic routes
- [ ] Rate limiting per user (not just per IP)
- [ ] Loyalty/rewards points system
- [ ] Webhook for Stripe payment events

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

Please follow the existing TypeScript conventions and ensure E2E tests pass.

---

## 👨‍💻 Author

**Bhanuprasad L**

Full-Stack Developer — MERN Stack · TypeScript · Cloud Integrations

[![GitHub](https://img.shields.io/badge/GitHub-bhanurx100-black?logo=github)](https://github.com/bhanurx100)

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

<div align="center">
<sub>Built with ❤️ by Bhanuprasad L · StayEase — Book smarter, stay better.</sub>
</div>