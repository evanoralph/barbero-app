import { apiRequest } from "@/src/api/client";
import type { AccountProfile } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export function getAccountMe() {
  return apiRequest<AccountProfile>("/account/me");
}

export function updateAccountMe(body: Partial<AccountProfile>) {
  logger.info("account-api", "updateAccountMe", Object.keys(body));
  return apiRequest<AccountProfile>("/account/me", { method: "PATCH", body });
}
