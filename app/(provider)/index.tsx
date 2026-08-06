import { router } from "expo-router";
import {
  Briefcase,
  CalendarDays,
  Clock3,
  ImageIcon,
  Inbox,
  Sparkles,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getMyAnalytics, getMyProvider, getProviderReviews } from "@/src/api/providers";
import {
  Button,
  Card,
  Chip,
  ErrorState,
  LoadingState,
  MonoLabel,
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import type {
  ProviderAnalytics,
  ProviderAnalyticsRange,
  ProviderProfile,
  Review,
} from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { formatRating, safeNumber } from "@/src/utils/format";
import { formatBookingTime } from "@/src/utils/bookingDisplay";
import { RevenueBarChart } from "@/src/components/RevenueBarChart";
import { getProfileCompleteness } from "@/src/utils/profileCompleteness";
import { logger } from "@/src/utils/logger";

const RANGES: Array<{ id: ProviderAnalyticsRange; label: string }> = [
  { id: "7days", label: "7d" },
  { id: "30days", label: "30d" },
  { id: "3months", label: "3m" },
  { id: "12months", label: "12m" },
  { id: "ytd", label: "YTD" },
];

const RANGE_LABELS: Record<ProviderAnalyticsRange, string> = {
  "7days": "Last 7 days",
  "30days": "Last 30 days",
  "3months": "Last 3 months",
  "12months": "Last 12 months",
  ytd: "Year to date",
};

const QUICK_ACTIONS = [
  {
    id: "bookings",
    label: "Bookings",
    icon: CalendarDays,
    href: "/(provider)/bookings" as const,
  },
  {
    id: "hours",
    label: "Hours",
    icon: Clock3,
    href: "/(provider)/availability" as const,
  },
  {
    id: "services",
    label: "Services",
    icon: Briefcase,
    href: "/(provider)/services" as const,
  },
  {
    id: "portfolio",
    label: "Portfolio",
    icon: ImageIcon,
    href: "/(provider)/portfolio" as const,
  },
  {
    id: "inbox",
    label: "Inbox",
    icon: Inbox,
    href: "/(provider)/messages" as const,
  },
  {
    id: "plan",
    label: "Plan",
    icon: Sparkles,
    href: "/(provider)/subscription" as const,
  },
];

function warnMissingAnalyticsFields(data: ProviderAnalytics) {
  const missing: string[] = [];
  if (data.averageRating == null || !Number.isFinite(Number(data.averageRating))) {
    missing.push("averageRating");
  }
  if (data.revenueThisMonth == null || !Number.isFinite(Number(data.revenueThisMonth))) {
    missing.push("revenueThisMonth");
  }
  if (data.bookingsThisMonth == null || !Number.isFinite(Number(data.bookingsThisMonth))) {
    missing.push("bookingsThisMonth");
  }
  if (data.upcomingBookings == null || !Number.isFinite(Number(data.upcomingBookings))) {
    missing.push("upcomingBookings");
  }
  if (!data.bookingPerformance) missing.push("bookingPerformance");
  if (!data.customerInsights) missing.push("customerInsights");
  if (!Array.isArray(data.revenueByMonth)) missing.push("revenueByMonth");
  if (missing.length > 0) {
    logger.warn("provider-dashboard", "missing analytics fields", { missing });
  }
}

export default function ProviderDashboard() {
  const [range, setRange] = useState<ProviderAnalyticsRange>("30days");
  const [analytics, setAnalytics] = useState<ProviderAnalytics | null>(null);
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    logger.debug("provider-dashboard", "load analytics", { range });
    console.log("[provider-dashboard] load", range);
    try {
      const [data, me] = await Promise.all([getMyAnalytics(range), getMyProvider()]);
      warnMissingAnalyticsFields(data);
      setAnalytics(data);
      setProfile(me);
      const completeness = getProfileCompleteness(me);
      logger.debug("provider-dashboard", "analytics loaded", {
        range,
        bookingsThisMonth: data.bookingsThisMonth,
        averageRating: data.averageRating,
        completionRate: data.bookingPerformance?.completionRate,
        topServices: data.topServices?.length,
        revenueMonths: data.revenueByMonth?.length,
        recentActivity: data.recentActivity?.length,
        profileCompleteness: completeness.percent,
        missing: completeness.missing.map((m) => m.id),
      });
      console.log("[provider-dashboard] loaded", {
        bookings: data.bookingsThisMonth,
        upcoming: data.upcomingBookings,
        completeness: completeness.percent,
        revenueBarPoints: data.revenueByMonth?.length ?? 0,
      });

      try {
        if (me.slug) {
          const reviewList = await getProviderReviews(me.slug);
          setReviews(reviewList);
          logger.debug("provider-dashboard", "reviews loaded", {
            slug: me.slug,
            count: reviewList.length,
          });
        } else {
          logger.warn("provider-dashboard", "profile missing slug; skip reviews");
          setReviews([]);
        }
      } catch (reviewErr) {
        logger.warn("provider-dashboard", "reviews load failed", reviewErr);
        setReviews([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
      logger.error("provider-dashboard", "load failed", e);
      console.log("[provider-dashboard] load failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const completeness = useMemo(
    () => (profile ? getProfileCompleteness(profile) : null),
    [profile],
  );

  if (loading && !analytics) return <LoadingState label="Loading dashboard…" />;
  if (error && !analytics) return <ErrorState message={error} onRetry={load} />;
  if (!analytics) return <EmptyFallback />;

  const bookingsThisMonth = safeNumber(analytics.bookingsThisMonth);
  const upcomingBookings = safeNumber(analytics.upcomingBookings);
  const revenueThisMonth = safeNumber(analytics.revenueThisMonth);
  const completionRate = safeNumber(analytics.bookingPerformance?.completionRate);
  const repeatRate = safeNumber(analytics.customerInsights?.repeatRate);
  const newCustomers = safeNumber(analytics.customerInsights?.newCustomers);
  const returningCustomers = safeNumber(analytics.customerInsights?.returningCustomers);
  const reviewCount = safeNumber(analytics.reviewCount);
  const upcoming = Array.isArray(analytics.upcoming) ? analytics.upcoming : [];
  const topServices = Array.isArray(analytics.topServices) ? analytics.topServices : [];
  const revenueByMonth = Array.isArray(analytics.revenueByMonth) ? analytics.revenueByMonth : [];
  const growthPercent = safeNumber(analytics.customerInsights?.customerGrowthPercent);
  const pendingHint = upcoming.filter((u) => u.status === "pending").length;

  return (
    <Screen
      scroll
      refreshing={refreshing || (loading && Boolean(analytics))}
      onRefresh={() => {
        setRefreshing(true);
        console.log("[provider-dashboard] refresh");
        load();
      }}
      contentStyle={styles.content}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Muted>Provider workspace</Muted>
          <Title style={styles.title}>{profile?.name || "Dashboard"}</Title>
          <Muted>{RANGE_LABELS[range]} overview</Muted>
        </View>
        {profile?.isPremium ? (
          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>PRO</Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rangeRow}
      >
        {RANGES.map((r) => (
          <Chip
            key={r.id}
            label={r.label}
            active={range === r.id}
            onPress={() => {
              if (range === r.id) return;
              logger.info("provider-dashboard", "range change", { from: range, to: r.id });
              console.log("[provider-dashboard] range", r.id);
              setRange(r.id);
            }}
          />
        ))}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {completeness && completeness.percent < 100 ? (
        <Pressable
          style={styles.completeness}
          onPress={() => {
            logger.info("provider-dashboard", "open profile for completeness");
            console.log("[provider-dashboard] completeness → profile");
            router.push("/(provider)/profile");
          }}
        >
          <View style={styles.completenessHead}>
            <Text style={styles.completenessTitle}>
              Profile {completeness.percent}% complete
            </Text>
            <Text style={styles.completenessCta}>Finish</Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(4, completeness.percent)}%` },
              ]}
            />
          </View>
          <Muted style={styles.completenessHint}>
            Missing: {completeness.missing.map((m) => m.label).join(", ")}
          </Muted>
        </Pressable>
      ) : null}

      <View style={styles.kpiGrid}>
        <Kpi label="Bookings" value={String(bookingsThisMonth)} />
        <Kpi label="Upcoming" value={String(upcomingBookings)} accent={pendingHint > 0} />
        <Kpi label="Revenue" value={`$${revenueThisMonth}`} />
        <Kpi
          label="Rating"
          value={`${formatRating(analytics.averageRating)}`}
          hint={`${reviewCount} reviews`}
        />
      </View>

      <View style={styles.sectionHead}>
        <Title style={styles.sectionTitle}>Quick actions</Title>
        {pendingHint > 0 ? (
          <Muted>{pendingHint} pending</Muted>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actionsRow}
      >
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Pressable
              key={action.id}
              style={styles.actionChip}
              onPress={() => {
                logger.info("provider-dashboard", "quick action", { id: action.id });
                console.log("[provider-dashboard] action", action.id);
                router.push(action.href);
              }}
            >
              <View style={styles.actionIcon}>
                <Icon color={colors.text} size={18} strokeWidth={1.75} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sectionHead}>
        <Title style={styles.sectionTitle}>Up next</Title>
        <Pressable
          onPress={() => {
            logger.info("provider-dashboard", "see all bookings");
            router.push("/(provider)/bookings");
          }}
        >
          <Text style={styles.link}>See all</Text>
        </Pressable>
      </View>
      {upcoming.length === 0 ? (
        <Card>
          <Muted>No upcoming bookings.</Muted>
          <Button
            label="Open bookings"
            variant="secondary"
            onPress={() => router.push("/(provider)/bookings")}
          />
        </Card>
      ) : (
        upcoming.slice(0, 4).map((u) => {
          const pending = u.status === "pending";
          return (
            <Pressable
              key={u._id}
              style={[styles.upcomingRow, pending && styles.upcomingPending]}
              onPress={() => {
                logger.debug("provider-dashboard", "open upcoming booking", { id: u._id });
                console.log("[provider-dashboard] open upcoming", u._id);
                router.push({
                  pathname: "/(provider)/bookings/[id]",
                  params: {
                    id: u._id,
                    ...(u.customerName ? { customerName: u.customerName } : {}),
                  },
                });
              }}
            >
              <View style={styles.upcomingTime}>
                <Text style={styles.upcomingTimeText}>
                  {formatBookingTime(u.startsAt)}
                </Text>
                <Text style={styles.upcomingDay}>
                  {new Date(u.startsAt).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
              <View style={styles.upcomingBody}>
                <Text style={styles.upcomingName} numberOfLines={1}>
                  {u.customerName || "Customer"}
                </Text>
                <Text style={styles.upcomingService} numberOfLines={1}>
                  {u.serviceName}
                </Text>
              </View>
              {pending ? (
                <Text style={styles.pendingLabel}>PENDING</Text>
              ) : (
                <View style={styles.confirmedDot} />
              )}
            </Pressable>
          );
        })
      )}

      <Title style={styles.sectionTitle}>Performance</Title>
      <Card style={styles.perfCard}>
        <View style={styles.perfRow}>
          <PerfStat label="Completion" value={`${completionRate}%`} />
          <PerfStat label="Repeat" value={`${repeatRate}%`} />
          <PerfStat label="Growth" value={`${growthPercent}%`} />
        </View>
        <Muted>
          New {newCustomers} · Returning {returningCustomers}
          {analytics.bookingPerformance?.isPremium ? " · Premium" : ""}
        </Muted>
      </Card>

      {revenueByMonth.length > 0 ? (
        <>
          <Title style={styles.sectionTitle}>Revenue</Title>
          <Card>
            <RevenueBarChart data={revenueByMonth} maxBars={6} />
          </Card>
        </>
      ) : null}

      {topServices.length > 0 ? (
        <>
          <Title style={styles.sectionTitle}>Top services</Title>
          {topServices.slice(0, 3).map((s, index) => (
            <View key={s.service} style={styles.serviceRow}>
              <Text style={styles.serviceRank}>{index + 1}</Text>
              <View style={styles.serviceBody}>
                <Text style={styles.serviceName}>{s.service}</Text>
                <Muted>
                  {safeNumber(s.bookings)} bookings · ${safeNumber(s.revenue)}
                </Muted>
              </View>
            </View>
          ))}
        </>
      ) : null}

      <View style={styles.sectionHead}>
        <Title style={styles.sectionTitle}>Reviews</Title>
        <MonoLabel>{reviewCount}</MonoLabel>
      </View>
      {reviews.length === 0 ? (
        <Muted>No reviews yet.</Muted>
      ) : (
        reviews.slice(0, 3).map((r) => (
          <Card key={r._id} style={styles.reviewCard}>
            <Text style={styles.reviewName}>
              {r.userName || "Customer"} · ★ {formatRating(r.rating)}
            </Text>
            <Text style={styles.reviewComment} numberOfLines={2}>
              {r.comment || "No comment"}
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <View style={[styles.kpi, accent && styles.kpiAccent]}>
      <Muted>{label}</Muted>
      <Text style={styles.kpiValue}>{value}</Text>
      {hint ? <Muted style={styles.kpiHint}>{hint}</Muted> : null}
    </View>
  );
}

function PerfStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.perfStat}>
      <Muted>{label}</Muted>
      <Text style={styles.perfValue}>{value}</Text>
    </View>
  );
}

function EmptyFallback() {
  return (
    <Screen>
      <Title>Dashboard</Title>
      <Muted>No analytics yet.</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingTop: 4 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 28 },
  proBadge: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  proBadgeText: {
    color: colors.accentDark,
    fontSize: 11,
    fontFamily: fonts.monoMedium,
    letterSpacing: 0.8,
  },
  rangeRow: { gap: 8, paddingVertical: 2 },
  error: { color: colors.danger, fontSize: 14 },
  completeness: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 14,
    gap: 8,
    backgroundColor: colors.bg,
  },
  completenessHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  completenessTitle: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.serifMedium,
  },
  completenessCta: {
    color: colors.accentDark,
    fontSize: 13,
    fontFamily: fonts.monoMedium,
  },
  completenessHint: { fontSize: 12 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.accent,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kpi: {
    minWidth: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    backgroundColor: colors.bg,
  },
  kpiAccent: {
    borderColor: colors.warning,
  },
  kpiValue: {
    color: colors.text,
    fontSize: 24,
    fontFamily: fonts.serifMedium,
  },
  kpiHint: { fontSize: 11 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionTitle: { fontSize: 20 },
  link: {
    color: colors.accentDark,
    fontSize: 13,
    fontFamily: fonts.monoMedium,
  },
  actionsRow: { gap: 10, paddingVertical: 2 },
  actionChip: {
    width: 84,
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 11,
    fontFamily: fonts.monoMedium,
  },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.bg,
  },
  upcomingPending: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  upcomingTime: { width: 64, gap: 2 },
  upcomingTimeText: {
    color: colors.text,
    fontSize: 13,
    fontFamily: fonts.monoMedium,
  },
  upcomingDay: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fonts.mono,
  },
  upcomingBody: { flex: 1, gap: 2, minWidth: 0 },
  upcomingName: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.serifMedium,
  },
  upcomingService: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.mono,
  },
  pendingLabel: {
    color: colors.warning,
    fontSize: 10,
    letterSpacing: 0.6,
    fontFamily: fonts.monoMedium,
  },
  confirmedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  perfCard: { gap: 12 },
  perfRow: { flexDirection: "row", gap: 8 },
  perfStat: { flex: 1, gap: 2 },
  perfValue: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fonts.serifMedium,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  serviceRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: "center",
    textAlignVertical: "center",
    lineHeight: 28,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    overflow: "hidden",
  },
  serviceBody: { flex: 1, gap: 2 },
  serviceName: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.serifMedium,
  },
  reviewCard: { gap: 4 },
  reviewName: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.serifMedium,
  },
  reviewComment: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
