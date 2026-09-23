import { Link, Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "@/src/api/client";
import { useSession } from "@/src/auth/session";
import { BrandLogo } from "@/src/components/BrandLogo";
import { Button, Field, LoadingState, Muted, Screen } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { isLoginOtpChallenge } from "@/src/types/api";
import { resolveCustomerEntryHref } from "@/src/utils/customerRoute";
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
  const { ready, user, role, signIn } = useSession();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customerHref, setCustomerHref] = useState<
    "/(auth)/location-permission" | "/(customer)" | null
  >(null);

  useEffect(() => {
    if (!ready || !user || role !== "customer") {
      setCustomerHref(null);
      return;
    }
    let cancelled = false;
    void resolveCustomerEntryHref().then((href) => {
      if (!cancelled) setCustomerHref(href);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, user, role]);

  if (ready && user && role === "provider") {
    return <Redirect href="/(provider)" />;
  }
  if (ready && user && role === "customer") {
    if (!customerHref) return <LoadingState label="Loading…" />;
    return <Redirect href={customerHref} />;
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
      if (isLoginOtpChallenge(result)) {
        logger.info("login-otp", "navigating to verify", { email: result.email });
        router.push({
          pathname: "/(auth)/login-verify",
          params: { email: result.email },
        });
        return;
      }
      // Legacy path if API ever returns a full session (should not happen with OTP).
      if (
        result.roles.includes("admin") &&
        !result.roles.includes("provider") &&
        !result.roles.includes("customer")
      ) {
        setError("Admin accounts use the web app. Mobile supports customer and provider only.");
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
        return;
      }
      if (result.roles.includes("provider")) {
        router.replace("/(provider)");
      } else {
        const href = await resolveCustomerEntryHref();
        logger.info("login", "customer post-login route", { href });
        console.log("[login] customer post-login", href);
        router.replace(href);
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
    <Screen scroll contentStyle={styles.screenContent}>
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <BrandLogo variant="lockup" style={styles.brandLogo} />
      </View>

      <View style={styles.fields}>
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
      </View>

      <View style={styles.actions}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Sign in" onPress={onSubmit} loading={loading} testID="sign-in-button" />
        <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
          Forgot password?
        </Link>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Muted>Don&apos;t have an account?</Muted>
          <Link href="/(auth)/register" style={styles.footerLink}>
            Sign up
          </Link>
        </View>
        <Link href="/(auth)/apply/account" style={styles.providerLink}>
          Become a provider
        </Link>
      </View>

      {__DEV__ ? (
        <View style={styles.devFill}>
          <Muted>Dev quick fill</Muted>
          <View style={styles.devFillRow}>
            <View style={styles.devFillBtn}>
              <Button
                label="Customer"
                variant="secondary"
                onPress={() => fillDevLogin("customer")}
                testID="dev-fill-customer"
              />
            </View>
            <View style={styles.devFillBtn}>
              <Button
                label="Provider"
                variant="secondary"
                onPress={() => fillDevLogin("provider")}
                testID="dev-fill-provider"
              />
            </View>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flexGrow: 1, justifyContent: "center", gap: 28 },
  hero: { alignItems: "center" },
  brandLogo: { height: 132, width: 187, alignSelf: "center" },
  fields: { gap: 14 },
  error: { color: colors.danger, fontSize: 14 },
  actions: { gap: 12 },
  forgotLink: {
    alignSelf: "center",
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "500",
  },
  footer: {
    alignItems: "center",
    gap: 10,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerLink: { color: colors.accent, fontWeight: "700", fontSize: 14 },
  providerLink: {
    color: colors.textMuted,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  devFill: { gap: 8 },
  devFillRow: { flexDirection: "row", gap: 8 },
  devFillBtn: { flex: 1 },
});
