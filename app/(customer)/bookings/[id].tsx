import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { getBooking, updateBookingStatus } from "@/src/api/bookings";
import { getProvider } from "@/src/api/providers";
import { createCheckoutSession } from "@/src/api/payments";
import { ApiError } from "@/src/api/client";
import { BookingDetailView } from "@/src/components/BookingDetailView";
import {
  Button,
  ErrorState,
  LoadingState,
  Screen,
} from "@/src/components/ui";
import type { Booking, ProviderProfile } from "@/src/types/api";
import { threadIdForBooking } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export default function CustomerBookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const bookingData = await getBooking(id);
      setBooking(bookingData);
      logger.info("bookings", "detail loaded", {
        id: bookingData._id,
        providerId: bookingData.providerId,
        status: bookingData.status,
        serviceName: bookingData.serviceName,
      });

      try {
        const profile = await getProvider(bookingData.providerId);
        setProvider(profile);
        logger.info("bookings", "detail provider loaded", {
          id: profile._id,
          slug: profile.slug,
          services: profile.services.length,
        });
      } catch (providerErr) {
        setProvider(null);
        logger.warn("bookings", "detail provider load skipped", providerErr);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      logger.error("bookings", "detail load failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const cancel = async () => {
    if (!booking) return;
    setActing(true);
    setError(null);
    try {
      const updated = await updateBookingStatus(booking._id, { status: "cancelled" });
      setBooking(updated);
      logger.info("bookings", "cancelled", { id: booking._id });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Cancel failed");
      logger.error("bookings", "cancel failed", e);
    } finally {
      setActing(false);
    }
  };

  const payNow = async () => {
    if (!booking) return;
    setPaying(true);
    setError(null);
    try {
      const session = await createCheckoutSession(booking._id);
      logger.info("bookings", "checkout session created", {
        id: booking._id,
        checkoutSessionId: session.checkoutSessionId,
      });
      await WebBrowser.openBrowserAsync(session.checkoutUrl);
      // The backend confirms payment via webhook once PayMongo redirects back;
      // re-fetch so the UI reflects whatever happened while the browser was open.
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to start payment");
      logger.error("bookings", "pay now failed", e);
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !booking) return <ErrorState message={error} onRetry={load} />;
  if (!booking) return <ErrorState message="Not found" />;

  const canCancel = booking.status === "pending" || booking.status === "confirmed";
  const canMessage = booking.status !== "cancelled";
  const canPay =
    !provider?.paymentsDisabled &&
    booking.status !== "cancelled" &&
    (booking.paymentStatus === "unpaid" ||
      booking.paymentStatus === "pending" ||
      booking.paymentStatus === "failed");

  const openChat = () => {
    const threadId = threadIdForBooking(booking._id);
    logger.info("bookings", "open booking chat", { bookingId: booking._id, threadId });
    console.log("[bookings] open booking chat via params", { threadId });
    router.push({
      pathname: "/(customer)/messages/[threadId]",
      params: { threadId },
    });
  };

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load();
      }}
    >
      <BookingDetailView
        booking={booking}
        provider={provider}
        error={error}
        actions={
          <>
            {canPay ? (
              <Button
                label={booking.paymentStatus === "pending" ? "Continue payment" : "Pay now"}
                onPress={() => void payNow()}
                loading={paying}
              />
            ) : null}
            {provider?.slug ? (
              <Button
                label="View provider"
                variant="secondary"
                onPress={() => {
                  logger.info("bookings", "open provider", { slug: provider.slug });
                  router.push(`/(customer)/provider/${provider.slug}`);
                }}
              />
            ) : null}
            {canMessage ? (
              <Button label="Message about this booking" onPress={openChat} />
            ) : null}
            {canCancel ? (
              <Button
                label="Cancel booking"
                variant="danger"
                onPress={() => void cancel()}
                loading={acting}
              />
            ) : null}
          </>
        }
      />
    </Screen>
  );
}
