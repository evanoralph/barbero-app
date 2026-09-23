import { useEffect, useState } from "react";
import { Alert, Switch, Text, View, StyleSheet } from "react-native";
import { sendPushTest, updateAccountMe } from "@/src/api/account";
import { Button, Muted, Subtitle } from "@/src/components/ui";
import type { AccountProfile } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { logger } from "@/src/utils/logger";

type PrefKey = keyof AccountProfile["notificationPreferences"];

const ROWS: { key: PrefKey; label: string; hint: string; disabled?: boolean }[] = [
  {
    key: "email",
    label: "Email notifications",
    hint: "Booking confirmations and updates via email",
  },
  {
    key: "push",
    label: "Push notifications",
    hint: "Alerts on this device for bookings and chat",
  },
  {
    key: "sms",
    label: "SMS notifications",
    hint: "Text messages (not available yet)",
    disabled: true,
  },
  {
    key: "promotions",
    label: "Promotional emails",
    hint: "Deals and news from Beru",
  },
];

type Props = {
  preferences: AccountProfile["notificationPreferences"];
  onUpdated: (next: AccountProfile["notificationPreferences"]) => void;
};

/**
 * Toggles matching web account notification preferences.
 * Saves each change immediately via PATCH /account/me.
 */
export function NotificationPreferencesSection({ preferences, onUpdated }: Props) {
  const [local, setLocal] = useState(preferences);
  const [savingKey, setSavingKey] = useState<PrefKey | null>(null);
  const [testingPush, setTestingPush] = useState(false);

  useEffect(() => {
    setLocal(preferences);
  }, [preferences]);

  const toggle = async (key: PrefKey, value: boolean) => {
    if (ROWS.find((r) => r.key === key)?.disabled) return;

    const previous = local;
    const next = { ...local, [key]: value };
    setLocal(next);
    setSavingKey(key);
    logger.info("notification-prefs", "toggle", { key, value });

    try {
      const updated = await updateAccountMe({ notificationPreferences: { [key]: value } });
      onUpdated(updated.notificationPreferences);
      setLocal(updated.notificationPreferences);
      logger.info("notification-prefs", "saved", { key, value });
    } catch (error) {
      setLocal(previous);
      logger.warn("notification-prefs", "save failed — reverted", { key, error });
    } finally {
      setSavingKey(null);
    }
  };

  const onTestPush = async () => {
    setTestingPush(true);
    logger.info("notification-prefs", "push-test start");
    try {
      const result = await sendPushTest();
      logger.info("notification-prefs", "push-test result", {
        delivered: result.delivered,
        fcmConfigured: result.fcmConfigured,
        fcmTokenCount: result.fcmTokenCount,
        expoTokenCount: result.expoTokenCount,
        fcmSent: result.fcm.sent,
        fcmFailed: result.fcm.failed,
        expoSent: result.expo.sent,
        expoFailed: result.expo.failed,
        hint: result.hint,
        fcmErrors: result.fcm.errors,
      });
      Alert.alert(
        result.delivered ? "Push accepted" : "Push not delivered",
        [
          result.hint,
          "",
          `FCM tokens: ${result.fcmTokenCount} (sent ${result.fcm.sent}, failed ${result.fcm.failed})`,
          `Expo tokens: ${result.expoTokenCount} (sent ${result.expo.sent}, failed ${result.expo.failed})`,
          `FCM configured: ${result.fcmConfigured ? "yes" : "no"}`,
        ].join("\n"),
      );
    } catch (error) {
      logger.warn("notification-prefs", "push-test failed", error);
      Alert.alert(
        "Push test failed",
        error instanceof Error ? error.message : "Could not reach the API",
      );
    } finally {
      setTestingPush(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Subtitle>Notifications</Subtitle>
      <Muted>Choose how you want to be notified</Muted>
      {ROWS.map((row) => (
        <View key={row.key} style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.hint}>{row.hint}</Text>
          </View>
          <Switch
            value={local[row.key]}
            onValueChange={(checked) => void toggle(row.key, checked)}
            disabled={row.disabled || savingKey === row.key}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.white}
            accessibilityLabel={row.label}
          />
        </View>
      ))}
      <Button
        label="Send test notification"
        variant="secondary"
        loading={testingPush}
        onPress={() => void onTestPush()}
      />
      <Muted>
        After tapping, background the app. The alert shows FCM/APNs diagnostics if delivery fails.
      </Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontFamily: fonts.serifMedium,
    fontSize: 15,
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
