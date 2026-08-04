import { Stack } from "expo-router";
import { colors } from "@/src/theme/colors";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="login" options={{ title: "Sign in", headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ title: "Forgot password" }} />
      <Stack.Screen name="reset-password" options={{ title: "Reset password" }} />
    </Stack>
  );
}
