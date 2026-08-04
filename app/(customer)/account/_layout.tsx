import { Stack } from "expo-router";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";

export default function CustomerAccountLayout() {
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
      <Stack.Screen name="index" options={{ title: "Account" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="saved" options={{ title: "Saved" }} />
      <Stack.Screen name="payments" options={{ title: "Payments" }} />
    </Stack>
  );
}
