import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";

export type PlanId = "free" | "pro" | "premium";
export type SubscriptionStatus = "active" | "cancelled" | "none";

type PlanBadgeProps = {
  planId: PlanId;
  size?: "sm" | "md";
  status?: SubscriptionStatus;
};

const PLAN_LABELS: Record<PlanId, string> = {
  free: "FREE",
  pro: "PRO",
  premium: "PREMIUM",
};

export function planBadgeLabel(planId: PlanId): string {
  return PLAN_LABELS[planId] ?? "FREE";
}

export function PlanBadge({ planId, size = "md", status }: PlanBadgeProps) {
  const label = planBadgeLabel(planId);
  const isSmall = size === "sm";
  const isCancelled = status === "cancelled";

  return (
    <View style={{ gap: 4 }}>
      <View
        style={[
          styles.base,
          isSmall ? styles.sm : styles.md,
          planId === "free" && styles.free,
          planId === "pro" && styles.pro,
          planId === "premium" && styles.premium,
          isCancelled && styles.cancelled,
        ]}
      >
        <Text
          style={[
            styles.text,
            isSmall ? styles.textSm : styles.textMd,
            planId === "free" && styles.textFree,
            planId === "pro" && styles.textPro,
            planId === "premium" && styles.textPremium,
            isCancelled && styles.textCancelled,
          ]}
        >
          {label}
        </Text>
      </View>
      {status ? (
        <Text style={[styles.status, isSmall && styles.statusSm]}>
          {status === "active" ? "Active" : status === "cancelled" ? "Cancelled" : "No plan"}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
  },
  sm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  md: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  free: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  pro: {
    borderColor: colors.accent,
    backgroundColor: "#C9973A14",
  },
  premium: {
    borderColor: colors.accentDark,
    backgroundColor: colors.accentDark,
  },
  cancelled: {
    opacity: 0.65,
  },
  text: {
    fontFamily: fonts.monoMedium,
    letterSpacing: 0.8,
  },
  textSm: {
    fontSize: 10,
  },
  textMd: {
    fontSize: 11,
  },
  textFree: {
    color: colors.textMuted,
  },
  textPro: {
    color: colors.accentDark,
  },
  textPremium: {
    color: colors.white,
  },
  textCancelled: {
    color: colors.textMuted,
  },
  status: {
    color: colors.textMuted,
    fontSize: 12,
  },
  statusSm: {
    fontSize: 11,
  },
});
