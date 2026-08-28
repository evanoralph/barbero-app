import { formatMoney } from '@/utils/format';
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Muted } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { safeNumber } from "@/src/utils/format";
import { logger } from "@/src/utils/logger";

export type RevenueBarPoint = {
  month: string;
  revenue: number;
  bookings?: number;
};

type Props = {
  data: RevenueBarPoint[];
  /** How many trailing months to show. */
  maxBars?: number;
};

const CHART_HEIGHT = 140;

/**
 * Simple vertical bar chart for monthly revenue (no chart lib dependency).
 */
export function RevenueBarChart({ data, maxBars = 6 }: Props) {
  const points = data.slice(-maxBars);
  const maxRevenue = Math.max(1, ...points.map((p) => safeNumber(p.revenue)));

  useEffect(() => {
    logger.debug("RevenueBarChart", "render", {
      points: points.length,
      maxRevenue,
    });
  }, [points.length, maxRevenue]);

  if (points.length === 0) {
    return <Muted>No revenue data yet.</Muted>;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.chart}>
        {points.map((row) => {
          const revenue = safeNumber(row.revenue);
          const heightPct = Math.max(4, Math.round((revenue / maxRevenue) * 100));
          const barHeight = Math.round((CHART_HEIGHT * heightPct) / 100);
          return (
            <View key={row.month} style={styles.col}>
              <Text style={styles.value} numberOfLines={1}>
                {formatMoney(revenue)}
              </Text>
              <View style={styles.barArea}>
                <View style={[styles.bar, { height: barHeight }]} />
              </View>
              <Text style={styles.month} numberOfLines={1}>
                {row.month}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    minHeight: CHART_HEIGHT + 40,
  },
  col: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  value: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fonts.mono,
  },
  barArea: {
    height: CHART_HEIGHT,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    width: "62%",
    maxWidth: 36,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: colors.accent,
  },
  month: {
    color: colors.text,
    fontSize: 11,
    fontFamily: fonts.monoMedium,
  },
});
