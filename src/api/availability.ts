import { apiRequest } from "@/src/api/client";
import type { ProviderAvailability } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export function getMyAvailability() {
  return apiRequest<ProviderAvailability>("/providers/me/availability");
}

export function saveMyAvailability(body: {
  weekly: ProviderAvailability["weekly"];
  overrides: ProviderAvailability["overrides"];
}) {
  logger.info("availability-api", "saveMyAvailability");
  return apiRequest<ProviderAvailability>("/providers/me/availability", {
    method: "PUT",
    body,
  });
}
