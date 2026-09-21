import { Clock } from "lucide-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";

type Listener = (message: string | null) => void;
const listeners = new Set<Listener>();
let hideTimer: ReturnType<typeof setTimeout> | null = null;

/** Show the dark "queued" toast for a few seconds. Safe to call from non-React code. */
export function showToast(message: string, ms = 4000) {
  listeners.forEach((l) => l(message));
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => listeners.forEach((l) => l(null)), ms);
}

/** Mount once near the root; renders above the tab bar. */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    listeners.add(setMessage);
    return () => {
      listeners.delete(setMessage);
    };
  }, []);

  if (!message) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(160)}
      pointerEvents="none"
      style={[styles.wrap, { bottom: 80 + Math.max(insets.bottom - 8, 0) }]}
    >
      <View style={styles.toast}>
        <Clock size={15} color={colors.accent} />
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, zIndex: 100 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 15,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  text: {
    flex: 1,
    color: colors.white,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: fonts.mono,
  },
});
