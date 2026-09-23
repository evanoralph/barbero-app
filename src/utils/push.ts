import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { registerPushToken as apiRegisterPushToken } from "@/src/api/account";
import { logger } from "@/src/utils/logger";

/** Mirrors AppRole without importing session (avoids push ↔ session cycle). */
type NavRole = "customer" | "provider" | "admin" | "unknown";

/**
 * Thread the user is currently viewing. Foreground chat pushes for this id
 * are suppressed so they don't cover the live conversation.
 */
let activeChatThreadId: string | null = null;

export function setActiveChatThreadId(threadId: string | null): void {
  const next = threadId?.trim() || null;
  if (activeChatThreadId === next) return;
  logger.info("push", "active chat thread changed", {
    from: activeChatThreadId,
    to: next,
  });
  activeChatThreadId = next;
}

export function getActiveChatThreadId(): string | null {
  return activeChatThreadId;
}

function shouldSuppressForegroundChat(
  notification: Notifications.Notification,
): boolean {
  const active = activeChatThreadId;
  if (!active) return false;

  const payload = parsePushNavData(notification.request.content.data);
  if (!payload || payload.type !== "chat") return false;

  const notifThread = payload.threadId?.trim();
  if (!notifThread) return false;

  const suppress = notifThread === active;
  if (suppress) {
    logger.info("push", "suppress foreground chat banner — already on thread", {
      threadId: active,
      messageId: payload.messageId,
    });
  }
  return suppress;
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const suppress = shouldSuppressForegroundChat(notification);
    if (!suppress) {
      logger.debug("push", "show foreground notification", {
        title: notification.request.content.title,
        activeChatThreadId,
      });
    }
    return {
      shouldShowAlert: !suppress,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: !suppress,
      shouldShowList: !suppress,
    };
  },
});

/**
 * If a banner still appears (FCM/native path bypassing Expo handler), dismiss
 * it immediately when it matches the open chat thread.
 */
Notifications.addNotificationReceivedListener((notification) => {
  if (!shouldSuppressForegroundChat(notification)) return;
  const identifier = notification.request.identifier;
  void Notifications.dismissNotificationAsync(identifier)
    .then(() => {
      logger.info("push", "dismissed foreground chat banner", { identifier });
    })
    .catch((error) => {
      logger.debug("push", "dismiss foreground banner failed", error);
    });
});

/** Routing fields the API attaches to chat / booking / push_test notifications. */
export type PushNavPayload = {
  type: string;
  threadId?: string;
  messageId?: string;
  bookingId?: string;
  status?: string;
  /** Stable key for deduping Expo + FCM open events for the same tap. */
  dedupeKey: string;
};

export type PushNavHref =
  | `/(customer)/messages/${string}`
  | `/(provider)/messages/${string}`
  | `/(customer)/bookings/${string}`
  | `/(provider)/bookings/${string}`;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(data: Record<string, unknown>, key: string): string | undefined {
  const raw = data[key];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return undefined;
}

/**
 * Normalize Expo / FCM notification data into a routing payload.
 * FCM stringifies all data values; Expo may keep objects.
 */
export function parsePushNavData(raw: unknown): PushNavPayload | null {
  const data = asRecord(raw);
  if (!data) {
    logger.debug("push-nav", "skip parse — data missing or not an object", { raw });
    return null;
  }

  const type = readString(data, "type");
  if (!type) {
    logger.debug("push-nav", "skip parse — no type field", { keys: Object.keys(data) });
    return null;
  }

  const threadId = readString(data, "threadId");
  const messageId = readString(data, "messageId");
  const bookingId = readString(data, "bookingId");
  const status = readString(data, "status");

  const dedupeKey =
    type === "chat"
      ? `chat:${messageId ?? threadId ?? ""}`
      : type === "booking"
        ? `booking:${bookingId ?? ""}:${status ?? ""}`
        : `${type}:${readString(data, "at") ?? ""}`;

  const payload: PushNavPayload = {
    type,
    threadId,
    messageId,
    bookingId,
    status,
    dedupeKey,
  };
  logger.info("push-nav", "parsed notification data", {
    type: payload.type,
    threadId: payload.threadId,
    bookingId: payload.bookingId,
    dedupeKey: payload.dedupeKey,
  });
  return payload;
}

