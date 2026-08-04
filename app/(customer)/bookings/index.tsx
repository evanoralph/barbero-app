import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { listBookings } from "@/src/api/bookings";
import { BookingCard } from "@/src/components/BookingCard";
import {
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import type { Booking } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

type Tab = "upcoming" | "past" | "all";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "all", label: "All" },
];

function matchesTab(b: Booking, tab: Tab): boolean {
  if (tab === "all") return true;
  if (tab === "upcoming") return b.status === "pending" || b.status === "confirmed";
  return b.status === "completed" || b.status === "cancelled";
}

export default function CustomerBookingsScreen() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("upcoming");

  const load = useCallback(async () => {
    setError(null);
    logger.debug("bookings", "list");
    try {
      const data = await listBookings();
      setItems(data);
      logger.info("bookings", "list ok", { count: data.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bookings");
      logger.error("bookings", "list failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => items.filter((b) => matchesTab(b, tab)),
    [items, tab],
  );

  if (loading) return <LoadingState />;
  if (error && items.length === 0) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load();
      }}
    >
      <Title>Your bookings</Title>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {TABS.map((t) => (
          <Chip
            key={t.id}
            label={t.label}
            active={tab === t.id}
            onPress={() => {
              setTab(t.id);
              logger.debug("bookings", "tab", { tab: t.id });
            }}
          />
        ))}
      </View>
      <Muted>
        {filtered.length} {tab === "all" ? "total" : tab}
      </Muted>
      {filtered.length === 0 ? (
        <EmptyState
          title="No bookings"
          body={
            tab === "upcoming"
              ? "No upcoming appointments. Find a provider and book a service."
              : "Nothing in this list yet."
          }
        />
      ) : (
        filtered.map((b) => (
          <BookingCard
            key={b._id}
            booking={b}
            onPress={() => {
              logger.debug("bookings", "open detail", { id: b._id });
              router.push(`/(customer)/bookings/${b._id}`);
            }}
          />
        ))
      )}
    </Screen>
  );
}
