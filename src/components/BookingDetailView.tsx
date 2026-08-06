import type { ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { Booking, ProviderProfile, ProviderService } from "@/src/types/api";
import { Card, MonoLabel, Muted, Title } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import {
  bookingDurationMinutes,
  bookingStatusColor,
  bookingStatusLabel,
  formatBookingDate,
  formatBookingTime,
  formatBookingTimeRange,
} from "@/src/utils/bookingDisplay";

function matchService(
  booking: Booking,
  provider?: ProviderProfile | null,
): ProviderService | undefined {
  const serviceName = booking.serviceName?.trim();
  if (!serviceName || !provider?.services?.length) return undefined;
  return provider.services.find(
    (s) => s.name.toLowerCase() === serviceName.toLowerCase(),
  );
}

type Props = {
  booking: Booking;
  /** Customer view: provider profile. Provider view: omit and use peerLabel. */
  provider?: ProviderProfile | null;
  /** Provider view: customer display name. */
  peerLabel?: string;
  peerAvatar?: string;
  /** Optional price override when provider services are loaded separately. */
  servicePrice?: number | null;
  error?: string | null;
  actions?: ReactNode;
};

export function BookingDetailView({
  booking,
  provider,
  peerLabel,
  peerAvatar,
  servicePrice,
  error,
  actions,
}: Props) {
  const isProviderView = !provider && Boolean(peerLabel || peerAvatar !== undefined);
  const service = matchService(booking, provider);
  const duration = bookingDurationMinutes(booking, service?.durationMinutes);
  const statusColor = bookingStatusColor(booking.status);
  const avatarUri = provider?.avatar || peerAvatar;
  const displayName = provider?.name || peerLabel || "—";
  const location =
    provider?.location
      ? `${provider.location.address}, ${provider.location.city}`
      : null;
  const price =
    typeof servicePrice === "number"
      ? servicePrice
      : typeof service?.price === "number"
        ? service.price
        : null;

  return (
    <View style={styles.wrap}>
      <View style={[styles.hero, { borderColor: statusColor }]}>
        <View style={styles.heroTop}>
          <MonoLabel style={{ color: statusColor }}>
            {bookingStatusLabel(booking.status).toUpperCase()}
          </MonoLabel>
          <Text style={styles.heroDate}>{formatBookingDate(booking.startsAt)}</Text>
        </View>
        <Text style={styles.heroTime}>
          {formatBookingTime(booking.startsAt)}
          {booking.endsAt ? ` – ${formatBookingTime(booking.endsAt)}` : ""}
        </Text>
        <Title style={styles.heroService}>{booking.serviceName || "Booking"}</Title>
        <View style={styles.heroMeta}>
          {duration > 0 ? (
            <Text style={styles.heroMetaText}>{duration} min</Text>
          ) : null}
          {price != null ? (
            <Text style={styles.heroPrice}>${price}</Text>
          ) : null}
        </View>
      </View>

      <Card>
        <MonoLabel>{isProviderView ? "Customer" : "Provider"}</MonoLabel>
        <View style={styles.personRow}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarLetter}>
                {displayName.charAt(0).toUpperCase() || "?"}
              </Text>
            </View>
          )}
          <View style={styles.personText}>
            <Text style={styles.personName}>{displayName}</Text>
            {location ? <Muted>{location}</Muted> : null}
            {isProviderView ? (
              <Muted>Tap Message to chat about this visit</Muted>
            ) : provider?.slug ? (
              <Muted>@{provider.slug}</Muted>
            ) : null}
          </View>
        </View>
      </Card>

      <Card>
        <MonoLabel>Appointment</MonoLabel>
        <Text style={styles.rowLabel}>When</Text>
        <Text style={styles.rowValue}>
          {formatBookingDate(booking.startsAt)} ·{" "}
          {formatBookingTimeRange(booking.startsAt, booking.endsAt)}
        </Text>
        <Text style={styles.rowLabel}>Duration</Text>
        <Text style={styles.rowValue}>
          {duration > 0 ? `${duration} minutes` : "—"}
        </Text>
        {service?.description ? (
          <>
            <Text style={styles.rowLabel}>Notes</Text>
            <Muted>{service.description}</Muted>
          </>
        ) : null}
      </Card>

      <Card>
        <MonoLabel>Details</MonoLabel>
        <Text style={styles.rowLabel}>Booking ID</Text>
        <Text style={styles.monoValue}>{booking._id || "—"}</Text>
        <Text style={styles.rowLabel}>Booked on</Text>
        <Text style={styles.rowValue}>{formatBookingDate(booking.createdAt)}</Text>
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  hero: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    backgroundColor: colors.bg,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  heroDate: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.mono,
  },
  heroTime: {
    color: colors.text,
    fontSize: 28,
    fontFamily: fonts.serifMedium,
    marginTop: 2,
  },
  heroService: {
    fontSize: 20,
    marginTop: 4,
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  heroMetaText: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.mono,
  },
  heroPrice: {
    color: colors.accentDark,
    fontSize: 16,
    fontFamily: fonts.serifMedium,
  },
  personRow: { flexDirection: "row", gap: 12, alignItems: "center", marginTop: 8 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceAlt },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarLetter: {
    color: colors.text,
    fontSize: 20,
    fontFamily: fonts.serifMedium,
  },
  personText: { flex: 1, gap: 2 },
  personName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: fonts.serifMedium,
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 8,
    fontFamily: fonts.mono,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  rowValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  monoValue: {
    color: colors.text,
    fontSize: 13,
    fontFamily: fonts.mono,
  },
  error: { color: colors.danger, fontSize: 14 },
  actions: { gap: 8, marginTop: 4 },
});
