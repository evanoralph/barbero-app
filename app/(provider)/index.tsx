import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { getMyAnalytics, getMyProvider, getProviderReviews } from "@/src/api/providers";
import {
  Button,
  Card,
  Chip,
  ErrorState,
  LoadingState,
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
import { formatRating, safeNumber } from "@/src/utils/format";
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
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  if (loading && !analytics) return <LoadingState label="Loading dashboard…" />;
  if (error && !analytics) return <ErrorState message={error} onRetry={load} />;
  if (!analytics) return <EmptyFallback />;

  const bookingsThisMonth = safeNumber(analytics.bookingsThisMonth);
  const upcomingBookings = safeNumber(analytics.upcomingBookings);
  const revenueThisMonth = safeNumber(analytics.revenueThisMonth);
  const revenueTotal = safeNumber(analytics.revenueTotal);
  const totalBookings = safeNumber(analytics.totalBookings);
  const completedBookings = safeNumber(analytics.completedBookings);
  const cancelledBookings = safeNumber(analytics.cancelledBookings);
  const completionRate = safeNumber(analytics.bookingPerformance?.completionRate);
  const repeatRate = safeNumber(analytics.customerInsights?.repeatRate);
  const newCustomers = safeNumber(analytics.customerInsights?.newCustomers);
  const returningCustomers = safeNumber(analytics.customerInsights?.returningCustomers);
  const reviewCount = safeNumber(analytics.reviewCount);
  const upcoming = Array.isArray(analytics.upcoming) ? analytics.upcoming : [];
  const topServices = Array.isArray(analytics.topServices) ? analytics.topServices : [];
  const revenueByMonth = Array.isArray(analytics.revenueByMonth) ? analytics.revenueByMonth : [];
  const bookingsByMonth = Array.isArray(analytics.bookingsByMonth) ? analytics.bookingsByMonth : [];
  const recentActivity = Array.isArray(analytics.recentActivity) ? analytics.recentActivity : [];
  const maxRevenue = Math.max(1, ...revenueByMonth.map((r) => safeNumber(r.revenue)));
  const completeness = profile ? getProfileCompleteness(profile) : null;
  const growthPercent = safeNumber(analytics.customerInsights?.customerGrowthPercent);
  const promotionCount = safeNumber(analytics.bookingPerformance?.promotionCount);

  return (
    <Screen
      scroll
      refreshing={refreshing || (loading && Boolean(analytics))}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <Title>Dashboard</Title>
      <Muted>{RANGE_LABELS[range]} overview</Muted>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {RANGES.map((r) => (
          <Chip
            key={r.id}
            label={r.label}
            active={range === r.id}
            onPress={() => {
              if (range === r.id) return;
              logger.info("provider-dashboard", "range change", { from: range, to: r.id });
              setRange(r.id);
            }}
          />
        ))}
      </View>
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

      {completeness && completeness.percent < 100 ? (
        <Card>
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Profile completeness · {completeness.percent}%
          </Text>
          <View
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.border,
              overflow: "hidden",
              marginTop: 6,
            }}
          >
            <View
              style={{
                width: `${Math.max(4, completeness.percent)}%`,
                height: "100%",
                backgroundColor: colors.accent,
              }}
            />
          </View>
          <Muted>
            Missing: {completeness.missing.map((m) => m.label).join(", ") || "None"}
          </Muted>
          <Button
            label="Complete profile"
            variant="secondary"
            onPress={() => {
              logger.info("provider-dashboard", "open profile for completeness");
              router.push("/(provider)/profile");
            }}
          />
        </Card>
      ) : completeness ? (
        <Card>
          <Muted>Profile completeness · 100%</Muted>
        </Card>
      ) : null}

      <Title>Quick actions</Title>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <View style={{ flexGrow: 1, minWidth: "45%" }}>
          <Button
            label="Add service"
            variant="secondary"
            onPress={() => {
              logger.info("provider-dashboard", "open services");
              router.push("/(provider)/services");
            }}
          />
        </View>
        <View style={{ flexGrow: 1, minWidth: "45%" }}>
          <Button
            label="Portfolio"
            variant="secondary"
            onPress={() => {
              logger.info("provider-dashboard", "open portfolio");
              router.push("/(provider)/portfolio");
            }}
          />
        </View>
        <View style={{ flexGrow: 1, minWidth: "45%" }}>
          <Button
            label="Edit hours"
            variant="secondary"
            onPress={() => router.push("/(provider)/availability")}
          />
        </View>
        <View style={{ flexGrow: 1, minWidth: "45%" }}>
          <Button
            label="Inbox"
            variant="secondary"
            onPress={() => router.push("/(provider)/messages")}
          />
        </View>
        <View style={{ flexGrow: 1, minWidth: "45%" }}>
          <Button
            label="Manage plan"
            variant="secondary"
            onPress={() => router.push("/(provider)/subscription")}
          />
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Kpi label="Bookings (period)" value={String(bookingsThisMonth)} />
        <Kpi label="Upcoming" value={String(upcomingBookings)} />
        <Kpi label="Revenue (period)" value={`$${revenueThisMonth}`} />
        <Kpi label="Revenue total" value={`$${revenueTotal}`} />
        <Kpi label="Rating" value={`${formatRating(analytics.averageRating)} (${reviewCount})`} />
        <Kpi label="Completion" value={`${completionRate}%`} />
        <Kpi label="Repeat rate" value={`${repeatRate}%`} />
        <Kpi label="Total bookings" value={String(totalBookings)} />
      </View>

      <Title>Performance</Title>
      <Card>
        <Muted>
          Completed {completedBookings} · Cancelled {cancelledBookings} · New customers{" "}
          {newCustomers} · Returning {returningCustomers}
        </Muted>
        <Muted>
          Customer growth {growthPercent}% · Promotions {promotionCount}
        </Muted>
        {analytics.bookingPerformance?.isPremium ? (
          <Muted>Plan: Premium{analytics.bookingPerformance.isFeatured ? " · Featured" : ""}</Muted>
        ) : (
          <Muted>Plan: Free / Pro</Muted>
        )}
      </Card>

      {revenueByMonth.length > 0 ? (
        <>
          <Title>Revenue by month</Title>
          <Card>
            {revenueByMonth.slice(-6).map((row) => {
              const revenue = safeNumber(row.revenue);
              const bookings = safeNumber(
                bookingsByMonth.find((b) => b.month === row.month)?.count,
              );
              const widthPct = Math.max(4, Math.round((revenue / maxRevenue) * 100));
              return (
                <View key={row.month} style={{ gap: 4, marginBottom: 8 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Muted>{row.month}</Muted>
                    <Muted>
                      ${revenue} · {safeNumber(bookings)} bookings
                    </Muted>
                  </View>
                  <View
                    style={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.border,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: `${widthPct}%`,
                        height: "100%",
                        backgroundColor: colors.accent,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      {topServices.length > 0 ? (
        <>
          <Title>Top services</Title>
          {topServices.slice(0, 5).map((s) => (
            <Card key={s.service}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{s.service}</Text>
              <Muted>
                {safeNumber(s.bookings)} bookings · ${safeNumber(s.revenue)}
              </Muted>
            </Card>
          ))}
        </>
      ) : null}

      <Title>Upcoming</Title>
      {upcoming.length === 0 ? (
        <Muted>No upcoming bookings.</Muted>
      ) : (
        upcoming.slice(0, 5).map((u) => (
          <Pressable
            key={u._id}
            onPress={() => {
              logger.debug("provider-dashboard", "open upcoming booking", { id: u._id });
              router.push({
                pathname: "/(provider)/bookings/[id]",
                params: {
                  id: u._id,
                  ...(u.customerName ? { customerName: u.customerName } : {}),
                },
              });
            }}
          >
            <Card>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{u.serviceName}</Text>
              <Muted>
                {u.customerName || u.customerId} · {u.status} ·{" "}
                {new Date(u.startsAt).toLocaleString()}
              </Muted>
            </Card>
          </Pressable>
        ))
      )}

      {recentActivity.length > 0 ? (
        <>
          <Title>Recent activity</Title>
          {recentActivity.slice(0, 5).map((a) => (
            <Card key={a.id}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{a.service}</Text>
              <Muted>
                {a.status} · ${safeNumber(a.amount)} · {new Date(a.date).toLocaleString()}
              </Muted>
            </Card>
          ))}
        </>
      ) : null}

      <Title>Reviews</Title>
      {reviews.length === 0 ? (
        <Muted>No reviews yet.</Muted>
      ) : (
        reviews.slice(0, 5).map((r) => (
          <Card key={r._id}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {r.userName || "Customer"} · ★ {formatRating(r.rating)}
            </Text>
            <Muted>{r.comment || "No comment"}</Muted>
            <Muted>{new Date(r.createdAt).toLocaleDateString()}</Muted>
          </Card>
        ))
      )}
    </Screen>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ minWidth: "45%", flexGrow: 1 }}>
      <Muted>{label}</Muted>
      <Text style={{ color: colors.accent, fontSize: 22, fontWeight: "800" }}>{value}</Text>
    </Card>
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
