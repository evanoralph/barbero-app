import { apiRequest } from "@/src/api/client";
import { logger } from "@/src/utils/logger";

export function listFavoriteIds() {
  return apiRequest<{ providerIds: string[] }>("/account/favorites");
}

export function addFavorite(providerId: string) {
  logger.info("favorites-api", "addFavorite", { providerId });
  return apiRequest<{ providerIds: string[] }>("/account/favorites", {
    method: "POST",
    body: { providerId },
  });
}

export function removeFavorite(providerId: string) {
  logger.info("favorites-api", "removeFavorite", { providerId });
  return apiRequest<{ providerIds: string[] }>(
    `/account/favorites/${encodeURIComponent(providerId)}`,
    { method: "DELETE" },
  );
}
