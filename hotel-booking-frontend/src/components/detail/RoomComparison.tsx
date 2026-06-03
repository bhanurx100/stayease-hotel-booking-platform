import React, { memo, useState, useCallback, useMemo } from "react";
import {
  BedDouble, UserCheck, Utensils, ShieldCheck, Percent, Columns3,
  Wifi, Eye, Ruler, X, Check, ImageOff,
} from "lucide-react";
import type { DetailRoom } from "../../lib/hotel-detail-utils";
import { roomsSectionTitle, resolvePropertyKind } from "../../lib/property-types";
import RoomBookingPanel from "./RoomBookingPanel";

export interface RoomsSectionProps {
  rooms: DetailRoom[];
  hotel: any;
  hotelType: string | string[] | undefined;
  formatPrice: (n: number) => string;
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
}

const MAX_COMPARE = 3;

function RoomImage({ room }: { room: DetailRoom }) {
  const [failed, setFailed] = useState(false);
  if (!room.imageUrl || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
        <ImageOff className="w-8 h-8 mb-1" />
        <span className="text-[10px] font-medium">No photo</span>
      </div>
    );
  }
  return (
    <img
      src={room.imageUrl}
      alt={room.type}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

const CompareModal = memo(({
  rooms,
  compareIds,
  formatPrice,
  onClose,
}: {
  rooms: DetailRoom[];
  compareIds: string[];
  formatPrice: (n: number) => string;
  onClose: () => void;
}) => {
  const cols = rooms.filter((r) => compareIds.includes(r.id));
  if (!cols.length) return null;

  const rows: { label: string; render: (r: DetailRoom) => React.ReactNode }[] = [
    { label: "Size", render: (r) => r.size || "—" },
    { label: "Beds", render: (r) => r.beds },
    { label: "Guests", render: (r) => r.maxGuests },
    { label: "Breakfast", render: (r) => (r.freeBreakfast ? "Included" : "—") },
    { label: "Refundable", render: (r) => (r.refundable ? "Yes" : "No") },
    { label: "Wifi", render: (r) => (r.hasWifi ? "Yes" : "—") },
    { label: "View", render: (r) => r.viewType || "—" },
    {
      label: "Amenities",
      render: (r) => (r.amenities.length ? r.amenities.slice(0, 5).join(", ") : "—"),
    },
    { label: "Price", render: (r) => formatPrice(r.price) },
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-lg text-gray-900">Compare rooms</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-x-auto overflow-y-auto flex-1 p-4">
          <table className="w-full min-w-[min(100%,520px)] text-sm">
            <thead>
              <tr>
                <th className="text-left p-2 font-medium text-gray-500 w-24 sticky left-0 bg-white z-10" />
                {cols.map((r, i) => (
                  <th key={r.id} className="p-2 text-left font-bold text-gray-900 min-w-[130px]">
                    Room {String.fromCharCode(65 + i)}
                    <span className="block text-xs font-normal text-gray-500 line-clamp-2">{r.type}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ label, render }) => (
                <tr key={label} className="border-t border-gray-100">
                  <td className="p-2 font-medium text-gray-600 sticky left-0 bg-white z-10">{label}</td>
                  {cols.map((r) => (
                    <td key={`${label}-${r.id}`} className="p-2 text-gray-800 align-top">
                      {render(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});
CompareModal.displayName = "CompareModal";

const RoomCard = memo(({
  room,
  formatPrice,
  isSelected,
  isCompare,
  onSelect,
  onReserve,
  onToggleCompare,
}: {
  room: DetailRoom;
  formatPrice: (n: number) => string;
  isSelected: boolean;
  isCompare: boolean;
  onSelect: () => void;
  onReserve: () => void;
  onToggleCompare: () => void;
}) => (
  <article
    className={`border rounded-2xl overflow-hidden transition-all flex flex-col md:flex-row ${
      isSelected
        ? "border-teal-500 ring-2 ring-teal-500/20 shadow-md"
        : "border-gray-200 hover:border-teal-300 hover:shadow-sm"
    }`}
  >
    <div className="md:w-48 lg:w-56 flex-shrink-0 aspect-[4/3] md:aspect-auto md:min-h-[180px] bg-gray-100">
      <RoomImage room={room} />
    </div>
    <div className="p-4 flex-1 flex flex-col min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-gray-900 text-base">{room.type}</h4>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-600">
            {room.size && (
              <span className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5" />{room.size}</span>
            )}
            {room.beds !== "—" && (
              <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" />{room.beds}</span>
            )}
            <span className="flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" />{room.maxGuests} guests</span>
            {room.viewType && (
              <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{room.viewType}</span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {room.discountPercent > 0 && room.originalPrice > room.price && (
            <p className="text-xs text-gray-400 line-through">{formatPrice(room.originalPrice)}</p>
          )}
          <p className="text-xl font-extrabold text-teal-700">{formatPrice(room.price)}</p>
          <p className="text-xs text-gray-500">per night</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {room.freeBreakfast && (
          <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
            <Utensils className="w-3 h-3" /> Breakfast
          </span>
        )}
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
          room.refundable
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-gray-50 text-gray-600 border-gray-200"
        }`}>
          <ShieldCheck className="w-3 h-3" />
          {room.refundable ? "Refundable" : "Non-refundable"}
        </span>
        {room.hasWifi && (
          <span className="inline-flex items-center gap-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">
            <Wifi className="w-3 h-3" /> WiFi
          </span>
        )}
        {room.discountPercent > 0 && (
          <span className="inline-flex items-center gap-0.5 text-xs bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded">
            <Percent className="w-3 h-3" /> {room.discountPercent}% off
          </span>
        )}
      </div>

      {room.amenities.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {room.amenities.map((a) => (
            <span key={a} className="text-xs text-gray-600 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full max-w-full truncate">
              {a}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 flex items-start gap-1.5 mb-3 line-clamp-2">
        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400" />
        {room.cancellationPolicy}
      </p>

      <div className="flex flex-wrap gap-2 mt-auto">
        <button
          type="button"
          onClick={onReserve}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-sm"
        >
          Reserve
        </button>
        <button
          type="button"
          onClick={onSelect}
          className={`px-4 py-2 border font-semibold rounded-lg text-sm ${
            isSelected
              ? "border-teal-600 bg-teal-50 text-teal-800"
              : "border-gray-200 hover:bg-gray-50 text-gray-800"
          }`}
        >
          {isSelected ? "Selected" : "Select room"}
        </button>
        <button
          type="button"
          onClick={onToggleCompare}
          className={`px-3 py-2 border font-semibold rounded-lg text-sm flex items-center gap-1 ${
            isCompare ? "border-teal-600 bg-teal-50 text-teal-800" : "border-gray-200 hover:bg-gray-50"
          }`}
        >
          {isCompare ? <Check className="w-3.5 h-3.5" /> : <Columns3 className="w-3.5 h-3.5" />}
          Compare
        </button>
      </div>
    </div>
  </article>
));
RoomCard.displayName = "RoomCard";

const RoomsSection = memo(({
  rooms,
  hotel,
  hotelType,
  formatPrice,
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
}: RoomsSectionProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(rooms[0]?.id ?? null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const kind = resolvePropertyKind(hotelType);
  const title = roomsSectionTitle(kind);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedId) ?? null,
    [rooms, selectedId]
  );

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }, []);

  const selectRoom = useCallback((room: DetailRoom) => {
    setSelectedId(room.id);
  }, []);

  const handleReserve = useCallback((room: DetailRoom) => {
    setSelectedId(room.id);
    setMobileDrawerOpen(true);
    onReserve();
  }, [onReserve]);

  if (!rooms.length) return null;

  return (
    <section
      id="section-rooms"
      className="rounded-2xl border border-gray-200/80 bg-gradient-to-b from-white to-slate-50/50 shadow-sm overflow-hidden"
    >
      <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BedDouble className="w-5 h-5 text-teal-600" /> {title}
        </h2>
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-500">{rooms.length} room types</span>
          {compareIds.length >= 2 && (
            <button
              type="button"
              onClick={() => setCompareModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 border border-teal-200 px-3 py-1.5 rounded-lg hover:bg-teal-50"
            >
              <Columns3 className="w-4 h-4" />
              Compare ({compareIds.length})
            </button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              formatPrice={formatPrice}
              isSelected={selectedId === room.id}
              isCompare={compareIds.includes(room.id)}
              onSelect={() => selectRoom(room)}
              onReserve={() => handleReserve(room)}
              onToggleCompare={() => toggleCompare(room.id)}
            />
          ))}
        </div>

        <div className="hidden lg:block lg:sticky lg:top-24">
          <RoomBookingPanel
            hotel={hotel}
            selectedRoom={selectedRoom}
            nativeCurrency={nativeCurrency}
            isExternal={isExternal}
            isDB={isDB}
            policies={policies}
            checkIn={checkIn}
            checkOut={checkOut}
            adultCount={adultCount}
            childCount={childCount}
            onDatesChange={onDatesChange}
            onGuestsChange={onGuestsChange}
            onReserve={onReserve}
            placement="sidebar"
          />
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between gap-3 px-4 py-3 max-w-full">
          <div className="min-w-0 flex-1">
            {selectedRoom ? (
              <>
                <p className="text-xs text-gray-500 truncate">{selectedRoom.type}</p>
                <p className="font-bold text-gray-900 text-sm">
                  {formatPrice(selectedRoom.price)}
                  <span className="font-normal text-gray-500"> / night</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-600">Select a room</p>
            )}
          </div>
          <button
            type="button"
            data-booking-drawer-trigger
            onClick={() => setMobileDrawerOpen(true)}
            className="flex-shrink-0 px-5 py-2.5 bg-teal-600 text-white font-semibold rounded-xl text-sm"
          >
            Reserve
          </button>
        </div>
      </div>

      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setMobileDrawerOpen(false)} aria-label="Close" />
          <div className="absolute bottom-0 left-0 right-0">
            <RoomBookingPanel
              hotel={hotel}
              selectedRoom={selectedRoom}
              nativeCurrency={nativeCurrency}
              isExternal={isExternal}
              isDB={isDB}
              policies={policies}
              checkIn={checkIn}
              checkOut={checkOut}
              adultCount={adultCount}
              childCount={childCount}
              onDatesChange={onDatesChange}
              onGuestsChange={onGuestsChange}
              onReserve={() => {
                setMobileDrawerOpen(false);
                onReserve();
              }}
              placement="drawer"
              onCloseDrawer={() => setMobileDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="lg:hidden h-20" aria-hidden />

      {compareModalOpen && (
        <CompareModal
          rooms={rooms}
          compareIds={compareIds}
          formatPrice={formatPrice}
          onClose={() => setCompareModalOpen(false)}
        />
      )}
    </section>
  );
});
RoomsSection.displayName = "RoomsSection";

export default RoomsSection;
