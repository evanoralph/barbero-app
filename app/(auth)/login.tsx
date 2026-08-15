import { Link, Redirect, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/src/api/client";
import { useSession } from "@/src/auth/session";
import { BrandLogo } from "@/src/components/BrandLogo";
import { Button, Field, Muted, Screen, Title } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

const DEV_SEED_LOGINS = {
  customer: {
    email: "customer@example.test",
    password: "change-me-customer-8chars",
  },
  provider: {
    email: "provider@example.test",
    password: "change-me-provider-8chars",
  },
} as const;

export default function LoginScreen() {
  const { ready, user, role, signIn, signOut } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (ready && user && (role === "customer" || role === "provider")) {
    return <Redirect href={role === "provider" ? "/(provider)" : "/(customer)"} />;
  }

  const fillDevLogin = (roleKey: keyof typeof DEV_SEED_LOGINS) => {
    const seed = DEV_SEED_LOGINS[roleKey];
    setEmail(seed.email);
    setPassword(seed.password);
    setError(null);
    logger.info("login", "dev-fill", { role: roleKey });
  };

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    logger.info("login", "submit", { email });
    try {
      const result = await signIn(email, password);
      if (result.roles.includes("admin") && !result.roles.includes("provider") && !result.roles.includes("customer")) {
        setError("Admin accounts use the web app. Mobile supports customer and provider only.");
        await signOut();
        return;
      }
      if (result.roles.includes("provider")) {
        router.replace("/(provider)");
      } else {
        router.replace("/(customer)");
      }
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.code === "AUTH_ACCOUNT_LOCKED"
            ? "Account temporarily locked. Try again later."
            : e.message
          : "Unable to sign in";
      setError(msg);
      logger.warn("login", "failed", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <BrandLogo variant="gold" size="xl" style={styles.brandLogo} />
        <Muted>Book beauty & grooming professionals</Muted>
      </View>
      <Title>Sign in</Title>
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
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Sign in" onPress={onSubmit} loading={loading} />
      <Link href="/(auth)/forgot-password" style={styles.link}>
        Forgot password?
      </Link>
      {__DEV__ ? (
        <View style={styles.devFill}>
          <Muted>Dev quick fill</Muted>
          <View style={styles.devFillRow}>
            <View style={styles.devFillBtn}>
              <Button label="Customer" variant="secondary" onPress={() => fillDevLogin("customer")} />
            </View>
            <View style={styles.devFillBtn}>
              <Button label="Provider" variant="secondary" onPress={() => fillDevLogin("provider")} />
            </View>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 48, marginBottom: 12, gap: 8 },
  brandLogo: { height: 72, width: 160, alignSelf: "flex-start" },
  error: { color: colors.danger, fontSize: 14 },
  link: { color: colors.accent, fontWeight: "600", marginTop: 4 },
  devFill: { marginTop: 16, gap: 8 },
  devFillRow: { flexDirection: "row", gap: 8 },
  devFillBtn: { flex: 1 },
});
