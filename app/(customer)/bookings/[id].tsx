import { router, useLocalSearchParams } from "expo-router";
import { MapPin, MessageCircle } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { getBooking, updateBookingStatus } from "@/src/api/bookings";
import { getProvider } from "@/src/api/providers";
import { createCheckoutSession } from "@/src/api/payments";
import {
  bookingPaymentsAvailable,
  fetchPublicAppConfig,
} from "@/src/api/public-config";
import { ApiError } from "@/src/api/client";
import { BookingDetailView } from "@/src/components/BookingDetailView";
import { AnimatedPressable } from "@/src/components/animated/AnimatedPressable";
import {
  ErrorState,
  OfflineState,
  Screen,
  Skeleton,
  StaleBadge,
} from "@/src/components/ui";
import { savedAgoLabel, updatedAgoLabel } from "@/src/offline/cache";
import { enqueue, hasQueuedCancel, removeQueued, useQueue } from "@/src/offline/queue";
import { showToast } from "@/src/offline/toast";
import { useCachedQuery } from "@/src/offline/useCachedQuery";
import { useServerStatus } from "@/src/server/server-status";
import type { Booking, ProviderProfile } from "@/src/types/api";
import { threadIdForBooking } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { formatMoney } from "@/src/utils/format";
import { logger } from "@/src/utils/logger";

type Loaded = {
  booking: Booking;
  provider: ProviderProfile | null;
  paymentsEnabled: boolean;
};

