import { apiRequest } from "@/src/api/client";
import type { SubscriptionPlansResponse } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export async function getMySubscription() {
  logger.debug("subscription-api", "getMySubscription");
  const data = await apiRequest<SubscriptionPlansResponse>("/providers/me/subscription");
  logger.debug("subscription-api", "getMySubscription ok", {
    hasCurrent: Boolean(data && typeof data === "object" && "current" in data && data.current),
    planCount: Array.isArray(data?.plans) ? data.plans.length : 0,
  });
  return data;
}

export function updateMySubscription(input: {
  planId: "free" | "pro" | "premium";
  billingPeriod: "monthly" | "yearly";
}) {
  logger.info("subscription-api", "updateMySubscription", input);
  return apiRequest<{
    profile: unknown;
    subscription: SubscriptionPlansResponse["current"];
  }>("/providers/me/subscription", {
    method: "POST",
    body: input,
  });
}
