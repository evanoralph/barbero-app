import { apiRequest } from "@/src/api/client";
import type { LoyaltyCardView } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export function getLoyaltyCard(providerId: string) {
  logger.info("loyalty-api", "getLoyaltyCard", { providerId });
  return apiRequest<LoyaltyCardView>("/loyalty/cards", {
    auth: true,
    query: { providerId },
  });
}
