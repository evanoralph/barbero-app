import { WifiOff } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueue } from "@/src/offline/queue";
import { useServerStatus } from "@/src/server/server-status";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";

/**
 * Black strip shown app-wide while the connection is down. Screens keep working on cached
 * data; this only reports state and offers a manual retry (the app also probes on its own).
 */
export function OfflineBanner() {
  const { offline, checking, checkServerHealth, serverAvailable } = useServerStatus();
  const queue = useQueue();
  const insets = useSafeAreaInsets();

  // Before we ever connected the full-page server-down screen takes over instead.
  if (!offline || serverAvailable === false) return null;

  const message =
    queue.length > 0
      ? `Offline · ${queue.length} change${queue.length === 1 ? "" : "s"} waiting to send`
      : "Offline · showing saved results";

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[styles.bar, { paddingTop: insets.top + 10 }]}
      accessibilityRole="alert"
    >
      <WifiOff size={15} color={colors.accent} />
      <Text style={styles.text}>{message}</Text>
      <Pressable hitSlop={10} onPress={() => void checkServerHealth()} disabled={checking}>
        {checking ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Text style={styles.retry}>Retry</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: colors.text,
  },
  text: { flex: 1, color: colors.white, fontSize: 11, fontFamily: fonts.mono },
  retry: { color: colors.accent, fontSize: 11, fontFamily: fonts.monoMedium },
});
