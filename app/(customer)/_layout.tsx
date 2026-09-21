import { Redirect, Tabs } from "expo-router";
import { CalendarDays, Home, Search, UserRound } from "lucide-react-native";
import { useEffect } from "react";
import { useSession } from "@/src/auth/session";
import { e2eTabBarButton } from "@/src/components/E2eTabBarButton";
import { LoadingState } from "@/src/components/ui";
import { TabIcon } from "@/src/components/TabIcon";
import { useProviderOnboardingHome } from "@/src/hooks/useProviderOnboardingHome";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { logger } from "@/src/utils/logger";

const headerOptions = {
  headerShown: true as const,
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerTitleStyle: {
    fontFamily: fonts.serifMedium,
    color: colors.text,
  },
  headerShadowVisible: false,
};

export default function CustomerLayout() {
  const { ready, user, role } = useSession();
  const discoveryDisabled = useProviderOnboardingHome();

  useEffect(() => {
    if (!discoveryDisabled) return;
    logger.info("CustomerTabs", "providerOnboardingHome on — hiding Explore tab");
    console.log("[CustomerTabs] providerOnboardingHome on — hiding Explore tab");
  }, [discoveryDisabled]);

  if (!ready) return <LoadingState />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (role === "provider") return <Redirect href="/(provider)" />;

  logger.debug("CustomerTabs", "mount lucide tab icons (figma chrome)", {
    tabBarHideOnKeyboard: true,
    messagesTabHidden: true,
    discoveryDisabled,
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.bgDeep,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: fonts.mono,
          letterSpacing: 0.4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          ...headerOptions,
          // Hide the centered header title text ("Beru") - keep header buttons/icons.
          headerTitle: () => null,
          // Remove the solid background "highlight" area behind the navigation header
          // while preserving the safe-area-driven layout inside the screen.
          headerTransparent: true,
          headerStyle: { backgroundColor: "transparent" },
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={Home} color={color} focused={focused} name="customer.home" />
          ),
          tabBarButton: e2eTabBarButton("tab-home"),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Explore",
          href: discoveryDisabled ? null : undefined,
          ...headerOptions,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={Search} color={color} focused={focused} name="customer.search" />
          ),
          tabBarButton: e2eTabBarButton("tab-explore"),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={CalendarDays} color={color} focused={focused} name="customer.bookings" />
          ),
          tabBarButton: e2eTabBarButton("tab-bookings"),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={UserRound} color={color} focused={focused} name="customer.account" />
          ),
          tabBarButton: e2eTabBarButton("tab-account"),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          href: null,
          headerShown: false,
          title: "Messages",
        }}
      />
      <Tabs.Screen
        name="map"
        options={{ href: null, ...headerOptions, title: "Map" }}
      />
      <Tabs.Screen
        name="provider/[slug]"
        options={{
          href: null,
          headerShown: false,
          title: "Artist",
        }}
      />
      <Tabs.Screen
        name="book/[slug]"
        options={{
          href: null,
          headerShown: false,
          title: "Book",
          // Sticky "Request booking" bar owns the bottom chrome on this screen.
          tabBarStyle: { display: "none" },
        }}
      />
    </Tabs>
  );
}
