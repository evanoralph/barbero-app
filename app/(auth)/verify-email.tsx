import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { registerResend, registerVerify } from "@/src/api/auth";
import { ApiError } from "@/src/api/client";
import { useSession } from "@/src/auth/session";
import { Button, Field, Muted, Screen, Title } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

export default function VerifyEmailScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { completeSignUp } = useSession();
  const email = typeof emailParam === "string" ? emailParam : "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const result = await registerVerify({ email, code: code.trim() });
      await completeSignUp(result);
      logger.info("verify-email", "ok");
      router.replace("/(customer)");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Invalid or expired code");
      logger.warn("verify-email", "failed", e);
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      const res = await registerResend(email);
      setNotice(res.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen scroll>
      <Title>Verify your email</Title>
      <Muted>Enter the 6-digit code we sent to {email || "your email"}.</Muted>
      <Field
        label="Verification code"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, ""))}
      />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {notice ? <Text style={{ color: colors.success }}>{notice}</Text> : null}
      <Button label="Verify" onPress={onSubmit} loading={loading} disabled={code.length !== 6} />
      <Button label="Resend code" variant="ghost" onPress={onResend} loading={resending} />
    </Screen>
  );
}
