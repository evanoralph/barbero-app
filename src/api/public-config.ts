import { apiRequest } from "@/src/api/client";
import { logger } from "@/src/utils/logger";

export type PublicAppConfig = {
  inviteOnly: boolean;
  paymentsEnabled: boolean;
  demoReseedAllowed: boolean;
  mailConfigured: boolean;
  privacyUrl: string;
  termsUrl: string;
  supportEmail: string;
};

export async function fetchPublicAppConfig(): Promise<PublicAppConfig | null> {
  try {
    const config = await apiRequest<PublicAppConfig>("/config/public", { auth: false });
    logger.info("config", "public app config loaded", {
      inviteOnly: config.inviteOnly,
      paymentsEnabled: config.paymentsEnabled,
    });
    return config;
  } catch (error) {
    logger.warn("config", "failed to load public app config", error);
    return null;
  }
}
