import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { resetPassword } from "@/src/api/auth";
import { ApiError } from "@/src/api/client";
import { Button, Field, Muted, Screen, Title } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(typeof params.token === "string" ? params.token : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await resetPassword(token.trim(), password);
      logger.info("reset-password", "ok");
      router.replace("/(auth)/login");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Title>Reset password</Title>
      <Muted>Paste the token from your email and choose a new password (min 8 chars).</Muted>
      <Field label="Token" value={token} onChangeText={setToken} autoCapitalize="none" />
      <Field
        label="New password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button label="Update password" onPress={onSubmit} loading={loading} />
    </Screen>
  );
}
