import type { SubscriptionPayment } from "@/src/types/api";

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
