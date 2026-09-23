import { Redirect, Tabs, router } from "expo-router";
import { ArrowLeft, CalendarDays, Clock3, Home, UserRound } from "lucide-react-native";
import { Pressable } from "react-native";
import { useSession } from "@/src/auth/session";
import { e2eTabBarButton } from "@/src/components/E2eTabBarButton";
import { LoadingState } from "@/src/components/ui";
import { TabIcon } from "@/src/components/TabIcon";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

function ProviderHeaderBack() {
  return (
    <Pressable
      onPress={() => {
        logger.debug("ProviderTabs", "header back");
        console.log("[ProviderTabs] header back");
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(provider)");
        }
      }}
      hitSlop={10}
      accessibilityLabel="Go back"
      style={{ marginLeft: 4, padding: 4 }}
    >
      <ArrowLeft color={colors.text} size={22} strokeWidth={2} />
    </Pressable>
  );
}

export default function ProviderLayout() {
  const { ready, user, role } = useSession();

  if (!ready) return <LoadingState />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (role !== "provider") return <Redirect href="/(customer)" />;

  logger.debug("ProviderTabs", "mount lucide tab icons", {
    tabBarHideOnKeyboard: true,
    messagesTabHidden: true,
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
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          headerShown: true,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={Home} color={color} focused={focused} name="provider.home" />
          ),
          tabBarButton: e2eTabBarButton("tab-dashboard"),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={CalendarDays} color={color} focused={focused} name="provider.bookings" />
          ),
          tabBarButton: e2eTabBarButton("tab-bookings"),
        }}
      />
      <Tabs.Screen
        name="availability"
        options={{
          title: "Hours",
          headerShown: true,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={Clock3} color={color} focused={focused} name="provider.hours" />
          ),
          tabBarButton: e2eTabBarButton("tab-hours"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: true,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={UserRound} color={color} focused={focused} name="provider.profile" />
          ),
          tabBarButton: e2eTabBarButton("tab-profile"),
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
        name="services"
        options={{
          href: null,
          headerShown: true,
          title: "Services",
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerLeft: () => <ProviderHeaderBack />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          href: null,
          headerShown: true,
          title: "Portfolio",
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerLeft: () => <ProviderHeaderBack />,
        }}
      />
      <Tabs.Screen
        name="subscription"
        options={{
          href: null,
          headerShown: true,
          title: "Plan",
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <Tabs.Screen
        name="subscription-payments"
        options={{
          href: null,
          headerShown: true,
          title: "Billing history",
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <Tabs.Screen
        name="payout-settings"
        options={{
          href: null,
          headerShown: true,
          title: "Payout settings",
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <Tabs.Screen
        name="public-profile"
        options={{
          href: null,
          headerShown: false,
          title: "Public preview",
        }}
      />
    </Tabs>
  );
}
