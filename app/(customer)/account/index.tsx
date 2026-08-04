import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { getAccountMe } from "@/src/api/account";
import { useSession } from "@/src/auth/session";
import {
  Button,
  ErrorState,
  LoadingState,
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import type { AccountProfile } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export default function AccountScreen() {
  const { signOut, user } = useSession();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setProfile(await getAccountMe());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <Screen scroll onRefresh={load}>
      <Title>Account</Title>
      <Muted>{profile?.name || user?.email}</Muted>
      <Muted>{profile?.email || user?.email}</Muted>
      <Button label="Settings" variant="secondary" onPress={() => router.push("/(customer)/account/settings")} />
      <Button label="Saved providers" variant="secondary" onPress={() => router.push("/(customer)/account/saved")} />
      <Button label="Payments (stub)" variant="ghost" onPress={() => router.push("/(customer)/account/payments")} />
      <Button
        label="Sign out"
        variant="danger"
        onPress={async () => {
          logger.info("account", "sign out");
          await signOut();
          router.replace("/(auth)/login");
        }}
      />
    </Screen>
  );
}
