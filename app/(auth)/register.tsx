import { Link, router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { registerStart } from "@/src/api/auth";
import { ApiError } from "@/src/api/client";
import { Button, Field, Muted, Screen, Title } from "@/src/components/ui";
import { getPasswordStrengthScore, PasswordStrengthMeter } from "@/src/components/PasswordStrengthMeter";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (getPasswordStrengthScore(password) < 2) {
      setError("Choose a stronger password");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    logger.info("register", "submit", { email });
    try {
      await registerStart({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      router.push({
        pathname: "/(auth)/verify-email",
        params: { email: email.trim().toLowerCase() },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to create account");
      logger.warn("register", "failed", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Title>Create your account</Title>
      <Muted>Book beauty & grooming professionals</Muted>
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
        label="Password"
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      />
      <PasswordStrengthMeter password={password} />
      <Field
        label="Confirm password"
        secureTextEntry
        autoComplete="new-password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />
      {confirmPassword && confirmPassword !== password ? (
        <Text style={{ color: colors.danger, fontSize: 12 }}>Passwords do not match</Text>
      ) : null}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button
        label="Create account"
        onPress={onSubmit}
        loading={loading}
        disabled={
          !name.trim() ||
          !email.trim() ||
          password.length < 8 ||
          password !== confirmPassword
        }
      />
      <Link href="/(auth)/login" style={{ color: colors.accent, fontWeight: "600", marginTop: 4 }}>
        Already have an account? Sign in
      </Link>
    </Screen>
  );
}
