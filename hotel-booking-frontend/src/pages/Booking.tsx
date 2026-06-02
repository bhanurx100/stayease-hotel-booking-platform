import { useQuery } from "react-query";
import * as apiClient from "../api-client";
import BookingForm from "../forms/BookingForm/BookingForm";
import useSearchContext from "../hooks/useSearchContext";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo } from "react";
import BookingDetailsSummary from "../components/BookingDetailsSummary";
import { Elements } from "@stripe/react-stripe-js";
import useAppContext from "../hooks/useAppContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Loader2, CreditCard, Calendar, Users, AlertCircle } from "lucide-react";

const Booking = () => {
  const { stripePromise, isLoggedIn } = useAppContext();
  const search = useSearchContext();
  const { hotelId } = useParams();
  const navigate = useNavigate();

  const numberOfNights = useMemo(() => {
    if (!search.checkIn || !search.checkOut) return 1;
    const nights =
      Math.abs(search.checkOut.getTime() - search.checkIn.getTime()) /
      (1000 * 60 * 60 * 24);
    return Math.max(1, Math.ceil(nights));
  }, [search.checkIn, search.checkOut]);

  useEffect(() => {
    if (!isLoggedIn && hotelId) {
      navigate("/sign-in", {
        state: { from: { pathname: `/hotel/${hotelId}/booking` } },
      });
    }
  }, [isLoggedIn, hotelId, navigate]);

  const {
    data: paymentIntentData,
    isLoading: isLoadingPayment,
    error: paymentError,
    refetch: refetchPayment,
  } = useQuery(
    ["createPaymentIntent", hotelId, numberOfNights],
    () =>
      apiClient.createPaymentIntent(
        hotelId as string,
        numberOfNights.toString()
      ),
    {
      enabled: !!hotelId && numberOfNights > 0 && isLoggedIn,
      retry: 1,
    }
  );

  const { data: hotel, isLoading: isLoadingHotel } = useQuery(
    ["fetchHotelByID", hotelId],
    () => apiClient.fetchHotelById(hotelId as string),
    { enabled: !!hotelId }
  );

  const { data: currentUser, isLoading: isLoadingUser } = useQuery(
    "fetchCurrentUser",
    apiClient.fetchCurrentUser,
    { enabled: isLoggedIn }
  );

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (isLoadingHotel || isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          <span className="text-lg font-medium text-gray-700">
            Loading booking details...
          </span>
        </div>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">
            Hotel Not Found
          </h2>
          <p className="text-gray-600 mb-4">
            The hotel you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link to="/search">
            <Button variant="outline">Back to Search</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isDemo = paymentIntentData?.demoMode === true;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <CreditCard className="h-6 w-6 text-teal-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Complete Your Booking
            </h1>
          </div>
          <p className="text-gray-600">
            Review your stay details and {isDemo ? "confirm with the demo card" : "complete payment"}.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_2fr] gap-8">
          <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-white">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Calendar className="h-5 w-5 text-teal-600" />
                  Booking Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BookingDetailsSummary
                  checkIn={search.checkIn}
                  checkOut={search.checkOut}
                  adultCount={search.adultCount}
                  childCount={search.childCount}
                  numberOfNights={numberOfNights}
                  hotel={hotel}
                />
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Users className="h-5 w-5 text-teal-600" />
                  Hotel Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <h3 className="font-semibold text-gray-900">{hotel.name}</h3>
                <p className="text-gray-600 text-sm">
                  {hotel.city}, {hotel.country}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{hotel.starRating} Stars</Badge>
                  <Badge variant="outline">
                    ₹{hotel.pricePerNight}/night
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {isLoadingPayment ? (
              <Card className="shadow-lg border-0 bg-white">
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600 mr-2" />
                  <span className="text-gray-700">Preparing checkout...</span>
                </CardContent>
              </Card>
            ) : paymentError ? (
              <Card className="shadow-lg border-0 bg-white">
                <CardContent className="py-10 text-center">
                  <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
                  <p className="text-gray-800 font-medium mb-2">
                    Could not start checkout
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    {(paymentError as Error)?.message ?? "Please try again."}
                  </p>
                  <Button onClick={() => refetchPayment()} className="bg-teal-600">
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : currentUser && paymentIntentData ? (
              <Card className="shadow-lg border-0 bg-white">
                <CardContent className="p-0">
                  {isDemo ? (
                    <BookingForm
                      currentUser={currentUser}
                      paymentIntent={paymentIntentData}
                      hotel={hotel}
                      demoMode
                    />
                  ) : (
                    <Elements
                      stripe={stripePromise}
                      options={{ clientSecret: paymentIntentData.clientSecret }}
                      key={paymentIntentData.clientSecret}
                    >
                      <BookingForm
                        currentUser={currentUser}
                        paymentIntent={paymentIntentData}
                        hotel={hotel}
                      />
                    </Elements>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-lg border-0 bg-white">
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Booking;
