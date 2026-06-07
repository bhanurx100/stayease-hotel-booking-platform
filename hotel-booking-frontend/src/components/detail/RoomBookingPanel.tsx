/**
 * Sticky booking panel tied to a selected room (rooms section only).
 */

import { memo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ShieldCheck, Clock, X, BedDouble } from "lucide-react";
import { useCurrency } from "../../features/currency/CurrencyContext";
import type { DetailRoom } from "../../lib/hotel-detail-utils";
import { propertyLabel, resolvePropertyKind } from "../../lib/property-types";

export interface RoomBookingPanelProps {
  hotel: any;
  selectedRoom: DetailRoom | null;
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
  placement: "sidebar" | "drawer";
  onCloseDrawer?: () => void;
}

const RoomBookingPanel = memo(({
  hotel,
  selectedRoom,
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
  placement,
  onCloseDrawer,
}: RoomBookingPanelProps) => {
  const { formatPrice } = useCurrency();
  const kind = resolvePropertyKind(hotel?.type);
  const label = propertyLabel(kind);

  const pricePerNight = selectedRoom?.price ?? Number(hotel?.pricePerNight ?? 0);
  const nights = Math.max(
    1,
    Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
  );
  const total = pricePerNight * nights;

  const shell =
    placement === "drawer"
      ? "bg-white rounded-t-2xl p-5 max-h-[88vh] overflow-y-auto"
      : "bg-white rounded-xl border border-gray-200 shadow-md p-4";

  return (
    <div className={shell}>
      {placement === "drawer" && (
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">Your selection</h3>
          <button type="button" onClick={onCloseDrawer} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {selectedRoom ? (
        <div className="mb-4 pb-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-1">Selected room</p>
          <p className="font-bold text-gray-900 flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-teal-600 flex-shrink-0" />
            <span className="line-clamp-2">{selectedRoom.type}</span>
          </p>
          {selectedRoom.size && (
            <p className="text-xs text-gray-500 mt-1">{selectedRoom.size} · Sleeps {selectedRoom.maxGuests}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-4 pb-4 border-b border-gray-100">
          Select a room to see pricing and reserve.
        </p>
      )}

      {pricePerNight > 0 ? (
        <div className="mb-4">
          <p className="text-2xl font-extrabold text-gray-900">
            {formatPrice(pricePerNight, nativeCurrency)}
            <span className="text-sm font-normal text-gray-500"> / night</span>
          </p>
          {nights > 1 && selectedRoom && (
            <p className="text-sm text-teal-700 font-semibold mt-1">
              {formatPrice(total, nativeCurrency)} for {nights} nights
            </p>
          )}
        </div>
      ) : (
        <p className="text-base font-semibold text-gray-600 mb-4">Price on request</p>
      )}

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
            <label className="text-[10px] font-semibold text-gray-500">Adults</label>
            <select
              value={adultCount}
              onChange={(e) => onGuestsChange(Number(e.target.value), childCount)}
              className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
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

        {selectedRoom && (
          <p className="text-xs text-gray-500 flex items-start gap-1.5 pt-1">
            <ShieldCheck className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${selectedRoom.refundable ? "text-green-500" : "text-gray-400"}`} />
            {selectedRoom.cancellationPolicy}
          </p>
        )}

        {!isDB && (
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-teal-500" />
            Check-in: {policies?.checkIn ?? policies?.checkInTime ?? "From 15:00"}
          </p>
        )}

        <button
          type="button"
          disabled={!selectedRoom && pricePerNight <= 0}
          onClick={onReserve}
          data-booking-drawer-trigger={placement === "drawer" ? undefined : true}
          className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm mt-2"
        >
          {isExternal ? "Reserve — Pay at property" : `Reserve ${label.toLowerCase()}`}
        </button>
      </div>
    </div>
  );
});
RoomBookingPanel.displayName = "RoomBookingPanel";

export default RoomBookingPanel;
