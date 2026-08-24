import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { logger } from "@/src/utils/logger";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  logger.info("push", "android notification channel ready");
}

/** Registers Expo push token when permissions are granted. */
export async function registerPushToken(userId: string | null): Promise<string | null> {
  if (!userId) {
    logger.debug("push", "skip register — no user");
    return null;
  }

  try {
    await ensureAndroidChannel();

    const permissions = await Notifications.getPermissionsAsync();
    let finalStatus = permissions.status;
    if (finalStatus !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== "granted") {
      logger.info("push", "permission not granted", { status: finalStatus });
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    logger.info("push", "registered expo push token", {
      userId: userId.slice(0, 8),
      tokenPrefix: token.data.slice(0, 12),
    });
    return token.data;
  } catch (error) {
    logger.warn("push", "register failed — falling back to no push", error);
    return null;
  }
}
