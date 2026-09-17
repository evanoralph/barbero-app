import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { getBooking, listBookings, updateBookingStatus } from "@/src/api/bookings";
import { getMyProvider } from "@/src/api/providers";
import {
  bookingPaymentsAvailable,
  fetchPublicAppConfig,
} from "@/src/api/public-config";
import type { Booking, BookingStatus, ProviderProfile } from "@/src/types/api";
import { threadIdForBooking } from "@/src/types/api";
import { BookingDetailView } from "@/src/components/BookingDetailView";
import {
  Button,
  ErrorState,
  LoadingState,
  Screen,
} from "@/src/components/ui";
import { logger } from "@/src/utils/logger";

export default function ProviderBookingDetail() {
  const { id, customerName: customerNameParam } = useLocalSearchParams<{
    id: string;
    customerName?: string;
  }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [detail, me, publicConfig] = await Promise.all([
        getBooking(id),
        getMyProvider().catch((e) => {
          logger.warn("provider-bookings", "detail provider soft-fail", e);
          return null;
        }),
        fetchPublicAppConfig(),
      ]);
      if (me) setProvider(me);
      setPaymentsEnabled(publicConfig?.paymentsEnabled === true);
      console.log(
        "[provider-bookings] paymentsEnabled",
        publicConfig?.paymentsEnabled === true,
      );

      let enriched = detail;
      if (!detail.customer) {
        logger.debug("provider-bookings", "detail missing customer; enriching from list", {
          id,
        });
        try {
          const list = await listBookings();
          const fromList = list.find((b) => b._id === id);
          if (fromList?.customer) {
            enriched = { ...detail, customer: fromList.customer };
            logger.debug("provider-bookings", "customer enriched from list", {
              name: fromList.customer.name,
            });
          } else if (customerNameParam) {
            enriched = {
              ...detail,
              customer: { userId: detail.customerId, name: customerNameParam },
            };
            logger.debug("provider-bookings", "customer enriched from route param", {
              customerNameParam,
            });
          }
        } catch (enrichErr) {
          logger.warn("provider-bookings", "enrich from list failed", enrichErr);
          if (customerNameParam) {
            enriched = {
              ...detail,
              customer: { userId: detail.customerId, name: customerNameParam },
            };
          }
        }
      }
      setBooking(enriched);
      logger.info("provider-bookings", "detail loaded", {
        id: enriched._id,
        status: enriched.status,
        serviceName: enriched.serviceName,
        hasCustomer: Boolean(enriched.customer),
        paymentsEnabled: publicConfig?.paymentsEnabled === true,
      });
      console.log("[provider-bookings] detail loaded", enriched._id, enriched.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      logger.error("provider-bookings", "detail load failed", e);
      console.log("[provider-bookings] detail failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, customerNameParam]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const servicePrice = useMemo(() => {
    if (!booking || !provider) return null;
    const match = provider.services.find(
      (s) => s.name.toLowerCase() === booking.serviceName.trim().toLowerCase(),
    );
    return typeof match?.price === "number" ? match.price : null;
  }, [booking, provider]);

  const setStatus = async (status: BookingStatus) => {
    if (!booking) return;
    setActing(true);
    setError(null);
    logger.debug("provider-bookings", "detail status", { id: booking._id, status });
    console.log("[provider-bookings] detail status", booking._id, status);
    try {
      const updated = await updateBookingStatus(booking._id, { status });
      setBooking({
        ...updated,
        customer: updated.customer ?? booking.customer,
      });
      logger.info("provider-bookings", "status updated", { id: booking._id, status });
      console.log("[provider-bookings] detail status ok", status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      logger.error("provider-bookings", "status update failed", e);
      console.log("[provider-bookings] detail status failed", e);
    } finally {
      setActing(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !booking) return <ErrorState message={error} onRetry={load} />;
  if (!booking) return <ErrorState message="Not found" />;

  const openChat = () => {
    const threadId = threadIdForBooking(booking._id);
    logger.info("provider-bookings", "open booking chat", {
      bookingId: booking._id,
      threadId,
    });
    console.log("[provider-bookings] detail chat", booking._id);
    router.push({
      pathname: "/(provider)/messages/[threadId]",
      params: { threadId },
    });
  };

  const customerLabel = booking.customer?.name || "Customer";
  const showPaymentUi = bookingPaymentsAvailable({
    paymentsEnabled,
    paymentsDisabled: provider?.paymentsDisabled,
  });

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        console.log("[provider-bookings] detail refresh");
        void load();
      }}
    >
      <BookingDetailView
        booking={booking}
        peerLabel={customerLabel}
        peerAvatar={booking.customer?.avatar}
        servicePrice={servicePrice}
        showPayment={showPaymentUi}
        error={error}
        actions={
          <View style={{ gap: 8 }}>
            {booking.status === "pending" ? (
              <>
                <Button
                  label="Accept booking"
                  onPress={() => void setStatus("confirmed")}
                  loading={acting}
                />
                <Button
                  label="Decline"
                  variant="secondary"
                  onPress={() => void setStatus("cancelled")}
                  loading={acting}
                />
              </>
            ) : null}
            {booking.status === "confirmed" ? (
              <Button
                label="Mark completed"
                onPress={() => void setStatus("completed")}
                loading={acting}
              />
            ) : null}
            {booking.status !== "cancelled" ? (
              <Button
                label="Message customer"
                variant="secondary"
                onPress={openChat}
              />
            ) : null}
            {booking.status === "confirmed" ? (
              <Button
                label="Cancel booking"
                variant="danger"
                onPress={() => void setStatus("cancelled")}
                loading={acting}
              />
            ) : null}
          </View>
        }
      />
    </Screen>
  );
}
