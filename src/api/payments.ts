import { apiRequest } from "@/src/api/client";
import { logger } from "@/src/utils/logger";

export type CheckoutSession = {
  checkoutUrl: string;
  checkoutSessionId: string;
};

export function createCheckoutSession(bookingId: string) {
  logger.info("payments-api", "createCheckoutSession", { bookingId });
  return apiRequest<CheckoutSession>("/payments/checkout", {
    method: "POST",
    body: { bookingId },
  });
}

export function createSubscriptionCheckoutSession(input: {
  planId: "pro" | "premium";
  billingPeriod: "monthly" | "yearly";
  client?: "web" | "mobile";
}) {
  const body = { ...input, client: input.client ?? "mobile" };
  logger.info("payments-api", "createSubscriptionCheckoutSession", body);
  return apiRequest<CheckoutSession>("/subscriptions/checkout", {
    method: "POST",
    body,
  });
}
