import { logger } from "@/src/utils/logger";

/**
 * RN6-02: Push notifications placeholder.
 * Registers a stub device token locally until Expo Notifications + backend wiring ships.
 */
export async function registerPushTokenPlaceholder(userId: string | null): Promise<string | null> {
  if (!userId) {
    logger.debug("push", "skip register — no user");
    return null;
  }
  const stub = `stub-push-${userId.slice(0, 8)}`;
  logger.info("push", "registered placeholder device token", { stub });
  return stub;
}
