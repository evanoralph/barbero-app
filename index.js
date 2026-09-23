/**
 * Custom entry so FCM background handling is registered before Expo Router boots.
 * Must be synchronous — async registration can miss quit-state messages.
 */
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Constants = require("expo-constants").default;
  const firebaseEnabled = Boolean(
    Constants?.expoConfig?.extra?.firebaseMessagingEnabled,
  );
  console.log("[push-bg] entry boot", { firebaseEnabled });

  if (firebaseEnabled) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const messagingMod = require("@react-native-firebase/messaging");
    const messaging = messagingMod.getMessaging();
    messagingMod.setBackgroundMessageHandler(messaging, async (remoteMessage) => {
      console.log("[push-bg] background/quit message received", {
        messageId: remoteMessage?.messageId,
        hasNotification: Boolean(remoteMessage?.notification),
        dataKeys: remoteMessage?.data ? Object.keys(remoteMessage.data) : [],
      });
    });
    console.log("[push-bg] FCM background message handler registered");
  } else {
    console.log("[push-bg] skip — Firebase messaging disabled in config");
  }
} catch (error) {
  console.warn("[push-bg] entry failed to register background handler", error);
}

require("expo-router/entry");
