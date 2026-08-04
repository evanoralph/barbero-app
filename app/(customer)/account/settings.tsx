import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";
import { getAccountMe, updateAccountMe } from "@/src/api/account";
import { Button, ErrorState, Field, LoadingState, Screen, Title } from "@/src/components/ui";
import type { AccountProfile } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

export default function SettingsScreen() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const me = await getAccountMe();
      setProfile(me);
      setName(me.name);
      setPhone(me.phone ?? "");
      setCity(me.city ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const updated = await updateAccountMe({ name, phone, city });
      setProfile(updated);
      setOk("Saved");
      logger.info("settings", "profile updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !profile) return <ErrorState message={error} onRetry={load} />;

  return (
    <Screen scroll>
      <Title>Settings</Title>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Phone" value={phone} onChangeText={setPhone} />
      <Field label="City" value={city} onChangeText={setCity} />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {ok ? <Text style={{ color: colors.success }}>{ok}</Text> : null}
      <Button label="Save" onPress={save} loading={saving} />
    </Screen>
  );
}
