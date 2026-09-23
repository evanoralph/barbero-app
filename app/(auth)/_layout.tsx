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
      <Stack.Screen name="login-verify" options={{ title: "Login code" }} />
      <Stack.Screen name="register" options={{ title: "Create account" }} />
      <Stack.Screen name="verify-email" options={{ title: "Verify email" }} />
      <Stack.Screen name="forgot-password" options={{ title: "Forgot password" }} />
      <Stack.Screen name="reset-password" options={{ title: "Reset password" }} />
      <Stack.Screen
        name="location-permission"
        options={{ title: "Your location", headerBackVisible: false }}
      />
      <Stack.Screen name="location-manual" options={{ title: "Enter location" }} />
      <Stack.Screen name="apply/account" options={{ title: "Become a provider" }} />
      <Stack.Screen name="apply/verify-email" options={{ title: "Verify email" }} />
      <Stack.Screen name="apply/business" options={{ title: "Your business" }} />
      <Stack.Screen name="apply/location" options={{ title: "Location" }} />
      <Stack.Screen name="apply/proofs" options={{ title: "Proof documents" }} />
      <Stack.Screen name="apply/done" options={{ title: "Application submitted" }} />
    </Stack>
  );
}
