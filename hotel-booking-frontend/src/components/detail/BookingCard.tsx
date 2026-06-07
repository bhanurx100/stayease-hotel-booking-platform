/**
 * Booking: compact hero card (desktop), bottom bar + drawer (mobile).
 */

import React, { memo, useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  Heart, ChevronUp, ChevronDown, ShieldCheck, Clock, CreditCard, X,
} from "lucide-react";
import { useCurrency } from "../../features/currency/CurrencyContext";
import { propertyLabel, resolvePropertyKind } from "../../lib/property-types";

const SAVED_KEY = "stayease_saved_properties";

export function toggleSavedProperty(id: string): boolean {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const idx = list.indexOf(id);
    if (idx >= 0) {
      list.splice(idx, 1);
      localStorage.setItem(SAVED_KEY, JSON.stringify(list));
      return false;
    }
    list.push(id);
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function isPropertySaved(id: string): boolean {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return list.includes(id);
  } catch {
    return false;
  }
}

export interface BookingCardProps {
  hotelId: string;
  hotel: any;
  pricePerNight: number;
  nativeCurrency: string;
  isExternal: boolean;
  isDB: boolean;
  policies: any;
  checkIn: Date;
  checkOut: Date;
  adultCount: number;
  childCount: number;
  onDatesChange: (checkIn: Date, checkOut: Date) => void;
  onGuestsChange: (adults: number, children: number) => void;
  onReserve: () => void;
  stopStickyAfterRef?: React.RefObject<HTMLElement | null>;
  children?: React.ReactNode;
  variant?: "hero" | "inline";
  saved?: boolean;
  onSaveToggle?: () => void;
}

