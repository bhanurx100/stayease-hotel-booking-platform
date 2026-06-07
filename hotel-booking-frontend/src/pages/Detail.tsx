/**
 * Property detail page — DB and external hotels share one layout.
 * Data: getHotelDetail → /api/hotels/details/:id (EnrichedHotel + extra)
 */

import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "react-query";
import {
  Building2, ChevronLeft, Clock, ShieldCheck, Users, Heart, Leaf,
  Phone, Globe, MapPin,
} from "lucide-react";

import GuestInfoForm from "../forms/GuestInfoForm/GuestInfoForm";
import DetailHero from "../components/detail/DetailHero";
import AboutPropertySection from "../components/detail/AboutPropertySection";
import { isPropertySaved, toggleSavedProperty } from "../components/detail/BookingCard";
import AISummary from "../components/detail/AISummary";
import RoomsSection from "../components/detail/RoomComparison";
import AmenitiesSection from "../components/detail/AmenitiesSection";
import LocationSection from "../components/detail/LocationSection";
import ReviewsSection from "../components/detail/ReviewsSection";
import FAQSection from "../components/detail/FAQSection";
import SimilarHotels from "../components/detail/SimilarHotels";

import { useCurrency } from "../features/currency/CurrencyContext";
import useSearchContext from "../hooks/useSearchContext";
import * as apiClient from "../api-client";
import {
  buildAISummaryFromHotel,
  buildDynamicFAQs,
  mergeAllPhotos,
  mergeFacilityGroups,
  normalizeRoom,
} from "../lib/hotel-detail-utils";

interface MapLocation {
  lat: number;
  lng: number;
  address: string;
}

function isValidMapCoord(lat: unknown, lng: unknown): boolean {
  const la = Number(lat);
  const lo = Number(lng);
  return (
    Number.isFinite(la) && Number.isFinite(lo) &&
    la >= -90 && la <= 90 &&
    lo >= -180 && lo <= 180 &&
    !(la === 0 && lo === 0)
  );
}

function resolveMapLocation(hotel: any, extra: any): MapLocation | null {
  const addressFallback = String(hotel?.address ?? "");
  const candidates = [
    extra?.location,
    hotel?.coordinates,
    hotel?.location?.lat != null ? hotel.location : null,
    hotel?.location?.latitude != null
      ? {
          latitude: hotel.location.latitude,
          longitude: hotel.location.longitude,
          address: typeof hotel.location.address === "string"
            ? hotel.location.address
            : addressFallback,
        }
      : null,
  ];

  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    const lat = (c as any).lat ?? (c as any).latitude;
    const lng = (c as any).lng ?? (c as any).longitude ?? (c as any).lon;
    if (!isValidMapCoord(lat, lng)) continue;
    return {
      lat: Number(lat),
      lng: Number(lng),
      address: String((c as any).address ?? addressFallback),
    };
  }
  return null;
}

const LoadingSkeleton = () => (
  <div className="max-w-6xl mx-auto px-4 space-y-6 pb-24 animate-pulse overflow-x-hidden">
    <div className="h-4 bg-gray-200 rounded w-48" />
    <div className="h-9 bg-gray-200 rounded w-2/3" />
    <div className="h-56 md:h-[460px] bg-gray-200 rounded-2xl" />
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-gray-100 rounded-2xl" />
        ))}
      </div>
      <div className="h-72 bg-gray-100 rounded-2xl hidden lg:block" />
    </div>
  </div>
);

