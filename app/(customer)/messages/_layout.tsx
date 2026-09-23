import { Stack, useNavigation, usePathname } from "expo-router";
import { useLayoutEffect } from "react";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { logger } from "@/src/utils/logger";

const TAB_BAR_HIDDEN = { display: "none" as const };
const TAB_BAR_VISIBLE = {
  backgroundColor: colors.bgDeep,
  borderTopColor: colors.border,
  borderTopWidth: 1,
  height: 64,
  paddingTop: 6,
  paddingBottom: 8,
};

/**
 * Hide the customer tab bar while a thread is open so KeyboardStickyView
 * can pin the composer to the true bottom (above the keyboard).
 */
export default function CustomerMessagesLayout() {
  const navigation = useNavigation();
  const pathname = usePathname();
  const onThread = /\/messages\/[^/]+/.test(pathname);

  useLayoutEffect(() => {
    const tabsNav = navigation.getParent?.() ?? navigation;
    const apply = (style: typeof TAB_BAR_HIDDEN | typeof TAB_BAR_VISIBLE) => {
      navigation.setOptions({ tabBarStyle: style });
      tabsNav?.setOptions?.({ tabBarStyle: style });
    };
    console.log("[customer-messages-layout] tab bar", {
      pathname,
      onThread,
      hasParent: Boolean(navigation.getParent?.()),
    });
    logger.debug("customer-messages-layout", "tab bar for keyboard", {
      pathname,
      onThread,
    });
    apply(onThread ? TAB_BAR_HIDDEN : TAB_BAR_VISIBLE);
    return () => {
      console.log("[customer-messages-layout] restore tab bar on leave", { pathname });
      logger.debug("customer-messages-layout", "restore tab bar on leave", { pathname });
      apply(TAB_BAR_VISIBLE);
    };
  }, [navigation, onThread, pathname]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.serifMedium, color: colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: "Messages" }} />
      <Stack.Screen name="[threadId]" options={{ headerShown: false, title: "Chat" }} />
    </Stack>
  );
}
