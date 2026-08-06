import { Stack } from "expo-router";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";

export default function CustomerMessagesLayout() {
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
