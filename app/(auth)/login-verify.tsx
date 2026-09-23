import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { loginResend, loginVerify } from "@/src/api/auth";
import { ApiError } from "@/src/api/client";
import {
  clearLoginOtpChallenge,
  getLoginOtpChallenge,
  updateLoginOtpChallengeId,
} from "@/src/auth/login-otp-challenge";
import { useSession } from "@/src/auth/session";
import { Button, Field, Muted, Screen, Title } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { resolveCustomerEntryHref } from "@/src/utils/customerRoute";
import { logger } from "@/src/utils/logger";

export default function LoginVerifyScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { completeSignUp, signOut } = useSession();
  const emailFromParams = typeof emailParam === "string" ? emailParam : "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const challenge = getLoginOtpChallenge();
  const email = challenge?.email || emailFromParams;

  const onSubmit = async () => {
    setError(null);
    setNotice(null);
    const current = getLoginOtpChallenge();
    if (!current?.challengeId) {
      setError("Login session expired. Sign in again.");
      logger.warn("login-otp", "missing challenge on verify");
      return;
    }
    setLoading(true);
    try {
      logger.info("login-otp", "verify submit", { email: current.email });
      const result = await loginVerify({
        email: current.email,
        code: code.trim(),
        challengeId: current.challengeId,
      });
      clearLoginOtpChallenge();

      if (
        result.roles.includes("admin") &&
        !result.roles.includes("provider") &&
        !result.roles.includes("customer")
      ) {
        setError("Admin accounts use the web app. Mobile supports customer and provider only.");
        await completeSignUp(result);
        await signOut();
        return;
      }
      if (
        result.roles.includes("establishment_owner") &&
        !result.roles.includes("provider") &&
        !result.roles.includes("customer")
      ) {
        setError(
          "Establishment owner accounts use the web shop dashboard. Mobile supports customer and provider only.",
        );
        await completeSignUp(result);
        await signOut();
        return;
      }

      await completeSignUp(result);
      logger.info("login-otp", "ok", { roles: result.roles });
      if (result.roles.includes("provider")) {
        router.replace("/(provider)");
      } else {
        const href = await resolveCustomerEntryHref();
        logger.info("login-otp", "customer post-login route", { href });
        console.log("[login-otp] customer post-login", href);
        router.replace(href);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Invalid or expired code");
      logger.warn("login-otp", "verify failed", e);
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setError(null);
    setNotice(null);
    const current = getLoginOtpChallenge();
    if (!current?.challengeId) {
      setError("Login session expired. Sign in again.");
      return;
    }
    setResending(true);
    try {
      logger.info("login-otp", "resend", { email: current.email });
      const res = await loginResend({
        email: current.email,
        challengeId: current.challengeId,
      });
      updateLoginOtpChallengeId(res.challengeId, res.devCode);
      setNotice(res.message);
    } catch (e) {
      if (e instanceof ApiError && e.code === "LOGIN_CHALLENGE_EXPIRED") {
        clearLoginOtpChallenge();
        setError("Login session expired. Sign in again.");
      } else {
        setError(e instanceof ApiError ? e.message : "Unable to resend code");
      }
      logger.warn("login-otp", "resend failed", e);
    } finally {
      setResending(false);
    }
  };

  const fillDevCode = () => {
    const current = getLoginOtpChallenge();
    if (current?.devCode) {
      setCode(current.devCode);
      setError(null);
      logger.info("login-otp", "dev-fill code");
    }
  };

  return (
    <Screen scroll>
      <Title>Enter login code</Title>
      <Muted>Enter the 6-digit code we sent to {email || "your email"}.</Muted>
      <Field
        label="Login code"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, ""))}
        testID="login-otp-code"
      />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {notice ? <Text style={{ color: colors.success }}>{notice}</Text> : null}
      <Button
        label="Verify"
        onPress={onSubmit}
        loading={loading}
        disabled={code.length !== 6}
        testID="login-otp-verify"
      />
      <Button
        label="Resend code"
        variant="ghost"
        onPress={onResend}
        loading={resending}
        testID="login-otp-resend"
      />
      {__DEV__ && getLoginOtpChallenge()?.devCode ? (
        <Button
          label="Use dev code"
          variant="secondary"
          onPress={fillDevCode}
          testID="login-otp-dev-fill"
        />
      ) : null}
    </Screen>
  );
}
