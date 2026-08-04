import { useState } from "react";
import { Text } from "react-native";
import { forgotPassword } from "@/src/api/auth";
import { ApiError } from "@/src/api/client";
import { Button, Field, Muted, Screen, Title } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await forgotPassword(email.trim().toLowerCase());
      setMessage(res.message);
      logger.info("forgot-password", "ok");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Title>Forgot password</Title>
      <Muted>We will email a reset link if the account exists.</Muted>
      <Field
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {message ? <Text style={{ color: colors.success }}>{message}</Text> : null}
      <Button label="Send reset email" onPress={onSubmit} loading={loading} />
    </Screen>
  );
}
