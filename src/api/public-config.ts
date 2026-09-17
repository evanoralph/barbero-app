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

/** True when platform online payments are on and this provider allows booking checkout. */
export function bookingPaymentsAvailable(opts: {
  paymentsEnabled: boolean;
  paymentsDisabled?: boolean | null;
}): boolean {
  const available = opts.paymentsEnabled === true && opts.paymentsDisabled !== true;
  logger.debug("payments", "bookingPaymentsAvailable", {
    paymentsEnabled: opts.paymentsEnabled,
    paymentsDisabled: opts.paymentsDisabled,
    available,
  });
  console.log("[payments] bookingPaymentsAvailable", {
    paymentsEnabled: opts.paymentsEnabled,
    paymentsDisabled: opts.paymentsDisabled,
    available,
  });
  return available;
}

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