const Detail = () => {
  const params = useParams<{ id?: string; hotelId?: string }>();
  const hotelId = params.hotelId || params.id || "";
  const isExternal = hotelId.startsWith("booking_");
  const isDB = !isExternal;

  const search = useSearchContext();
  const [checkIn, setCheckIn] = useState(search.checkIn);
  const [checkOut, setCheckOut] = useState(search.checkOut);
  const [adultCount, setAdultCount] = useState(search.adultCount);
  const [childCount, setChildCount] = useState(search.childCount);

  const roomsSectionRef = useRef<HTMLDivElement>(null);
  const bookingPanelRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(() => isPropertySaved(hotelId));

  useEffect(() => {
    setSaved(isPropertySaved(hotelId));
  }, [hotelId]);

  const { formatPrice: formatPriceGlobal } = useCurrency();

  const {
    data: enriched,
    isLoading: enrichedLoading,
    error: enrichedError,
  } = useQuery(
    ["hotel-detail", hotelId],
    () => apiClient.getHotelDetail(hotelId),
    { enabled: !!hotelId, staleTime: 5 * 60_000, retry: 2 }
  );

  const { data: rawHotel } = useQuery(
    ["raw-hotel", hotelId],
    () => apiClient.fetchHotelById(hotelId),
    { enabled: !!hotelId && isDB, staleTime: 5 * 60_000, retry: 1 }
  );

  const hotel: any = enriched ?? (isDB ? rawHotel : null);
  const extra: any = (enriched as any)?.extra ?? null;

  const allPhotos = useMemo(
    () => (hotel ? mergeAllPhotos(hotel, extra) : []),
    [hotel, extra]
  );
  const flatAmenities = mergeFacilityGroups(
    extra?.amenities ?? hotel?.amenities ?? hotel?.facilities ?? [],
    hotel?.facilities
  );
  const reviews: any[] = extra?.reviews ?? hotel?.reviews ?? [];
  const rawRooms: any[] = hotel?.rooms ?? extra?.rooms ?? [];
  const revSum = hotel?.reviewsSummary ?? extra?.reviewsSummary ?? null;
  const location = resolveMapLocation(hotel, extra);
  const nearby = extra?.nearby ?? hotel?.nearbyPlaces ?? null;
  const policies = hotel?.policies ?? extra?.policies ?? {};
  const contact = hotel?.contact ?? {};

  const overallRating = Number(extra?.rating?.overall ?? hotel?.rating ?? hotel?.averageRating ?? 0);
  const ratingWord = extra?.rating?.ratingWord ?? hotel?.ratingWord ?? "";
  const reviewCount = Number(extra?.rating?.totalReviews ?? hotel?.reviewCount ?? 0);

  const detailRooms = useMemo(
    () => rawRooms.map((r, i) => normalizeRoom(r, i, allPhotos)),
    [rawRooms, allPhotos]
  );

  const aiSummary = useMemo(
    () => buildAISummaryFromHotel(hotel, revSum, flatAmenities),
    [hotel, revSum, flatAmenities]
  );

  const faqs = useMemo(
    () => buildDynamicFAQs(hotel, policies, flatAmenities),
    [hotel, policies, flatAmenities]
  );

  const destination = hotel?.city || hotel?.country || "";
  const { data: similarData } = useQuery(
    ["similar-hotels", destination, hotelId],
    () =>
      apiClient.searchHotels({
        destination: String(destination),
        limit: "12",
        checkIn: checkIn.toISOString().slice(0, 10),
        checkOut: checkOut.toISOString().slice(0, 10),
        adultCount: String(adultCount),
        childCount: String(childCount),
      }),
    { enabled: !!destination && !!hotel, staleTime: 10 * 60_000 }
  );

  const allSearchHotels = similarData?.data ?? [];
  const similarHotels = allSearchHotels.slice(0, 8);
  const nearbyHotels = allSearchHotels.slice(4, 12);

  const showLoading = isExternal
    ? enrichedLoading && !enriched
    : enrichedLoading && !rawHotel && !enriched;

  const scrollToBooking = useCallback(() => {
    bookingPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleSaveToggle = useCallback(() => {
    setSaved(toggleSavedProperty(hotelId));
  }, [hotelId]);

  const scrollToRooms = useCallback(() => {
    document.getElementById("section-rooms")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (showLoading) return <LoadingSkeleton />;

  if (isExternal && enrichedError && !hotel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Building2 className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Details unavailable</h2>
        <Link to="/search" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl font-semibold">
          <ChevronLeft className="w-4 h-4" /> Back to search
        </Link>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Building2 className="w-12 h-12 text-gray-300 mb-3" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Property not found</h2>
        <Link to="/search" className="text-teal-600 hover:underline font-medium">← Back to search</Link>
      </div>
    );
  }

  const h = hotel;
  const nativeCurrency = isExternal ? String(h.currency ?? "GBP") : "INR";
  const formatPrice = (amount: number, currency?: string) =>
    formatPriceGlobal(amount, currency ?? nativeCurrency);
  const pricePerNight = Number(h.pricePerNight ?? extra?.pricing?.perNight ?? 0);

  const handleDatesChange = (inDt: Date, outDt: Date) => {
    setCheckIn(inDt);
    setCheckOut(outDt);
    search.saveSearchValues(search.destination, inDt, outDt, adultCount, childCount);
  };

  const handleGuestsChange = (adults: number, children: number) => {
    setAdultCount(adults);
    setChildCount(children);
    search.saveSearchValues(search.destination, checkIn, checkOut, adults, children);
  };

  return (
    <div className="overflow-x-hidden max-w-[100vw]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5 pb-28 lg:pb-12">
        <DetailHero
          hotel={h}
          allPhotos={allPhotos}
          amenities={flatAmenities}
          overallRating={overallRating}
          ratingWord={ratingWord}
          reviewCount={reviewCount}
          revSum={revSum}
          isExternal={isExternal}
          formatPrice={formatPrice}
          saved={saved}
          onSaveToggle={handleSaveToggle}
          onViewRooms={scrollToRooms}
        />

        <div className="space-y-6 min-w-0">
            <AISummary data={aiSummary} />

            <AboutPropertySection
              hotel={h}
              extra={extra}
              amenities={flatAmenities}
              revSum={revSum}
              nearby={nearby}
              hotelType={h.type}
            />

            <div ref={roomsSectionRef}>
              <RoomsSection
                rooms={detailRooms}
                hotel={h}
                hotelType={h.type}
                formatPrice={(n) => formatPrice(n, h.currency)}
                nativeCurrency={nativeCurrency}
                isExternal={isExternal}
                isDB={isDB}
                policies={policies}
                checkIn={checkIn}
                checkOut={checkOut}
                adultCount={adultCount}
                childCount={childCount}
                onDatesChange={handleDatesChange}
                onGuestsChange={handleGuestsChange}
                onReserve={scrollToBooking}
              />
            </div>

            <AmenitiesSection amenities={flatAmenities} />

            {location && isValidMapCoord(location.lat, location.lng) && (
              <LocationSection
                lat={location.lat}
                lng={location.lng}
                hotelName={h.name ?? ""}
                address={location.address || h.address || ""}
                nearby={nearby}
              />
            )}

            <ReviewsSection
              reviews={reviews}
              revSum={revSum}
              overallRating={overallRating}
              reviewCount={reviewCount}
            />

            <FAQSection faqs={faqs} />

            <SimilarHotels
              similar={similarHotels}
              nearby={nearbyHotels}
              formatPrice={formatPrice}
              currentId={hotelId}
            />

            {(() => {
              const p = policies;
              const rows = [
                { label: "Check-in", icon: Clock, val: p.checkIn ?? p.checkInTime },
                { label: "Check-out", icon: Clock, val: p.checkOut ?? p.checkOutTime },
                { label: "Cancellation", icon: ShieldCheck, val: p.cancellation ?? p.cancellationPolicy, span: true },
                { label: "Children", icon: Users, val: p.children },
                { label: "Pets", icon: Heart, val: p.pets ?? p.petPolicy },
                { label: "Smoking", icon: Leaf, val: p.smoking ?? p.smokingPolicy },
              ].filter((r) => r.val);
              if (!rows.length) return null;
              return (
                <section id="section-policies" className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Policies</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {rows.map(({ label, icon: Icon, val, span }) => (
                      <div key={label} className={`flex items-start gap-3 ${span ? "sm:col-span-2" : ""}`}>
                        <Icon className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{label}</p>
                          <p className="text-sm text-gray-500">{val}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })()}

            {(contact.phone || contact.email || contact.website) && (
              <section className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Contact</h2>
                <div className="space-y-3">
                  {contact.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-teal-600" />
                      <a href={`tel:${contact.phone}`} className="text-sm text-gray-700 hover:text-teal-600">{contact.phone}</a>
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center gap-3">
                      <Globe className="w-4 h-4 text-teal-600" />
                      <a href={`mailto:${contact.email}`} className="text-sm text-teal-600 hover:underline">{contact.email}</a>
                    </div>
                  )}
                  {contact.website && (
                    <div className="flex items-center gap-3">
                      <Globe className="w-4 h-4 text-teal-600" />
                      <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-600 hover:underline">
                        Visit website
                      </a>
                    </div>
                  )}
                </div>
              </section>
            )}

          {isDB && h._id && pricePerNight > 0 && (
            <div id="booking-panel" ref={bookingPanelRef} className="hidden lg:block bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-3">Complete your booking</h3>
              <GuestInfoForm pricePerNight={pricePerNight} hotelId={String(h._id)} />
            </div>
          )}
        </div>

      </div>

      {/* Mobile: full booking form in drawer area — show GuestInfoForm via reserve scroll on DB */}
      {isDB && h._id && pricePerNight > 0 && (
        <div className="lg:hidden max-w-6xl mx-auto px-4 pb-32">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-600" /> Complete your booking
            </h3>
            <GuestInfoForm pricePerNight={pricePerNight} hotelId={String(h._id)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Detail;
