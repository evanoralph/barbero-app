import type { Booking, BookingPaymentStatus, BookingStatus } from "@/src/types/api";
import { colors } from "@/src/theme/colors";

export function bookingDurationMinutes(booking: Booking, serviceDuration?: number): number {
  if (typeof serviceDuration === "number" && serviceDuration > 0) return serviceDuration;
  if (!booking.startsAt || !booking.endsAt) return 0;
  const ms = new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.max(1, Math.round(ms / 60_000));
}

export function formatBookingDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatBookingTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatBookingTimeRange(startsAt?: string | null, endsAt?: string | null): string {
  return `${formatBookingTime(startsAt)} – ${formatBookingTime(endsAt)}`;
}

export function bookingStatusLabel(status: BookingStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirmed";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

/** Chat is only open while the booking is still active. Unknown status stays open. */
export function isBookingChatOpen(status?: string | null): boolean {
  const s = (status || "").trim().toLowerCase();
  if (!s) return true;
  return s === "pending" || s === "confirmed";
}

export function bookingStatusColor(status: BookingStatus): string {
  switch (status) {
    case "pending":
      return colors.warning;
    case "confirmed":
      return colors.success;
    case "completed":
      return colors.textMuted;
    case "cancelled":
      return colors.danger;
    default:
      return colors.textMuted;
  }
}

export function paymentStatusLabel(status: BookingPaymentStatus): string {
  switch (status) {
    case "unpaid":
      return "Not paid";
    case "pending":
      return "Payment processing";
    case "paid":
      return "Paid";
    case "refunded":
      return "Refunded";
    case "failed":
      return "Payment failed";
    default:
      return status;
  }
}

export function paymentStatusColor(status: BookingPaymentStatus): string {
  switch (status) {
    case "paid":
      return colors.success;
    case "pending":
      return colors.warning;
    case "failed":
      return colors.danger;
    case "refunded":
      return colors.textMuted;
    case "unpaid":
    default:
      return colors.textMuted;
  }
}

/** "Today" / "Tomorrow" / "In 4 days" for an upcoming appointment; null once it has started. */
export function startsInLabel(iso?: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime()) || start.getTime() < now) return null;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const today = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime();
  const days = Math.round((startDay - today) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}
