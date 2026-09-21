import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScrollView } from "react-native";
import { listBookings } from "@/src/api/bookings";
import { BookingCard } from "@/src/components/BookingCard";
import {
  Chip,
  EmptyState,
  ErrorState,
  OfflineState,
  Screen,
  SegmentedControl,
  Skeleton,
  StaleBadge,
  Title,
} from "@/src/components/ui";
import { savedAgoLabel, updatedAgoLabel } from "@/src/offline/cache";
import { useCachedQuery } from "@/src/offline/useCachedQuery";
import type { Booking } from "@/src/types/api";
import { SERVICE_TYPES, serviceType } from "@/src/utils/serviceType";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { logger } from "@/src/utils/logger";

type Tab = "upcoming" | "past" | "cancelled";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
];

const EMPTY_BODY: Record<Tab, string> = {
  upcoming: "No upcoming appointments. Find a provider and book a service.",
  past: "Completed appointments show up here.",
  cancelled: "Nothing cancelled.",
};

function matchesTab(b: Booking, tab: Tab): boolean {
  if (tab === "upcoming") return b.status === "pending" || b.status === "confirmed";
  if (tab === "past") return b.status === "completed";
  return b.status === "cancelled";
}

const ALL_SERVICES = "All services";

export default function CustomerBookingsScreen() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [service, setService] = useState(ALL_SERVICES);

  const query = useCachedQuery<Booking[]>({
    key: "bookings:customer",
    fetcher: async () => {
      logger.debug("bookings", "list");
      const data = await listBookings();
      logger.info("bookings", "list ok", { count: data.length });
      return data;
    },
  });
  const items = query.data ?? [];

  const inTab = useMemo(() => items.filter((b) => matchesTab(b, tab)), [items, tab]);
  const serviceOptions = useMemo(() => {
    const present = new Set(inTab.map((b) => serviceType(b.serviceName)));
    return [ALL_SERVICES, ...SERVICE_TYPES.filter((s) => present.has(s))];
  }, [inTab]);
  // A selection that no longer exists in this tab falls back to "all".
  const activeService = serviceOptions.includes(service) ? service : ALL_SERVICES;
  const filtered = useMemo(
    () =>
      activeService === ALL_SERVICES
        ? inTab
        : inTab.filter((b) => serviceType(b.serviceName) === activeService),
    [inTab, activeService],
  );

  return (
    <Screen scroll refreshing={query.refreshing} onRefresh={query.refresh}>
      <Title>Your bookings</Title>
      <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      {serviceOptions.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          style={styles.railWrap}
        >
          {serviceOptions.map((s) => (
            <Chip key={s} label={s} active={activeService === s} onPress={() => setService(s)} />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.countRow}>
        <Text style={styles.count}>{query.data ? `${filtered.length} ${tab}` : " "}</Text>
        {query.stale ? (
          <StaleBadge label={savedAgoLabel(query.savedAt)} />
        ) : query.savedAt ? (
          <Text style={styles.updated}>{updatedAgoLabel(query.savedAt)}</Text>
        ) : null}
      </View>

      {query.loading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={styles.skeleton} />
          ))}
        </View>
      ) : null}

      {query.error && query.offline ? <OfflineState onRetry={query.refetch} /> : null}
      {query.error && !query.offline ? <ErrorState message={query.error} onRetry={query.refetch} /> : null}

      {query.data && filtered.length === 0 ? (
        <EmptyState title="No bookings" body={EMPTY_BODY[tab]} />
      ) : null}

      <View style={[styles.list, query.refetching && styles.dimmed]}>
        {filtered.map((b) => (
          <BookingCard
            key={b._id}
            booking={b}
            onPress={() => {
              logger.debug("bookings", "open detail", { id: b._id });
              router.push(`/(customer)/bookings/${b._id}`);
            }}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Rail bleeds to the screen edge like the design's overflow-hidden chip row.
  railWrap: { marginHorizontal: -20, flexGrow: 0 },
  rail: { paddingHorizontal: 20, gap: 8 },
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  count: { color: colors.textMuted, fontSize: 14, fontFamily: fonts.mono },
  updated: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.mono },
  list: { gap: 12 },
  dimmed: { opacity: 0.45 },
  skeleton: { height: 104, borderWidth: 1, borderColor: colors.border },
});