/**
 * Map a push payload + session role to an in-app href.
 * Returns null for push_test, unknown types, missing ids, or unsupported roles.
 */
export function resolvePushHref(
  role: NavRole,
  payload: PushNavPayload,
): PushNavHref | null {
  if (role !== "customer" && role !== "provider") {
    logger.info("push-nav", "skip resolve — unsupported role", { role, type: payload.type });
    return null;
  }

  if (payload.type === "push_test") {
    logger.info("push-nav", "skip resolve — push_test has no destination");
    return null;
  }

  if (payload.type === "chat") {
    const threadId = payload.threadId?.trim();
    if (!threadId) {
      logger.warn("push-nav", "skip resolve — chat missing threadId");
      return null;
    }
    const encoded = encodeURIComponent(threadId);
    const href =
      role === "provider"
        ? (`/(provider)/messages/${encoded}` as const)
        : (`/(customer)/messages/${encoded}` as const);
    logger.info("push-nav", "resolved chat href", { role, href });
    return href;
  }

  if (payload.type === "booking") {
    const bookingId = payload.bookingId?.trim();
    if (!bookingId) {
      logger.warn("push-nav", "skip resolve — booking missing bookingId");
      return null;
    }
    const encoded = encodeURIComponent(bookingId);
    const href =
      role === "provider"
        ? (`/(provider)/bookings/${encoded}` as const)
        : (`/(customer)/bookings/${encoded}` as const);
    logger.info("push-nav", "resolved booking href", { role, href, status: payload.status });
    return href;
  }

  logger.info("push-nav", "skip resolve — unknown type", { type: payload.type });
  return null;
}

function payloadFromExpoResponse(
  response: Notifications.NotificationResponse | null | undefined,
): PushNavPayload | null {
  if (!response) return null;
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
    logger.debug("push-nav", "skip expo response — non-default action", {
      actionIdentifier: response.actionIdentifier,
    });
    return null;
  }
  return parsePushNavData(response.notification.request.content.data);
}

/**
 * Subscribe to notification taps (Expo warm/cold + FCM open when enabled).
 * Calls onPayload for each navigable tap; caller decides when to route.
 * Returns an unsubscribe function.
 */
export function subscribePushNotificationNavigation(
  onPayload: (payload: PushNavPayload) => void,
): () => void {
  const recentKeys = new Map<string, number>();
  const DEDUPE_MS = 4000;

  const emit = (payload: PushNavPayload | null, source: string) => {
    if (!payload) return;
    const now = Date.now();
    const last = recentKeys.get(payload.dedupeKey);
    if (last != null && now - last < DEDUPE_MS) {
      logger.debug("push-nav", "skip duplicate tap", {
        source,
        dedupeKey: payload.dedupeKey,
      });
      return;
    }
    recentKeys.set(payload.dedupeKey, now);
    logger.info("push-nav", "notification tap", {
      source,
      type: payload.type,
      dedupeKey: payload.dedupeKey,
    });
    onPayload(payload);
  };

  logger.info("push-nav", "subscribing to notification taps");

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    emit(payloadFromExpoResponse(response), "expo-response");
    try {
      Notifications.clearLastNotificationResponse();
      logger.debug("push-nav", "cleared last expo notification response");
    } catch (error) {
      logger.debug("push-nav", "clearLastNotificationResponse failed", error);
    }
  });

  // Cold start: notification that launched the app.
  try {
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      emit(payloadFromExpoResponse(last), "expo-cold-start");
      try {
        Notifications.clearLastNotificationResponse();
      } catch {
        // ignore
      }
    } else {
      logger.debug("push-nav", "no last expo notification response on subscribe");
    }
  } catch (error) {
    logger.warn("push-nav", "getLastNotificationResponse failed", error);
  }

  let unsubscribeFcm: (() => void) | undefined;
  const firebaseEnabled = Boolean(
    Constants.expoConfig?.extra?.firebaseMessagingEnabled,
  );

  if (firebaseEnabled) {
    void (async () => {
      try {
        const {
          getMessaging,
          getInitialNotification,
          onNotificationOpenedApp,
        } = await import("@react-native-firebase/messaging");
        const messaging = getMessaging();

        const initial = await getInitialNotification(messaging);
        if (initial?.data) {
          emit(parsePushNavData(initial.data), "fcm-cold-start");
        } else {
          logger.debug("push-nav", "no FCM initial notification");
        }

        unsubscribeFcm = onNotificationOpenedApp(messaging, (message) => {
          emit(parsePushNavData(message.data), "fcm-opened");
        });
        logger.info("push-nav", "FCM open listeners attached");
      } catch (error) {
        logger.warn("push-nav", "FCM open listeners unavailable", error);
      }
    })();
  } else {
    logger.debug("push-nav", "Firebase messaging disabled — Expo listeners only");
  }

  return () => {
    logger.info("push-nav", "unsubscribing notification tap listeners");
    responseSub.remove();
    unsubscribeFcm?.();
  };
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  // HIGH so tray + heads-up work when app is backgrounded / killed.
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
  });
  logger.info("push", "android notification channel ready", {
    channelId: "default",
    importance: "HIGH",
  });
}

