import { Stack, useNavigation, usePathname } from "expo-router";
import { useLayoutEffect } from "react";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

const TAB_BAR_HIDDEN = { display: "none" as const };
const TAB_BAR_VISIBLE = {
  backgroundColor: colors.bgDeep,
  borderTopColor: colors.border,
  borderTopWidth: 1,
};

/**
 * Hide the provider tab bar while a thread is open so KeyboardStickyView
 * can pin the composer to the true bottom (above the keyboard).
 * Layout-level setOptions hits the Tabs parent reliably (Root Stack → Tabs → Stack).
 */
export default function ProviderMessagesLayout() {
  const navigation = useNavigation();
  const pathname = usePathname();
  const onThread = /\/messages\/[^/]+/.test(pathname);

  useLayoutEffect(() => {
    // In Expo Router, this layout's navigation is the "messages" tab screen —
    // setOptions here updates tabBarStyle. Fall back to parent if nested deeper.
    const tabsNav = navigation.getParent?.() ?? navigation;
    const apply = (style: typeof TAB_BAR_HIDDEN | typeof TAB_BAR_VISIBLE) => {
      navigation.setOptions({ tabBarStyle: style });
      tabsNav?.setOptions?.({ tabBarStyle: style });
    };
    console.log("[provider-messages-layout] tab bar", {
      pathname,
      onThread,
      hasParent: Boolean(navigation.getParent?.()),
    });
    logger.debug("provider-messages-layout", "tab bar for keyboard", {
      pathname,
      onThread,
    });
    apply(onThread ? TAB_BAR_HIDDEN : TAB_BAR_VISIBLE);
    return () => {
      console.log("[provider-messages-layout] restore tab bar on leave", { pathname });
      logger.debug("provider-messages-layout", "restore tab bar on leave", { pathname });
      apply(TAB_BAR_VISIBLE);
    };
  }, [navigation, onThread, pathname]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: "Inbox" }} />
      <Stack.Screen name="[threadId]" options={{ headerShown: false, title: "Chat" }} />
    </Stack>
  );
}
