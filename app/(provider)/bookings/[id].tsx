import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { getBooking, listBookings, updateBookingStatus } from "@/src/api/bookings";
import type { Booking, BookingStatus } from "@/src/types/api";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const detail = await getBooking(id);
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
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      logger.error("provider-bookings", "detail load failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, customerNameParam]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const setStatus = async (status: BookingStatus) => {
    if (!booking) return;
    setActing(true);
    setError(null);
    try {
      const updated = await updateBookingStatus(booking._id, { status });
      setBooking({
        ...updated,
        customer: updated.customer ?? booking.customer,
      });
      logger.info("provider-bookings", "status updated", { id: booking._id, status });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      logger.error("provider-bookings", "status update failed", e);
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
    router.push(`/(provider)/messages/${encodeURIComponent(threadId)}`);
  };

  const customerLabel = booking.customer?.name || booking.customerId;

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
        peerLabel={customerLabel}
        peerAvatar={booking.customer?.avatar}
        error={error}
        actions={
          <>
            {booking.status !== "cancelled" ? (
              <Button label="Message about this booking" onPress={openChat} />
            ) : null}
            {booking.status === "pending" ? (
              <Button
                label="Confirm"
                onPress={() => void setStatus("confirmed")}
                loading={acting}
              />
            ) : null}
            {booking.status === "confirmed" ? (
              <Button
                label="Mark completed"
                onPress={() => void setStatus("completed")}
                loading={acting}
              />
            ) : null}
            {booking.status === "pending" || booking.status === "confirmed" ? (
              <Button
                label="Cancel"
                variant="danger"
                onPress={() => void setStatus("cancelled")}
                loading={acting}
              />
            ) : null}
          </>
        }
      />
    </Screen>
  );
}
