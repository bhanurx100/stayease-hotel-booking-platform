import { Link, useLocation, Navigate } from "react-router-dom";
import { CheckCircle, Calendar, MapPin, CreditCard } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useCurrency } from "../features/currency/CurrencyContext";
import { adultsLabel, childrenLabel } from "../lib/guest-labels";

type SuccessState = {
  hotelName?: string;
  city?: string;
  checkIn?: string;
  checkOut?: string;
  totalCost?: number;
  bookingId?: string;
  adultCount?: number;
  childCount?: number;
};

const BookingSuccess = () => {
  const { formatPrice } = useCurrency();
  const location = useLocation();
  const state = (location.state ?? {}) as SuccessState;

  if (!state.bookingId && !state.hotelName) {
    return <Navigate to="/my-bookings" replace />;
  }

  const checkIn  = state.checkIn  ? new Date(state.checkIn)  : null;
  const checkOut = state.checkOut ? new Date(state.checkOut) : null;
  const nights   =
    checkIn && checkOut
      ? Math.max(
          1,
          Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
        )
      : 1;

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12 bg-gradient-to-br from-teal-50 to-emerald-50">
      <Card className="max-w-lg w-full shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Booking Confirmed!
          </CardTitle>
          <p className="text-gray-500 text-sm mt-2">
            Your reservation has been saved. You can view it anytime in My Bookings.
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-900">{state.hotelName}</p>
                {state.city && <p className="text-gray-500">{state.city}</p>}
              </div>
            </div>

            {checkIn && checkOut && (
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-700">
                    {fmt(checkIn)} → {fmt(checkOut)}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {nights} night{nights > 1 ? "s" : ""}
                    {(state.adultCount ?? 0) > 0 &&
                      ` · ${adultsLabel(state.adultCount!)}`}
                    {(state.childCount ?? 0) > 0 &&
                      ` · ${childrenLabel(state.childCount!)}`}
                  </p>
                </div>
              </div>
            )}

            {state.totalCost != null && state.totalCost > 0 && (
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-teal-600" />
                <span className="font-semibold text-gray-900">
                  {formatPrice(Number(state.totalCost), "INR")} total
                </span>
                <span className="text-xs text-gray-400">(demo payment)</span>
              </div>
            )}

            {state.bookingId && (
              <p className="text-xs text-gray-400 pt-1 border-t border-gray-200">
                Confirmation ID: {state.bookingId}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/my-bookings" className="flex-1">
              <Button className="w-full bg-teal-600 hover:bg-teal-700">
                View My Bookings
              </Button>
            </Link>
            <Link to="/search" className="flex-1">
              <Button variant="outline" className="w-full">
                Browse More Hotels
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingSuccess;
