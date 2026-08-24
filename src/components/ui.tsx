import React, { useEffect } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import spinnerGold from "@/assets/lottie/spinner-gold.json";
import { AnimatedPressable } from "@/src/components/animated/AnimatedPressable";
import { LottieView } from "@/src/components/animated/LottieView";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";

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
  if (scroll) {
    return (
      <ScrollView
        style={[styles.screen, style]}
        contentContainerStyle={[styles.screenContent, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.accent} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
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
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <AnimatedPressable
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
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
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
    <AnimatedPressable onPress={onPress} style={[styles.chip, animatedChipStyle]}>
      <Animated.Text style={[styles.chipText, animatedTextStyle]}>{label}</Animated.Text>
    </AnimatedPressable>
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
  errorText: { color: colors.danger, textAlign: "center", fontSize: 15 },
  chip: {
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
});
