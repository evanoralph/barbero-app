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
      <Stack.Screen name="index" options={{ title: "Inbox" }} />
      <Stack.Screen name="[threadId]" options={{ title: "Chat" }} />
    </Stack>
  );
}
