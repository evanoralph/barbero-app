import { formatMoney } from '@/src/utils/format';
import type { ReactNode } from "react";
import { ChevronRight, Clock } from "lucide-react-native";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
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
  paymentStatusColor,
  paymentStatusLabel,
  startsInLabel,
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
  /** When false, hide Payment status card (online booking payments unavailable). */
  showPayment?: boolean;
  error?: string | null;
  actions?: ReactNode;
  /** Customer view: tapping the provider card opens the profile. */
  onOpenProvider?: () => void;
  /** Customer view: a cancel is waiting to send — hero switches to "Cancelling…". */
  cancelQueued?: boolean;
  onUndoCancel?: () => void;
  /** Customer view: payment can't be started right now (offline); card is dimmed. */
  paymentHeld?: boolean;
  /** Customer view: right-hand side of the ID footer line (quiet Cancel link). */
  footerAction?: ReactNode;
};

export function BookingDetailView({
  booking,
  provider,
  peerLabel,
  peerAvatar,
  servicePrice,
  showPayment = true,
  error,
  actions,
  onOpenProvider,
  cancelQueued,
  onUndoCancel,
  paymentHeld,
  footerAction,
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
    typeof booking.amount === "number" && booking.amount > 0
      ? booking.amount
      : typeof servicePrice === "number"
        ? servicePrice
        : typeof service?.price === "number"
          ? service.price
          : null;

  if (!showPayment) {
    console.log("[BookingDetailView] payment card hidden", booking._id);
  }

  if (!isProviderView) {
    const heroColor = cancelQueued ? colors.warning : statusColor;
    const heroLabel = cancelQueued ? "Cancelling…" : bookingStatusLabel(booking.status);
    const startsIn = cancelQueued || booking.status === "cancelled" ? null : startsInLabel(booking.startsAt);
    const notes = booking.notes?.trim();
    if (notes) {
      console.log("[BookingDetailView] showing customer notes", {
        bookingId: booking._id,
        notesLength: notes.length,
      });
    }
    return (
      <View style={styles.wrap}>
        <View style={[styles.hero, { borderColor: heroColor }]}>
          <View style={styles.heroTop}>
            <MonoLabel style={{ color: heroColor }}>{heroLabel.toUpperCase()}</MonoLabel>
            <Text style={styles.heroDate}>{formatBookingDate(booking.startsAt)}</Text>
          </View>
          <Text style={styles.heroTime}>
            {formatBookingTime(booking.startsAt)}
            {booking.endsAt ? ` – ${formatBookingTime(booking.endsAt)}` : ""}
          </Text>
          <Title style={styles.heroService}>{booking.serviceName || "Booking"}</Title>
          <View style={styles.heroMeta}>
            {duration > 0 ? <Text style={styles.heroMetaText}>{duration} min</Text> : null}
            {price != null ? <Text style={styles.heroPrice}>{formatMoney(price, booking.currency || "PHP")}</Text> : null}
            {startsIn ? (
              <View style={styles.inPill}>
                <Clock size={12} color={colors.accentDark} />
                <Text style={styles.inPillText}>{startsIn}</Text>
              </View>
            ) : null}
          </View>
          {cancelQueued ? (
            <View style={styles.queuedNote}>
              <Clock size={13} color={colors.warning} />
              <Text style={styles.queuedText}>
                Cancellation queued — {displayName.split(" ")[0]} is told as soon as you reconnect
              </Text>
              {onUndoCancel ? (
                <Pressable hitSlop={8} onPress={onUndoCancel}>
                  <Text style={styles.undo}>Undo</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        <Pressable
          disabled={!onOpenProvider}
          onPress={onOpenProvider}
          accessibilityRole={onOpenProvider ? "button" : undefined}
        >
          <Card>
            <MonoLabel>Provider</MonoLabel>
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
                {provider?.slug ? <Muted>@{provider.slug}</Muted> : null}
              </View>
              {onOpenProvider ? <ChevronRight size={18} color={colors.textMuted} /> : null}
            </View>
          </Card>
        </Pressable>

        {notes ? (
          <Card>
            <MonoLabel>Notes</MonoLabel>
            <Muted style={{ marginTop: 6 }}>{notes}</Muted>
          </Card>
        ) : null}

        {showPayment && booking.paymentStatus ? (
          <View style={paymentHeld ? styles.held : undefined}>
            <Card>
              <MonoLabel>Payment</MonoLabel>
              <View style={styles.paymentLine}>
                <Text style={[styles.rowValue, { color: paymentStatusColor(booking.paymentStatus) }]}>
                  {paymentStatusLabel(booking.paymentStatus)}
                </Text>
                {price != null && booking.paymentStatus !== "paid" ? (
                  <Text style={styles.rowValue}>{`· ${formatMoney(price, booking.currency || "PHP")} due`}</Text>
                ) : null}
              </View>
              <Text style={styles.paymentHint}>
                {paymentHeld
                  ? "Online payment needs a connection"
                  : booking.paymentStatus === "paid"
                    ? "Paid online"
                    : "Pay online or settle at the shop"}
              </Text>
            </Card>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {actions ? <View style={styles.actionsRow}>{actions}</View> : null}

        <View style={styles.footerLine}>
          <Text style={styles.footerId} numberOfLines={1}>
            ID {booking._id} · booked {formatBookingDate(booking.createdAt)}
          </Text>
          {footerAction}
        </View>
      </View>
    );
  }

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
            <Text style={styles.heroPrice}>
              {booking.currency || "PHP"} {price}
            </Text>
          ) : null}
        </View>
      </View>

      <Card>
        <MonoLabel>Customer</MonoLabel>
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
            <Muted>Tap Message to chat about this visit</Muted>
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
            <Text style={styles.rowLabel}>Service</Text>
            <Muted>{service.description}</Muted>
          </>
        ) : null}
        {booking.notes?.trim() ? (
          <>
            <Text style={styles.rowLabel}>Notes</Text>
            <Muted>{booking.notes.trim()}</Muted>
          </>
        ) : null}
      </Card>

      {showPayment && booking.paymentStatus ? (
        <Card>
          <MonoLabel>Payment</MonoLabel>
          <View style={styles.personRow}>
            <Text
              style={[styles.rowValue, { color: paymentStatusColor(booking.paymentStatus) }]}
            >
              {paymentStatusLabel(booking.paymentStatus)}
            </Text>
            {price != null ? (
              <Text style={styles.rowValue}>
                {"  ·  "}
                {formatMoney(price, booking.currency || "PHP")}
              </Text>
            ) : null}
          </View>
        </Card>
      ) : null}

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
  inPill: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(201, 151, 58, 0.16)",
  },
  inPillText: { color: colors.accentDark, fontSize: 11, fontFamily: fonts.monoMedium },
  queuedNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  queuedText: { flex: 1, color: colors.textMuted, fontSize: 11, lineHeight: 16, fontFamily: fonts.mono },
  undo: { color: colors.accentDark, fontSize: 11, fontFamily: fonts.monoMedium },
  held: { opacity: 0.55 },
  paymentLine: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 8 },
  paymentHint: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.mono, marginTop: 4 },
  actionsRow: { flexDirection: "row", gap: 10 },
  footerLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 2,
  },
  footerId: { flex: 1, color: colors.textMuted, fontSize: 11, fontFamily: fonts.mono },
});
