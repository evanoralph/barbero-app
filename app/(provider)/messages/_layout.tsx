import { Stack } from "expo-router";
import { colors } from "@/src/theme/colors";

export default function ProviderMessagesLayout() {
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
