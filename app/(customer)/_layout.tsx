import { Redirect, Tabs } from "expo-router";
import { CalendarDays, Home, MessageCircle, Search, UserRound } from "lucide-react-native";
import { useSession } from "@/src/auth/session";
import { LoadingState } from "@/src/components/ui";
import { TabIcon } from "@/src/components/TabIcon";
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

  if (!ready) return <LoadingState />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (role === "provider") return <Redirect href="/(provider)" />;

  logger.debug("CustomerTabs", "mount lucide tab icons (figma chrome)", {
    tabBarHideOnKeyboard: true,
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
          headerTitle: "Beru",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={Home} color={color} focused={focused} name="customer.home" />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Explore",
          ...headerOptions,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={Search} color={color} focused={focused} name="customer.search" />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={CalendarDays} color={color} focused={focused} name="customer.bookings" />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={MessageCircle} color={color} focused={focused} name="customer.messages" />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={UserRound} color={color} focused={focused} name="customer.account" />
          ),
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