export default function CustomerBookingDetail() {
  const { id, pay } = useLocalSearchParams<{ id: string; pay?: string }>();
  const insets = useSafeAreaInsets();
  const { offline } = useServerStatus();
  const queue = useQueue();
  const [override, setOverride] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [paying, setPaying] = useState(false);
  const autoPayStartedRef = useRef(false);

  const query = useCachedQuery<Loaded>({
    key: id ? `booking:${id}` : null,
    fetcher: async () => {
      const [bookingData, publicConfig] = await Promise.all([
        getBooking(id!),
        fetchPublicAppConfig(),
      ]);
      const paymentsEnabled = publicConfig?.paymentsEnabled === true;
      logger.info("bookings", "detail loaded", {
        id: bookingData._id,
        providerId: bookingData.providerId,
        status: bookingData.status,
        paymentStatus: bookingData.paymentStatus,
        serviceName: bookingData.serviceName,
        paymentsEnabled,
      });
      let profile: ProviderProfile | null = null;
      try {
        profile = await getProvider(bookingData.providerId);
        logger.info("bookings", "detail provider loaded", {
          id: profile._id,
          slug: profile.slug,
          services: profile.services.length,
          paymentsDisabled: profile.paymentsDisabled,
        });
      } catch (providerErr) {
        logger.warn("bookings", "detail provider load skipped", providerErr);
      }
      return { booking: bookingData, provider: profile, paymentsEnabled };
    },
  });

  // A fresh fetch supersedes any locally applied result (e.g. the cancel response).
  useEffect(() => {
    setOverride(null);
  }, [query.data]);

  const booking = override ?? query.data?.booking ?? null;
  const provider = query.data?.provider ?? null;
  const paymentsEnabled = query.data?.paymentsEnabled ?? false;
  const loading = query.loading;
  const load = query.refetch;
  const queuedCancel = booking ? queue.find((q) => q.kind === "cancelBooking" && q.bookingId === booking._id) : undefined;
  const cancelQueued = booking ? hasQueuedCancel(queue, booking._id) : false;

  const queueCancel = async (b: Booking) => {
    await enqueue({
      kind: "cancelBooking",
      bookingId: b._id,
      label: `Cancel · ${b.serviceName}`,
    });
    showToast("Cancellation queued — sends when you're back online");
  };

  const cancel = async () => {
    if (!booking) return;
    setError(null);
    if (offline) {
      await queueCancel(booking);
      return;
    }
    setActing(true);
    try {
      const updated = await updateBookingStatus(booking._id, { status: "cancelled" });
      setOverride(updated);
      logger.info("bookings", "cancelled", { id: booking._id });
    } catch (e) {
      if (e instanceof ApiError && e.code === "NETWORK") {
        await queueCancel(booking);
      } else {
        setError(e instanceof ApiError ? e.message : "Cancel failed");
        logger.error("bookings", "cancel failed", e);
      }
    } finally {
      setActing(false);
    }
  };

  const payNow = useCallback(async () => {
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
  }, [booking, load]);

  // After create-booking redirect with ?pay=1, open checkout once booking is ready.
  useEffect(() => {
    if (loading || !booking || autoPayStartedRef.current) return;
    if (pay !== "1") return;

    const paymentsOn = bookingPaymentsAvailable({
      paymentsEnabled,
      paymentsDisabled: provider?.paymentsDisabled,
    });
    const canPay =
      paymentsOn &&
      booking.status !== "cancelled" &&
      (booking.paymentStatus === "unpaid" ||
        booking.paymentStatus === "pending" ||
        booking.paymentStatus === "failed");

    if (!canPay) {
      logger.debug("bookings", "auto-pay skipped", {
        id: booking._id,
        paymentStatus: booking.paymentStatus,
        status: booking.status,
        paymentsEnabled,
        paymentsDisabled: provider?.paymentsDisabled,
      });
      console.log("[bookings] auto-pay skipped", booking._id, booking.paymentStatus);
      // Clear pay query so refresh does not keep evaluating it.
      router.replace(`/(customer)/bookings/${booking._id}`);
      return;
    }

    autoPayStartedRef.current = true;
    logger.info("bookings", "auto-pay starting after create redirect", {
      id: booking._id,
      paymentStatus: booking.paymentStatus,
    });
    console.log("[bookings] auto-pay starting", booking._id);
    // Drop pay=1 so pull-to-refresh / remount does not re-open checkout.
    router.replace(`/(customer)/bookings/${booking._id}`);
    void payNow();
  }, [loading, booking, provider, paymentsEnabled, pay, payNow]);

  if (loading) {
    return (
      <Screen contentStyle={{ gap: 14 }}>
        <Skeleton style={{ height: 170, borderRadius: 16 }} />
        <Skeleton style={{ height: 96 }} />
        <Skeleton style={{ height: 64 }} />
        <Skeleton style={{ height: 64 }} />
      </Screen>
    );
  }
  if (query.error && !booking) {
    return query.offline ? (
      <OfflineState onRetry={load} body="This booking isn't saved on this device yet." />
    ) : (
      <ErrorState message={query.error} onRetry={load} />
    );
  }
  if (!booking) return <ErrorState message="Not found" />;

  const canCancel = booking.status === "pending" || booking.status === "confirmed";
  const canMessage = booking.status === "pending" || booking.status === "confirmed";
  const showPaymentUi = bookingPaymentsAvailable({
    paymentsEnabled,
    paymentsDisabled: provider?.paymentsDisabled,
  });
  const canPay =
    showPaymentUi &&
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

  const dueAmount =
    typeof booking.amount === "number" && booking.amount > 0
      ? booking.amount
      : provider?.services.find(
          (svc) => svc.name.toLowerCase() === booking.serviceName?.trim().toLowerCase(),
        )?.price ?? null;
  const payHeld = offline || query.offline;
  const location = provider?.location;

  const openDirections = () => {
    if (!location) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
    logger.info("bookings", "open directions", { id: booking._id });
    void Linking.openURL(url).catch((e) => logger.warn("bookings", "directions failed", e));
  };

  return (
    <View style={styles.root}>
      <Screen
        scroll
        refreshing={query.refreshing}
        onRefresh={query.refresh}
        contentStyle={{ paddingBottom: canPay ? 24 : 40 }}
      >
        <View style={styles.statusRow}>
          {query.stale ? (
            <StaleBadge label={savedAgoLabel(query.savedAt)} />
          ) : query.savedAt ? (
            <Text style={styles.updated}>{updatedAgoLabel(query.savedAt)}</Text>
          ) : null}
        </View>
        <BookingDetailView
          booking={booking}
          provider={provider}
          showPayment={showPaymentUi}
          error={error}
          cancelQueued={cancelQueued}
          onUndoCancel={queuedCancel ? () => void removeQueued(queuedCancel.id) : undefined}
          paymentHeld={payHeld}
          onOpenProvider={
            provider?.slug
              ? () => {
                  logger.info("bookings", "open provider", { slug: provider.slug });
                  router.push(`/(customer)/provider/${provider.slug}`);
                }
              : undefined
          }
          actions={
            <>
              {canMessage ? (
                <AnimatedPressable style={styles.actionBtn} onPress={openChat} accessibilityLabel="Message">
                  <MessageCircle size={16} color={colors.text} />
                  <Text style={styles.actionText}>Message</Text>
                </AnimatedPressable>
              ) : null}
              {location ? (
                <AnimatedPressable
                  style={styles.actionBtn}
                  onPress={openDirections}
                  accessibilityLabel="Directions"
                >
                  <MapPin size={16} color={colors.text} />
                  <Text style={styles.actionText}>Directions</Text>
                </AnimatedPressable>
              ) : null}
            </>
          }
          footerAction={
            canCancel && !cancelQueued ? (
              <AnimatedPressable
                onPress={() => void cancel()}
                disabled={acting}
                hitSlop={8}
                accessibilityLabel="Cancel booking"
              >
                <Text style={styles.cancelLink}>{acting ? "Cancelling…" : "Cancel booking"}</Text>
              </AnimatedPressable>
            ) : null
          }
        />
      </Screen>

      {canPay ? (
        <View style={[styles.payBar, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <View style={styles.payInfo}>
            {payHeld ? (
              <Text style={styles.payHint}>Payment resumes when you reconnect</Text>
            ) : (
              <>
                <Text style={styles.payLabel}>Amount due</Text>
                {dueAmount != null ? (
                  <Text style={styles.payAmount}>{formatMoney(dueAmount, booking.currency || "PHP")}</Text>
                ) : null}
              </>
            )}
          </View>
          <AnimatedPressable
            style={[styles.payBtn, (payHeld || paying) && styles.payBtnHeld]}
            onPress={() => void payNow()}
            disabled={payHeld || paying}
            accessibilityRole="button"
            accessibilityLabel={booking.paymentStatus === "pending" ? "Continue payment" : "Pay now"}
          >
            <Text style={styles.payBtnText}>
              {paying ? "Opening…" : booking.paymentStatus === "pending" ? "Continue payment" : "Pay now"}
            </Text>
          </AnimatedPressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  statusRow: { flexDirection: "row", justifyContent: "flex-end", minHeight: 4 },
  updated: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.mono },
  actionBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  actionText: { color: colors.text, fontSize: 14, fontFamily: fonts.monoMedium },
  cancelLink: {
    color: colors.danger,
    fontSize: 13,
    fontFamily: fonts.mono,
    textDecorationLine: "underline",
  },
  payBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  payInfo: { flex: 1, minWidth: 0 },
  payLabel: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.mono },
  payAmount: { color: colors.text, fontSize: 17, fontFamily: fonts.serifMedium },
  payHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16, fontFamily: fonts.mono },
  payBtn: {
    minHeight: 48,
    paddingHorizontal: 26,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  payBtnHeld: { opacity: 0.5 },
  payBtnText: { color: colors.text, fontSize: 15, fontFamily: fonts.monoMedium },
});
