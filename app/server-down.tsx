import { router } from "expo-router";
import { Clock } from "lucide-react-native";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BrandLogo } from "@/src/components/BrandLogo";
import { Button, Muted, Screen, Title } from "@/src/components/ui";
import { useQueue } from "@/src/offline/queue";
import { useServerStatus } from "@/src/server/server-status";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { logger } from "@/src/utils/logger";

function lastConnectedLabel(at: number | null): string | null {
  if (!at) return null;
  const min = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (min < 1) return "Last connected just now";
  if (min < 60) return `Last connected ${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  return `Last connected ${hr} hour${hr === 1 ? "" : "s"} ago`;
}

export default function ServerDownScreen() {
  const { checkServerHealth, lastConnectedAt } = useServerStatus();
  const queue = useQueue();
  const [retrying, setRetrying] = useState(false);

  const onRetry = useCallback(async () => {
    logger.info("server", "retry tapped");
    setRetrying(true);
    try {
      const ok = await checkServerHealth();
      if (ok) {
        logger.info("server", "retry succeeded — navigating home");
        router.replace("/");
      } else {
        logger.warn("server", "retry failed — still unavailable");
      }
    } finally {
      setRetrying(false);
    }
  }, [checkServerHealth]);

  const lastConnected = lastConnectedLabel(lastConnectedAt);

  return (
    <Screen scroll onRefresh={onRetry} refreshing={retrying}>
      <View style={styles.hero}>
        <BrandLogo variant="lockup" style={styles.brandLogo} />
      </View>
      <Title style={styles.center}>You&apos;re offline</Title>
      <Muted style={styles.body}>
        Beru can&apos;t reach the server right now. Saved bookings and messages are still here —
        new results will load when you reconnect.
      </Muted>
      {queue.length > 0 ? (
        <View style={styles.queueCard}>
          <Text style={styles.queueLabel}>Waiting to send · {queue.length}</Text>
          {queue.map((item) => (
            <View key={item.id} style={styles.queueRow}>
              <Clock size={14} color={colors.warning} />
              <Text style={styles.queueText} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <Button label="Try again" onPress={onRetry} loading={retrying} />
      {lastConnected ? <Text style={styles.last}>{lastConnected}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 48, marginBottom: 24, alignItems: "center" },
  brandLogo: { height: 148, width: 210, alignSelf: "center" },
  center: { textAlign: "center" },
  body: { marginBottom: 12, textAlign: "center" },
  queueCard: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  queueLabel: {
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  queueRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  queueText: { flex: 1, color: colors.text, fontSize: 12, fontFamily: fonts.mono },
  last: { textAlign: "center", color: colors.textMuted, fontSize: 11, fontFamily: fonts.mono },
});
