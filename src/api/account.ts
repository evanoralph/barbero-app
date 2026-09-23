import { apiRequest } from "@/src/api/client";
import type { AccountProfile } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export type UpdateAccountMeBody = {
  name?: string;
  phone?: string;
  avatar?: string;
  address?: string;
  city?: string;
  bio?: string;
  notificationPreferences?: Partial<AccountProfile["notificationPreferences"]>;
};

export function getAccountMe() {
  return apiRequest<AccountProfile>("/account/me");
}

export function updateAccountMe(body: UpdateAccountMeBody) {
  logger.info("account-api", "updateAccountMe", Object.keys(body));
  return apiRequest<AccountProfile>("/account/me", { method: "PATCH", body });
}

export function registerPushToken(token: string, provider: "fcm" | "expo" = "fcm") {
  logger.info("account-api", "registerPushToken", {
    provider,
    tokenPrefix: token.slice(0, 12),
  });
  return apiRequest<{ registered: true; tokenCount: number }>("/account/push-token", {
    method: "POST",
    body: { token, provider },
  });
}

export type PushTestResult = {
  fcmConfigured: boolean;
  fcmTokenCount: number;
  expoTokenCount: number;
  fcm: {
    sent: number;
    failed: number;
    errors: Array<{ code?: string; message: string }>;
  };
  expo: { sent: number; failed: number };
  delivered: boolean;
  hint: string;
};

/** Ask the API to send a diagnostic push to this account's registered devices. */
export function sendPushTest() {
  logger.info("account-api", "sendPushTest");
  return apiRequest<PushTestResult>("/account/push-test", { method: "POST" });
}
