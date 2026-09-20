import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { startProviderApply } from "@/src/api/providerApply";
import { fetchPublicAppConfig } from "@/src/api/public-config";
import { ApiError } from "@/src/api/client";
import { useSession } from "@/src/auth/session";
import { Button, Field, Muted, Screen, Title } from "@/src/components/ui";
import {
  resolveMobileTurnstileSiteKey,
  TurnstileWebView,
} from "@/src/components/TurnstileWebView";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";
import {
  normalizePhMobile,
  parseOptionalPhMobile,
  PH_MOBILE_ERROR,
  PH_MOBILE_HINT,
} from "@/src/utils/phone";

export default function ApplyAccountScreen() {
  const { completeSignUp } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [siteKey, setSiteKey] = useState<string | null>(() => resolveMobileTurnstileSiteKey(null));
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchPublicAppConfig().then((config) => {
      if (cancelled || !config) return;
      const key = resolveMobileTurnstileSiteKey(config.turnstileSiteKey);
      setSiteKey(key);
      logger.info("apply-account", "turnstile site key", { enabled: Boolean(key) });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async () => {
    setError(null);

    const parsedPhone = parseOptionalPhMobile(phone);
    if (parsedPhone === null) {
      setError(PH_MOBILE_ERROR);
      logger.info("apply-account", "blocked — invalid PH phone");
      return;
    }

    if (siteKey && !turnstileToken) {
      setError("Complete the security check");
      return;
    }
    setLoading(true);
    logger.info("apply-account", "submit", {
      email,
      hasPhone: Boolean(parsedPhone),
      turnstile: Boolean(turnstileToken),
    });
    try {
      const session = await startProviderApply({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        ...(parsedPhone ? { phone: parsedPhone } : {}),
        ...(turnstileToken ? { turnstileToken } : {}),
      });
      await completeSignUp(session);
      router.push("/(auth)/apply/verify-email");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to create account");
      logger.warn("apply-account", "failed", e);
      setTurnstileToken(null);
      setWidgetKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const turnstileRequired = Boolean(siteKey);
  const phoneOk = !phone.trim() || Boolean(normalizePhMobile(phone));
  const canSubmit =
    Boolean(name.trim()) &&
    Boolean(email.trim()) &&
    password.length >= 8 &&
    phoneOk &&
    (!turnstileRequired || Boolean(turnstileToken));

  return (
    <Screen scroll>
      <Title>Become a provider</Title>
      <Muted>Start your Beru provider application. We'll review your business before you go live.</Muted>
      <Field label="Full name" autoCapitalize="words" value={name} onChangeText={setName} />
      <Field
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label="Phone (optional)"
        keyboardType="phone-pad"
        autoComplete="tel"
        value={phone}
        onChangeText={setPhone}
        placeholder={PH_MOBILE_HINT}
      />
      {phone.trim() && !normalizePhMobile(phone) ? (
        <Text style={{ color: colors.danger, fontSize: 12 }}>{PH_MOBILE_ERROR}</Text>
      ) : null}
      <Field
        label="Password"
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      />
      {siteKey ? (
        <TurnstileWebView
          key={widgetKey}
          siteKey={siteKey}
          theme="light"
          onToken={setTurnstileToken}
        />
      ) : null}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button label="Continue" onPress={onSubmit} loading={loading} disabled={!canSubmit} />
    </Screen>
  );
}
