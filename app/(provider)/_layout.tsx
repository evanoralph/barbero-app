import { Redirect, Tabs } from "expo-router";
import { CalendarDays, Clock3, Home, UserRound } from "lucide-react-native";
import { useSession } from "@/src/auth/session";
import { LoadingState } from "@/src/components/ui";
import { TabIcon } from "@/src/components/TabIcon";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

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
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={CalendarDays} color={color} focused={focused} name="provider.bookings" />
          ),
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
