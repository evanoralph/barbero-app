import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";
import { getAccountMe, updateAccountMe } from "@/src/api/account";
import { NotificationPreferencesSection } from "@/src/components/NotificationPreferencesSection";
import { PhPlacesSearchField } from "@/src/components/PhPlacesSearchField";
import { Button, ErrorState, Field, LoadingState, Screen, Title } from "@/src/components/ui";
import { LegalLinks } from "@/src/components/LegalLinks";
import type { AccountProfile } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { setDiscoveryLocation } from "@/src/utils/discoveryLocation";
import { logger } from "@/src/utils/logger";
import {
  normalizePhMobile,
  parseOptionalPhMobile,
  PH_MOBILE_ERROR,
  PH_MOBILE_HINT,
} from "@/src/utils/phone";

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
      logger.info("settings", "loaded", {
        hasPhone: Boolean(me.phone),
        prefsPush: me.notificationPreferences.push,
        prefsEmail: me.notificationPreferences.email,
      });
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

    const parsedPhone = parseOptionalPhMobile(phone);
    if (parsedPhone === null) {
      setError(PH_MOBILE_ERROR);
      setSaving(false);
      logger.info("settings", "blocked — invalid PH phone");
      return;
    }

    try {
      const updated = await updateAccountMe({
        name: name.trim(),
        phone: parsedPhone ?? "",
        city: city.trim(),
      });
      setProfile(updated);
      setPhone(updated.phone ?? "");
      setOk("Saved");
      logger.info("settings", "profile updated", { hasPhone: Boolean(updated.phone) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      logger.warn("settings", "save failed", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !profile) return <ErrorState message={error} onRetry={load} />;

  const phoneInvalid = Boolean(phone.trim()) && !normalizePhMobile(phone);

  return (
    <Screen scroll>
      <Title>Settings</Title>
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
      />
      <Field
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder={PH_MOBILE_HINT}
      />
      {phoneInvalid ? (
        <Text style={{ color: colors.danger, fontSize: 12 }}>{PH_MOBILE_ERROR}</Text>
      ) : null}
      <PhPlacesSearchField
        label="City / area (PH)"
        placeholder="Search address in the Philippines"
        value={city}
        onChangeText={setCity}
        onPlaceSelected={async (place) => {
          setCity(place.city || place.label);
          logger.info("settings", "places selected", { label: place.label });
          console.log("[settings] places selected", place.label);
          try {
            await setDiscoveryLocation({
              lat: place.lat,
              lng: place.lng,
              label: place.label,
              source: "manual",
            });
            console.log("[settings] discovery location updated");
          } catch (e) {
            logger.warn("settings", "discovery location update failed", e);
          }
        }}
      />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {ok ? <Text style={{ color: colors.success }}>{ok}</Text> : null}
      <Button label="Save" onPress={save} loading={saving} disabled={phoneInvalid} />

      {profile ? (
        <NotificationPreferencesSection
          preferences={profile.notificationPreferences}
          onUpdated={(notificationPreferences) => {
            setProfile((prev) => (prev ? { ...prev, notificationPreferences } : prev));
            logger.info("settings", "notification prefs updated in state");
          }}
        />
      ) : null}

      <LegalLinks />
    </Screen>
  );
}
