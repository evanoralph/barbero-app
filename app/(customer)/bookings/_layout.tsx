import { Stack } from "expo-router";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";

export default function CustomerBookingsLayout() {
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
      <Stack.Screen name="index" options={{ title: "Bookings" }} />
      <Stack.Screen name="[id]" options={{ title: "Booking" }} />
    </Stack>
  );
}
