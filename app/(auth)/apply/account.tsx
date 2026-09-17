import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { startProviderApply } from "@/src/api/providerApply";
import { ApiError } from "@/src/api/client";
import { useSession } from "@/src/auth/session";
import { Button, Field, Muted, Screen, Title } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

export default function ApplyAccountScreen() {
  const { completeSignUp } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    logger.info("apply-account", "submit", { email });
    try {
      const session = await startProviderApply({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
      });
      await completeSignUp(session);
      router.push("/(auth)/apply/verify-email");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to create account");
      logger.warn("apply-account", "failed", e);
    } finally {
      setLoading(false);
    }
  };

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
        value={phone}
        onChangeText={setPhone}
      />
      <Field
        label="Password"
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button
        label="Continue"
        onPress={onSubmit}
        loading={loading}
        disabled={!name.trim() || !email.trim() || password.length < 8}
      />
    </Screen>
  );
}