async function requestNotificationPermission(): Promise<boolean> {
  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;
  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }
  return finalStatus === "granted";
}

type DeviceTokenResult = {
  token: string;
  provider: "fcm" | "expo";
};

/**
 * Prefer native FCM via React Native Firebase when Google service files are present.
 * Falls back to Expo push token so existing builds keep working.
 */
async function obtainDeviceToken(): Promise<DeviceTokenResult | null> {
  const firebaseEnabled = Boolean(
    Constants.expoConfig?.extra?.firebaseMessagingEnabled,
  );

  if (firebaseEnabled) {
    try {
      // Lazy import so Metro does not crash when native Firebase modules are absent.
      const {
        getMessaging,
        getToken,
        requestPermission,
        registerDeviceForRemoteMessages,
        AuthorizationStatus,
      } = await import("@react-native-firebase/messaging");

      const messaging = getMessaging();

      if (Platform.OS === "ios") {
        await registerDeviceForRemoteMessages(messaging);
        logger.info("push", "iOS registered for remote messages");
      }

      const authStatus = await requestPermission(messaging);
      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;
      if (!enabled) {
        logger.info("push", "FCM permission not granted", { authStatus });
        return null;
      }

      const fcmToken = await getToken(messaging);
      if (fcmToken) {
        logger.info("push", "obtained FCM token", {
          tokenPrefix: fcmToken.slice(0, 12),
        });
        return { token: fcmToken, provider: "fcm" };
      }
      logger.warn("push", "FCM getToken returned empty — falling back to Expo");
    } catch (error) {
      logger.warn("push", "FCM unavailable — falling back to Expo push", error);
    }
  } else {
    logger.info("push", "Firebase messaging disabled in config — using Expo push");
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const expoToken = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  logger.info("push", "obtained Expo push token", {
    tokenPrefix: expoToken.data.slice(0, 12),
  });
  return { token: expoToken.data, provider: "expo" };
}

/**
 * Requests permission, obtains FCM (preferred) or Expo token, uploads to API.
 */
export async function registerPushToken(userId: string | null): Promise<string | null> {
  if (!userId) {
    logger.debug("push", "skip register — no user");
    return null;
  }

  try {
    await ensureAndroidChannel();

    const granted = await requestNotificationPermission();
    if (!granted) {
      logger.info("push", "permission not granted");
      return null;
    }

    const device = await obtainDeviceToken();
    if (!device) {
      logger.info("push", "no device token available");
      return null;
    }

    try {
      const result = await apiRegisterPushToken(device.token, device.provider);
      logger.info("push", "token uploaded to API", {
        userId: userId.slice(0, 8),
        provider: device.provider,
        tokenCount: result.tokenCount,
      });
    } catch (uploadError) {
      logger.warn("push", "token upload failed — will retry on next session", uploadError);
    }

    return device.token;
  } catch (error) {
    logger.warn("push", "register failed — falling back to no push", error);
    return null;
  }
}
