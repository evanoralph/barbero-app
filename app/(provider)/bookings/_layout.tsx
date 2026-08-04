import { Stack } from "expo-router";
import { colors } from "@/src/theme/colors";

export default function ProviderBookingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Bookings" }} />
      <Stack.Screen name="[id]" options={{ title: "Booking" }} />
    </Stack>
  );
}
