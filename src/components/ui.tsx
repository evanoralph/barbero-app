import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardToolbar,
} from "react-native-keyboard-controller";
import { History, Search, SlidersHorizontal, X } from "lucide-react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import spinnerGold from "@/assets/lottie/spinner-gold.json";
import { AnimatedPressable } from "@/src/components/animated/AnimatedPressable";
import { LottieView } from "@/src/components/animated/LottieView";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { logger } from "@/src/utils/logger";

/** Extra space so focused field + primary CTA stay above the keyboard. */
const KEYBOARD_BOTTOM_OFFSET = 62;

export function Screen({
  children,
  style,
  scroll,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
}) {
  useEffect(() => {
    if (!scroll) return;
    logger.debug("ui.Screen", "keyboard-aware scroll enabled", {
      platform: Platform.OS,
      bottomOffset: KEYBOARD_BOTTOM_OFFSET,
    });
  }, [scroll]);

  if (scroll) {
    return (
      <>
        <KeyboardAwareScrollView
          style={[styles.screen, style]}
          contentContainerStyle={[styles.screenContent, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={KEYBOARD_BOTTOM_OFFSET}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.accent} />
            ) : undefined
          }
        >
          {children}
        </KeyboardAwareScrollView>
        <KeyboardToolbar />
      </>
    );
  }
  return <View style={[styles.screen, styles.screenContent, style, contentStyle]}>{children}</View>;
}

export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Subtitle({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function MonoLabel({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.monoLabel, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}) {
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        variant === "primary" && styles.btnPrimary,
        variant === "secondary" && styles.btnSecondary,
        variant === "danger" && styles.btnDanger,
        variant === "ghost" && styles.btnGhost,
        (disabled || loading) && styles.btnDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "secondary" || variant === "ghost"
              ? colors.accent
              : variant === "danger"
                ? colors.white
                : colors.text
          }
        />
      ) : (
        <Text
          style={[
            styles.btnText,
            (variant === "secondary" || variant === "ghost") && { color: colors.text },
            variant === "danger" && { color: colors.white },
          ]}
        >
          {label}
        </Text>
      )}
    </AnimatedPressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

export function LoadingState({ label = "Loading…", lottie }: { label?: string; lottie?: boolean }) {
  return (
    <View style={styles.center}>
      {lottie ? (
        <LottieView source={spinnerGold} style={styles.loadingLottie} />
      ) : (
        <ActivityIndicator color={colors.accent} size="large" />
      )}
      <Muted>{label}</Muted>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  illustration,
}: {
  title: string;
  body?: string;
  illustration?: React.ReactNode;
}) {
  return (
    <View style={styles.center}>
      {illustration}
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Muted>{body}</Muted> : null}
    </View>
  );
}

/** Per-screen empty state for "offline and nothing saved to show". */
export function OfflineState({ onRetry, body }: { onRetry?: () => void; body?: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.offlineTitle}>You&apos;re offline</Text>
      <Muted style={{ textAlign: "center" }}>
        {body ?? "Beru can't reach the server right now. New results will load when you reconnect."}
      </Muted>
      {onRetry ? <Button label="Try again" onPress={onRetry} /> : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Button label="Retry" onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  icon,
  onRemove,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /** Small leading glyph (history, map-pin…). */
  icon?: React.ReactNode;
  /** Trailing ✕ — used by applied-filter chips. */
  onRemove?: () => void;
}) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active, progress]);

  const animatedChipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.white, colors.accent]),
    borderColor: interpolateColor(progress.value, [0, 1], [colors.border, colors.accent]),
  }));
  const animatedTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.textMuted, colors.text]),
  }));

  return (
    <AnimatedPressable onPress={onRemove ?? onPress} style={[styles.chip, animatedChipStyle]}>
      {icon}
      <Animated.Text style={[styles.chipText, animatedTextStyle]}>{label}</Animated.Text>
      {onRemove ? <X size={11} color={colors.text} style={{ opacity: 0.55 }} /> : null}
    </AnimatedPressable>
  );
}

/** Card/row placeholder that keeps the real layout's shape while data loads. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.skeleton, style, animated]} />;
}

export type SegmentOption<T extends string> = { id: T; label: string; badge?: number };

/** Inset pill control (List/Map, Upcoming/Past, All/Unread…). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <AnimatedPressable
            key={o.id}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.id)}
            style={[styles.segmentBtn, active && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
            {o.badge ? (
              <View style={styles.segmentBadge}>
                <Text style={styles.segmentBadgeText}>{o.badge}</Text>
              </View>
            ) : null}
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

/** Round/rounded-square Filters button carrying the active-filter count badge. */
export function FilterButton({
  count,
  onPress,
  round,
}: {
  count: number;
  onPress: () => void;
  round?: boolean;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Filters, ${count} active` : "Filters"}
      style={[styles.filterBtn, round && styles.filterBtnRound]}
    >
      <SlidersHorizontal size={18} color={colors.white} />
      {count > 0 ? (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{count}</Text>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

/** Search input with leading glyph; replaces the labelled Field on discovery screens. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchField}>
      <Search size={17} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.searchInput}
      />
    </View>
  );
}

/** Grey pill for cached data: "Saved 12 min ago". */
export function StaleBadge({ label }: { label: string }) {
  return (
    <View style={styles.staleBadge}>
      <History size={12} color={colors.textMuted} />
      <Text style={styles.staleText}>{label}</Text>
    </View>
  );
}

/** Small inline spinner + label ("Refining results…", "Loading more…"). */
export function SpinnerRow({ label, center }: { label: string; center?: boolean }) {
  return (
    <View style={[styles.spinnerRow, center && { justifyContent: "center" }]}>
      <ActivityIndicator size="small" color={colors.accent} />
      <Text style={styles.spinnerText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: 20, paddingBottom: 40, gap: 14 },
  title: {
    color: colors.text,
    fontSize: 28,
    fontFamily: fonts.serif,
    letterSpacing: -0.2,
  },
  subtitle: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fonts.serifMedium,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  monoLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  btn: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnSecondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDanger: { backgroundColor: colors.danger },
  btnGhost: { backgroundColor: "transparent" },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
    fontFamily: fonts.monoMedium,
  },
  fieldWrap: { gap: 6 },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    backgroundColor: colors.bg,
  },
  loadingLottie: { width: 64, height: 64 },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fonts.serifMedium,
  },
  offlineTitle: { color: colors.text, fontSize: 24, fontFamily: fonts.serif },
  errorText: { color: colors.danger, textAlign: "center", fontSize: 15 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: {
    color: colors.textMuted,
    fontWeight: "500",
    fontSize: 12,
    fontFamily: fonts.mono,
  },
  chipTextActive: { color: colors.text },
  skeleton: { backgroundColor: colors.surfaceAlt, borderRadius: 14 },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentBtnActive: { backgroundColor: colors.text, borderColor: colors.text },
  segmentText: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.monoMedium },
  segmentTextActive: { color: colors.white },
  segmentBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.warning,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBadgeText: { color: colors.white, fontSize: 10, fontFamily: fonts.monoMedium },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnRound: { width: 44, height: 44, borderRadius: 999 },
  countBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: { color: colors.text, fontSize: 11, lineHeight: 13, fontFamily: fonts.monoMedium },
  searchField: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.white,
  },
  searchInput: { flex: 1, padding: 0, fontSize: 15, color: colors.text, fontFamily: fonts.mono },
  staleBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  staleText: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.mono },
  spinnerRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 4 },
  spinnerText: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.mono },
});
