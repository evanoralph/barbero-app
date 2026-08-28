import { formatMoney } from '@/utils/format';
import { router } from "expo-router";
import { CalendarDays, MessageCircle, Search } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { listBookings, updateBookingStatus } from "@/src/api/bookings";
import { getMyProvider } from "@/src/api/providers";
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  MonoLabel,
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import type { Booking, BookingStatus, ProviderProfile } from "@/src/types/api";
import { threadIdForBooking } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import {
  bookingDurationMinutes,
  formatBookingTime,
} from "@/src/utils/bookingDisplay";
import { logger } from "@/src/utils/logger";

const PAGE_SIZE = 20;

type BookingTab = "upcoming" | "pending" | "past";

type DayGroup = {
  key: string;
  label: string;
  bookings: Booking[];
  count: number;
  hours: number;
  revenue: number;
};

type WeekDay = {
  key: string;
  date: Date;
  weekday: string;
  dayNum: string;
  isToday: boolean;
};

const TABS: Array<{ id: BookingTab; label: string }> = [
  { id: "upcoming", label: "Upcoming" },
  { id: "pending", label: "Pending" },
  { id: "past", label: "Past" },
];

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toDayKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "unknown";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildWeekDays(anchor: Date): WeekDay[] {
  const start = startOfLocalDay(anchor);
  // Show a 7-day strip starting Monday of the anchor week.
  const mondayOffset = (start.getDay() + 6) % 7;
  const monday = new Date(start);
  monday.setDate(start.getDate() - mondayOffset);
  const todayKey = toDayKey(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return {
      key: toDayKey(date),
      date,
      weekday: date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase(),
      dayNum: String(date.getDate()),
      isToday: toDayKey(date) === todayKey,
    };
  });
}

function formatDayHeader(dayKey: string, now: Date): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey.toUpperCase();
  const date = new Date(y, m - 1, d);
  const today = startOfLocalDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  const month = date.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
  const dayNum = date.getDate();
  if (toDayKey(date) === toDayKey(today)) {
    return `TODAY ${weekday} ${month} ${dayNum}`;
  }
  if (toDayKey(date) === toDayKey(tomorrow)) {
    return `TOMORROW ${weekday} ${month} ${dayNum}`;
  }
  return `${weekday} ${month} ${dayNum}`;
}

function matchesTab(b: Booking, tab: BookingTab, now: number): boolean {
  const start = new Date(b.startsAt).getTime();
  if (tab === "pending") return b.status === "pending";
  if (tab === "upcoming") {
    return (
      (b.status === "pending" || b.status === "confirmed") &&
      Number.isFinite(start) &&
      start >= now
    );
  }
  return (
    b.status === "completed" ||
    b.status === "cancelled" ||
    (Number.isFinite(start) && start < now)
  );
}

function priceForBooking(
  booking: Booking,
  priceByService: Map<string, number>,
): number {
  const key = booking.serviceName.trim().toLowerCase();
  return priceByService.get(key) ?? 0;
}