const BookingCard = memo(({
  hotelId,
  hotel,
  pricePerNight,
  nativeCurrency,
  isExternal,
  isDB,
  policies,
  checkIn,
  checkOut,
  adultCount,
  childCount,
  onDatesChange,
  onGuestsChange,
  onReserve,
  stopStickyAfterRef,
  children,
  variant = "inline",
  saved: savedProp,
  onSaveToggle,
}: BookingCardProps) => {
  const { formatPrice, convertPrice, currency } = useCurrency();
  const [savedInternal, setSavedInternal] = useState(() => isPropertySaved(hotelId));
  const saved = savedProp ?? savedInternal;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pastRooms, setPastRooms] = useState(false);
  const kind = resolvePropertyKind(hotel?.type);
  const label = propertyLabel(kind);
  const isHero = variant === "hero";

  useEffect(() => {
    setPastRooms(false);
    const el = stopStickyAfterRef?.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setPastRooms(true);
      },
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [stopStickyAfterRef, hotelId]);

  const nights = Math.max(
    1,
    Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
  );
  const total = pricePerNight * nights;
  const converted = convertPrice(pricePerNight, nativeCurrency);
  const showConverted = currency !== nativeCurrency.toUpperCase() && converted > 0;

  const handleSave = () => {
    if (onSaveToggle) {
      onSaveToggle();
      return;
    }
    setSavedInternal(toggleSavedProperty(hotelId));
  };

  const priceBlock = (compact = false) => (
    <div>
      {pricePerNight > 0 ? (
        <>
          <p className={`font-extrabold text-gray-900 ${compact ? "text-xl" : "text-2xl"}`}>
            {formatPrice(pricePerNight, nativeCurrency)}
            <span className="text-sm font-normal text-gray-500"> / night</span>
          </p>
          {showConverted && (
            <p className="text-xs text-gray-500 mt-0.5">
              Originally {nativeCurrency} {Math.round(pricePerNight).toLocaleString()} / night
            </p>
          )}
          {nights > 1 && (
            <p className="text-xs text-teal-700 font-semibold mt-0.5">
              {formatPrice(total, nativeCurrency)} for {nights} nights
            </p>
          )}
        </>
      ) : (
        <p className={`font-semibold text-gray-700 ${compact ? "text-base" : "text-lg"}`}>
          Price on request
        </p>
      )}
    </div>
  );

  const formFields = (
    <div className="space-y-2.5 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase">Check-in</label>
          <DatePicker
            selected={checkIn}
            onChange={(d) => d && onDatesChange(d, checkOut < d ? new Date(d.getTime() + 86400000) : checkOut)}
            minDate={new Date()}
            className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase">Check-out</label>
          <DatePicker
            selected={checkOut}
            onChange={(d) => d && onDatesChange(checkIn, d)}
            minDate={checkIn}
            className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-semibold text-gray-500">Guests</label>
          <select
            value={adultCount}
            onChange={(e) => onGuestsChange(Number(e.target.value), childCount)}
            className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n} adult{n > 1 ? "s" : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500">Children</label>
          <select
            value={childCount}
            onChange={(e) => onGuestsChange(adultCount, Number(e.target.value))}
            className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          >
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>
      {!isDB && (
        <div className="text-[11px] text-gray-500 space-y-1">
          <p className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-green-500" /> Verify cancellation with {label.toLowerCase()}</p>
          <p className="flex items-center gap-1"><Clock className="w-3 h-3 text-teal-500" /> Check-in: {policies?.checkIn ?? policies?.checkInTime ?? "From 15:00"}</p>
        </div>
      )}
      <button
        type="button"
        onClick={onReserve}
        className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-colors"
      >
        {isExternal ? "Reserve — Pay at property" : `Reserve ${label.toLowerCase()}`}
      </button>
      <button
        type="button"
        onClick={handleSave}
        className={`w-full py-2 border rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 ${
          saved ? "border-rose-300 bg-rose-50 text-rose-700" : "border-gray-200 hover:bg-gray-50"
        }`}
      >
        <Heart className={`w-3.5 h-3.5 ${saved ? "fill-rose-500" : ""}`} />
        {saved ? "Saved" : "Save"}
      </button>
      {isExternal && (
        <p className="text-[10px] text-center text-gray-400 flex items-center justify-center gap-1">
          <CreditCard className="w-3 h-3" /> Pay at the property
        </p>
      )}
      {children}
    </div>
  );

  if (isHero) {
    return (
      <div
        className={`w-full max-w-[360px] ${
          !pastRooms ? "sticky top-20" : "relative"
        }`}
      >
        <div className="bg-white rounded-xl border border-gray-200 shadow-md p-4 space-y-3">
          {priceBlock(true)}
          {formFields}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        id="booking-panel"
        className={`hidden lg:block w-full max-w-[360px] ${
          !pastRooms ? "lg:sticky lg:top-24" : "lg:relative"
        }`}
      >
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          {priceBlock()}
          {formFields}
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="px-4 py-2.5 max-w-full">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => setDetailsOpen((o) => !o)}
            >
              {pricePerNight > 0 ? (
                <>
                  <p className="font-bold text-gray-900 text-sm leading-tight">
                    {formatPrice(pricePerNight, nativeCurrency)}
                    <span className="font-normal text-gray-500"> / night</span>
                  </p>
                  <p className="text-[11px] text-gray-500 flex items-center gap-0.5">
                    {nights} night{nights > 1 ? "s" : ""} · {adultCount} guests
                    {detailsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3 rotate-180" />}
                  </p>
                </>
              ) : (
                <p className="font-semibold text-gray-700 text-sm">Price on request</p>
              )}
            </button>
            <button
              type="button"
              data-booking-drawer-trigger
              onClick={() => setDrawerOpen(true)}
              className="flex-shrink-0 px-5 py-2.5 bg-teal-600 text-white font-semibold rounded-xl text-sm"
            >
              Reserve
            </button>
          </div>
          {detailsOpen && pricePerNight > 0 && (
            <p className="text-xs text-teal-700 font-medium pt-1 border-t border-gray-100 mt-2">
              {formatPrice(total, nativeCurrency)} total · {checkIn.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {checkOut.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          )}
        </div>
      </div>

      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} aria-label="Close" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto p-5 pb-8">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-lg">Book your stay</h3>
              <button type="button" onClick={() => setDrawerOpen(false)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            {priceBlock(true)}
            <div className="mt-3">{formFields}</div>
          </div>
        </div>
      )}

      <div className="lg:hidden h-[72px]" aria-hidden />
    </>
  );
});
BookingCard.displayName = "BookingCard";

export default BookingCard;
