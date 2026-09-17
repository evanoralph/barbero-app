import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { resendProviderApplyEmailCode, verifyProviderApplyEmail } from "@/src/api/providerApply";
import { ApiError } from "@/src/api/client";
import { Button, Field, Muted, Screen, Title } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

export default function ApplyVerifyEmailScreen() {
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
      await verifyProviderApplyEmail(code.trim());
      logger.info("apply-verify-email", "ok");
      router.push("/(auth)/apply/business");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Invalid or expired code");
      logger.warn("apply-verify-email", "failed", e);
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      const res = await resendProviderApplyEmailCode();
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
      <Muted>Enter the 6-digit code we sent to your email address.</Muted>
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