export default function ProviderBookingsScreen() {
  const [items, setItems] = useState<Booking[]>([]);
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<BookingTab>("upcoming");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(() => toDayKey(new Date()));
  const [weekAnchor, setWeekAnchor] = useState(() => startOfLocalDay(new Date()));
  const [actingId, setActingId] = useState<string | null>(null);

  const loadPage = useCallback(async (nextPage: number, mode: "replace" | "append") => {
    setError(null);
    logger.debug("provider-bookings", "list", { page: nextPage, mode, limit: PAGE_SIZE });
    console.log("[provider-bookings] list", nextPage, mode);
    try {
      const batch = await listBookings({ limit: PAGE_SIZE, page: nextPage });
      setHasMore(batch.length >= PAGE_SIZE);
      setPage(nextPage);
      setItems((prev) => {
        if (mode === "replace") return batch;
        const seen = new Set(prev.map((b) => b._id));
        const merged = [...prev];
        for (const b of batch) {
          if (!seen.has(b._id)) merged.push(b);
        }
        return merged;
      });
      logger.debug("provider-bookings", "list ok", {
        page: nextPage,
        batch: batch.length,
        hasMore: batch.length >= PAGE_SIZE,
      });
      console.log("[provider-bookings] list ok", batch.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      logger.error("provider-bookings", "list failed", e);
      console.log("[provider-bookings] list failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  const loadProvider = useCallback(async () => {
    try {
      const me = await getMyProvider();
      setProvider(me);
      logger.debug("provider-bookings", "provider profile for prices", {
        services: me.services.length,
      });
    } catch (e) {
      logger.warn("provider-bookings", "provider profile soft-fail", e);
      console.log("[provider-bookings] provider soft-fail");
    }
  }, []);

  useEffect(() => {
    void loadPage(1, "replace");
    void loadProvider();
  }, [loadPage, loadProvider]);

  const priceByService = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of provider?.services ?? []) {
      map.set(s.name.trim().toLowerCase(), s.price);
    }
    return map;
  }, [provider]);

  const pendingCount = useMemo(
    () => items.filter((b) => b.status === "pending").length,
    [items],
  );

  const weekDays = useMemo(() => buildWeekDays(weekAnchor), [weekAnchor]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const q = query.trim().toLowerCase();
    return items
      .filter((b) => matchesTab(b, tab, now))
      .filter((b) => {
        if (!selectedDay) return true;
        return toDayKey(b.startsAt) === selectedDay;
      })
      .filter((b) => {
        if (!q) return true;
        const hay =
          `${b.serviceName} ${b.customer?.name || ""} ${b.customerId} ${b.status}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [items, tab, query, selectedDay]);

  const groups = useMemo((): DayGroup[] => {
    const now = new Date();
    const map = new Map<string, Booking[]>();
    for (const b of filtered) {
      const key = toDayKey(b.startsAt);
      const list = map.get(key) ?? [];
      list.push(b);
      map.set(key, list);
    }
    const keys = [...map.keys()].sort((a, b) => {
      if (tab === "past") return b.localeCompare(a);
      return a.localeCompare(b);
    });
    return keys.map((key) => {
      const bookings = (map.get(key) ?? []).sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
      const minutes = bookings.reduce((sum, b) => sum + bookingDurationMinutes(b), 0);
      const revenue = bookings.reduce(
        (sum, b) => sum + priceForBooking(b, priceByService),
        0,
      );
      return {
        key,
        label: formatDayHeader(key, now),
        bookings,
        count: bookings.length,
        hours: Math.round((minutes / 60) * 10) / 10,
        revenue,
      };
    });
  }, [filtered, priceByService, tab]);

  const setStatus = async (booking: Booking, status: BookingStatus) => {
    setActingId(booking._id);
    setError(null);
    logger.debug("provider-bookings", "quick status", { id: booking._id, status });
    console.log("[provider-bookings] quick status", booking._id, status);
    try {
      const updated = await updateBookingStatus(booking._id, { status });
      setItems((prev) =>
        prev.map((b) =>
          b._id === booking._id
            ? { ...updated, customer: updated.customer ?? b.customer }
            : b,
        ),
      );
      logger.info("provider-bookings", "status updated", { id: booking._id, status });
      console.log("[provider-bookings] status ok", booking._id, status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      logger.error("provider-bookings", "status update failed", e);
      console.log("[provider-bookings] status failed", e);
    } finally {
      setActingId(null);
    }
  };

  const openDetail = (b: Booking) => {
    const customerName = b.customer?.name;
    logger.debug("provider-bookings", "open detail", {
      id: b._id,
      hasCustomer: Boolean(customerName),
    });
    console.log("[provider-bookings] open detail", b._id);
    router.push({
      pathname: "/(provider)/bookings/[id]",
      params: {
        id: b._id,
        ...(customerName ? { customerName } : {}),
      },
    });
  };

  const jumpToToday = () => {
    const today = startOfLocalDay(new Date());
    const key = toDayKey(today);
    logger.debug("provider-bookings", "jump today", { key });
    console.log("[provider-bookings] jump today");
    setWeekAnchor(today);
    setSelectedDay(key);
  };

  const selectedDayStats = useMemo(() => {
    if (!selectedDay || groups.length === 0) return null;
    const group = groups.find((g) => g.key === selectedDay) ?? {
      count: 0,
      hours: 0,
      revenue: 0,
      label: formatDayHeader(selectedDay, new Date()),
    };
    return group;
  }, [groups, selectedDay]);

  const monthLabel = useMemo(() => {
    const d = weekDays[0]?.date ?? new Date();
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [weekDays]);

  const openChat = (b: Booking) => {
    const threadId = threadIdForBooking(b._id);
    logger.info("provider-bookings", "open chat from list", {
      bookingId: b._id,
      threadId,
    });
    console.log("[provider-bookings] open chat", b._id);
    router.push({
      pathname: "/(provider)/messages/[threadId]",
      params: { threadId },
    });
  };

  if (loading) return <LoadingState />;
  if (error && items.length === 0) {
    return <ErrorState message={error} onRetry={() => loadPage(1, "replace")} />;
  }

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        console.log("[provider-bookings] refresh");
        void loadPage(1, "replace");
        void loadProvider();
      }}
      contentStyle={styles.content}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Title style={styles.title}>Bookings</Title>
          <Muted style={styles.monthLabel}>{monthLabel}</Muted>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            hitSlop={10}
            accessibilityLabel="Toggle search"
            onPress={() => {
              setSearchOpen((v) => !v);
              logger.debug("provider-bookings", "toggle search");
              console.log("[provider-bookings] toggle search");
            }}
          >
            <Search color={colors.text} size={22} strokeWidth={1.75} />
          </Pressable>
          <Pressable
            hitSlop={10}
            accessibilityLabel="Jump to today"
            onPress={jumpToToday}
          >
            <CalendarDays color={colors.text} size={22} strokeWidth={1.75} />
          </Pressable>
        </View>
      </View>

      {searchOpen ? (
        <Field
          label="Search"
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            logger.debug("provider-bookings", "search", { q: v });
          }}
          placeholder="Service or customer"
          autoCapitalize="none"
          autoCorrect={false}
        />
      ) : null}

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => {
                setTab(t.id);
                logger.debug("provider-bookings", "tab", { tab: t.id });
                console.log("[provider-bookings] tab", t.id);
              }}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {t.label}
              </Text>
              {t.id === "pending" && pendingCount > 0 ? (
                <View style={[styles.badge, active && styles.badgeOnActive]}>
                  <Text style={[styles.badgeText, active && styles.badgeTextOnActive]}>
                    {pendingCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weekStrip}
      >
        {weekDays.map((d) => {
          const active = selectedDay === d.key;
          return (
            <Pressable
              key={d.key}
              style={[styles.weekDay, active && styles.weekDayActive]}
              onPress={() => {
                const next = selectedDay === d.key ? "" : d.key;
                setSelectedDay(next);
                logger.debug("provider-bookings", "select day", { day: next || "all" });
                console.log("[provider-bookings] select day", next || "all");
              }}
            >
              <Text style={[styles.weekWeekday, active && styles.weekTextActive]}>
                {d.weekday}
              </Text>
              <Text style={[styles.weekDayNum, active && styles.weekTextActive]}>
                {d.dayNum}
              </Text>
              {d.isToday && !active ? <View style={styles.todayDot} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {selectedDay && selectedDayStats ? (
        <View style={styles.dayStatsRow}>
          <View style={styles.dayStats}>
            <View style={styles.dayStat}>
              <Text style={styles.dayStatLabel}>BOOKED</Text>
              <Text style={styles.dayStatValue}>{selectedDayStats.count}</Text>
            </View>
            <View style={styles.dayStat}>
              <Text style={styles.dayStatLabel}>HOURS</Text>
              <Text style={styles.dayStatValue}>{selectedDayStats.hours}</Text>
            </View>
            <View style={styles.dayStat}>
              <Text style={styles.dayStatLabel}>EXPECTED</Text>
              <Text style={styles.dayStatValue}>
                {selectedDayStats.revenue > 0 ? formatMoney(selectedDayStats.revenue) : "—"}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.blockTimeBtn}
            onPress={() => {
              logger.info("provider-bookings", "block time → hours");
              console.log("[provider-bookings] block time");
              router.push("/(provider)/availability");
            }}
          >
            <Text style={styles.blockTimeText}>Block time</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={jumpToToday}
          onLongPress={() => {
            setSelectedDay("");
            console.log("[provider-bookings] clear day filter");
          }}
        >
          <Muted>All days · tap calendar for today</Muted>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {groups.length === 0 ? (
        <EmptyState
          title="No bookings"
          body={
            tab === "pending"
              ? "No pending requests right now."
              : tab === "past"
                ? "No past bookings yet."
                : "Nothing upcoming for this filter."
          }
        />
      ) : (
        groups.map((group) => (
          <View key={group.key} style={styles.group}>
            {!selectedDay ? (
              <View style={styles.groupHead}>
                <MonoLabel>{group.label}</MonoLabel>
                <Text style={styles.groupStats}>
                  {group.count} BOOKED
                  {group.hours > 0 ? ` · ${group.hours} HRS` : ""}
                  {group.revenue > 0 ? ` · ${formatMoney(group.revenue)}` : ""}
                </Text>
              </View>
            ) : null}

            {group.bookings.map((b) => {
              const customerName = b.customer?.name || "Customer";
              const avatarUri = (b.customer?.avatar || "").trim();
              const mins = bookingDurationMinutes(b);
              const price = priceForBooking(b, priceByService);
              const pending = b.status === "pending";
              const confirmed = b.status === "confirmed";
              const canMessage =
                b.status === "confirmed" ||
                b.status === "pending" ||
                b.status === "completed";
              const acting = actingId === b._id;

              return (
                <View
                  key={b._id}
                  style={[
                    styles.rowCard,
                    confirmed && styles.rowCardConfirmed,
                    pending && styles.rowCardPending,
                  ]}
                >
                  <View style={styles.rowMain}>
                    <Pressable style={styles.rowMainPress} onPress={() => openDetail(b)}>
                      <View style={styles.timeCol}>
                        <Text style={styles.timeText}>{formatBookingTime(b.startsAt)}</Text>
                        {mins > 0 ? (
                          <Text style={styles.durationText}>{mins} MIN</Text>
                        ) : null}
                      </View>
                      {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatar, styles.avatarFallback]}>
                          <Text style={styles.avatarLetter}>
                            {customerName.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.rowBody}>
                        <Text style={styles.customerName} numberOfLines={1}>
                          {customerName}
                        </Text>
                        <Text style={styles.serviceName} numberOfLines={1}>
                          {b.serviceName}
                          {price > 0 ? ` · ${formatMoney(price)}` : ""}
                        </Text>
                      </View>
                      {pending ? (
                        <Text style={styles.pendingLabel}>PENDING</Text>
                      ) : !canMessage || (!confirmed && b.status !== "completed") ? (
                        <Text style={styles.pastStatus}>{b.status.toUpperCase()}</Text>
                      ) : (
                        <View style={styles.confirmedDot} />
                      )}
                    </Pressable>
                    {canMessage && (confirmed || b.status === "completed") ? (
                      <Pressable
                        hitSlop={8}
                        accessibilityLabel="Message customer"
                        onPress={() => openChat(b)}
                        style={styles.messageBtn}
                      >
                        <MessageCircle
                          color={colors.textMuted}
                          size={18}
                          strokeWidth={1.75}
                        />
                      </Pressable>
                    ) : null}
                  </View>

                  {pending ? (
                    <View style={styles.quickActions}>
                      <Pressable
                        style={[styles.declineBtn, acting && styles.actionDisabled]}
                        disabled={acting}
                        onPress={() => void setStatus(b, "cancelled")}
                      >
                        <Text style={styles.declineText}>
                          {acting ? "…" : "Decline"}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.acceptBtn, acting && styles.actionDisabled]}
                        disabled={acting}
                        onPress={() => void setStatus(b, "confirmed")}
                      >
                        <Text style={styles.acceptText}>
                          {acting ? "…" : "Accept"}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))
      )}

      {hasMore ? (
        <Button
          label="Load more"
          variant="secondary"
          loading={loadingMore}
          onPress={() => {
            setLoadingMore(true);
            console.log("[provider-bookings] load more", page + 1);
            void loadPage(page + 1, "append");
          }}
        />
      ) : items.length > 0 ? (
        <Muted style={styles.endLabel}>
          {tab === "upcoming"
            ? "END OF UPCOMING"
            : tab === "pending"
              ? "END OF PENDING"
              : "END OF PAST"}
        </Muted>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingTop: 8 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 30 },
  monthLabel: { fontSize: 13 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.monoMedium,
  },
  tabLabelActive: {
    color: colors.text,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.warning,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeOnActive: {
    backgroundColor: colors.warning,
  },
  badgeText: {
    color: colors.bg,
    fontSize: 10,
    fontFamily: fonts.monoMedium,
  },
  badgeTextOnActive: {
    color: colors.bg,
  },
  weekStrip: {
    gap: 8,
    paddingVertical: 2,
  },
  weekDay: {
    width: 52,
    height: 64,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: colors.bg,
  },
  weekDayActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  weekWeekday: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fonts.mono,
  },
  weekDayNum: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.serifMedium,
  },
  weekTextActive: {
    color: colors.onImage,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: 1,
  },
  dayStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  dayStats: {
    flex: 1,
    flexDirection: "row",
    gap: 16,
  },
  dayStat: { gap: 2 },
  dayStatLabel: {
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.6,
    fontFamily: fonts.mono,
  },
  dayStatValue: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.serifMedium,
  },
  blockTimeBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.bg,
  },
  blockTimeText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: fonts.monoMedium,
  },
  group: { gap: 10 },
  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  groupStats: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.mono,
  },
  rowCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.bg,
    overflow: "hidden",
  },
  rowCardConfirmed: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  rowCardPending: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  rowMain: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
  },
  rowMainPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minWidth: 0,
  },
  timeCol: { width: 58, gap: 2 },
  timeText: {
    color: colors.text,
    fontSize: 13,
    fontFamily: fonts.monoMedium,
  },
  durationText: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fonts.mono,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarLetter: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.serifMedium,
  },
  rowBody: { flex: 1, gap: 2, minWidth: 0 },
  customerName: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.serifMedium,
  },
  serviceName: {
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
  messageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
    marginRight: 4,
  },
  pastStatus: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fonts.mono,
  },
  endLabel: {
    textAlign: "center",
    letterSpacing: 0.8,
    fontSize: 11,
    marginTop: 4,
  },
  quickActions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  declineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  declineText: {
    color: colors.text,
    fontSize: 13,
    fontFamily: fonts.monoMedium,
  },
  acceptBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: colors.accent,
  },
  acceptText: {
    color: colors.text,
    fontSize: 13,
    fontFamily: fonts.monoMedium,
  },
  actionDisabled: { opacity: 0.5 },
  error: { color: colors.danger, fontSize: 14 },
});
