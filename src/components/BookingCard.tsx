import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Booking } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import {
  bookingStatusColor,
  bookingStatusLabel,
  formatBookingDate,
  formatBookingTimeRange,
} from "@/src/utils/bookingDisplay";

type Props = {
  booking: Booking;
  subtitle?: string;
  onPress: () => void;
};

export function BookingCard({ booking, subtitle, onPress }: Props) {
  const statusColor = bookingStatusColor(booking.status);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.topRow}>
        <Text style={styles.service} numberOfLines={2}>
          {booking.serviceName}
        </Text>
        <View style={[styles.badge, { borderColor: statusColor }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {bookingStatusLabel(booking.status)}
          </Text>
        </View>
      </View>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
      <Text style={styles.meta}>{formatBookingDate(booking.startsAt)}</Text>
      <Text style={styles.meta}>
        {formatBookingTimeRange(booking.startsAt, booking.endsAt)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  service: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: fonts.serifMedium,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.monoMedium,
    letterSpacing: 0.3,
  },
  subtitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
