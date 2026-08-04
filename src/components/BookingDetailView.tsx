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
  error?: string | null;
  actions?: ReactNode;
};

export function BookingDetailView({
  booking,
  provider,
  peerLabel,
  peerAvatar,
  error,
  actions,
}: Props) {
  const service = matchService(booking, provider);
  const duration = bookingDurationMinutes(booking, service?.durationMinutes);
  const statusColor = bookingStatusColor(booking.status);
  const avatarUri = provider?.avatar || peerAvatar;
  const displayName = provider?.name || peerLabel || "—";
  const location =
    provider?.location
      ? `${provider.location.address}, ${provider.location.city}`
      : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Title style={styles.title}>{booking.serviceName || "Booking"}</Title>
        {booking.status ? (
          <View style={[styles.badge, { borderColor: statusColor }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {bookingStatusLabel(booking.status)}
            </Text>
          </View>
        ) : null}
      </View>

      <Card>
        <MonoLabel>{provider ? "Provider" : "Customer"}</MonoLabel>
        <View style={styles.personRow}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarLetter}>{displayName.charAt(0).toUpperCase() || "?"}</Text>
            </View>
          )}
          <View style={styles.personText}>
            <Text style={styles.personName}>{displayName}</Text>
            {location ? <Muted>{location}</Muted> : null}
            {!provider && booking.customerId ? (
              <Muted>Customer id: {booking.customerId}</Muted>
            ) : null}
            {provider && booking.providerId ? (
              <Muted>Provider id: {booking.providerId}</Muted>
            ) : null}
          </View>
        </View>
      </Card>

      <Card>
        <MonoLabel>Appointment</MonoLabel>
        <Text style={styles.rowLabel}>Date</Text>
        <Text style={styles.rowValue}>{formatBookingDate(booking.startsAt)}</Text>
        <Text style={styles.rowLabel}>Time</Text>
        <Text style={styles.rowValue}>
          {formatBookingTimeRange(booking.startsAt, booking.endsAt)}
        </Text>
        <Text style={styles.rowLabel}>Duration</Text>
        <Text style={styles.rowValue}>
          {duration > 0 ? `${duration} minutes` : "—"}
        </Text>
      </Card>

      <Card>
        <MonoLabel>Service</MonoLabel>
        <Text style={styles.rowValue}>{booking.serviceName || "—"}</Text>
        {service?.description ? <Muted>{service.description}</Muted> : null}
        <Text style={styles.price}>
          {typeof service?.price === "number" ? `$${service.price}` : "Price unavailable"}
        </Text>
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
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { flex: 1 },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 6,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: fonts.monoMedium,
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
  price: {
    marginTop: 8,
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    fontFamily: fonts.serifMedium,
  },
  error: { color: colors.danger, fontSize: 14 },
  actions: { gap: 8 },
});
