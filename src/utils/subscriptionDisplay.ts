import type { SubscriptionPayment, SubscriptionPlansResponse } from "@/src/types/api";

export type SubscriptionCurrent = SubscriptionPlansResponse["current"];

export function formatSubscriptionDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function paymentStatusLabel(status: SubscriptionPayment["status"]): string {
  return status === "completed" ? "Paid" : "Failed";
}

export function planNameForPayment(planId: SubscriptionPayment["planId"]): string {
  return planId === "premium" ? "Premium" : "Pro";
}

export function billingPeriodLabel(period: SubscriptionPayment["billingPeriod"]): string {
  return period === "yearly" ? "Yearly" : "Monthly";
}

export function totalPaidAmount(payments: SubscriptionPayment[]): number {
  return payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);
}

/** Days remaining until expiresAt; null if unknown. */
export function trialDaysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/**
 * Locked = internal planId "free" and not on an active Pro trial.
 * Free is no longer sellable; this state means subscribe to continue.
 */
export function isSubscriptionLocked(
  current: SubscriptionCurrent | null | undefined,
): boolean {
  if (!current) return true;
  return current.planId === "free" && !current.isTrialing;
}

/** Trial used up and now locked — prompt to subscribe (not a Free plan). */
export function needsProRenewal(current: SubscriptionCurrent | null | undefined): boolean {
  if (!current) return false;
  return Boolean(current.trialUsed) && isSubscriptionLocked(current);
}

export function subscriptionStatusLabel(current: SubscriptionCurrent): string {
  if (current.isTrialing) return "Pro trial";
  if (isSubscriptionLocked(current) && current.trialUsed) return "Trial ended";
  if (isSubscriptionLocked(current)) return "No plan";
  if (current.source === "paid" && current.status === "active") return "Paid";
  return current.status;
}
