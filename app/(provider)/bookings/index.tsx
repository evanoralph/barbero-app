import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { listBookings } from "@/src/api/bookings";
import { BookingCard } from "@/src/components/BookingCard";
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import type { Booking } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

const PAGE_SIZE = 20;

type BookingTab = "all" | "pending" | "confirmed" | "upcoming" | "past";

const TABS: Array<{ id: BookingTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
];

function matchesTab(b: Booking, tab: BookingTab, now: number): boolean {
  if (tab === "all") return true;
  if (tab === "pending") return b.status === "pending";
  if (tab === "confirmed") return b.status === "confirmed";
  if (tab === "upcoming") {
    return (
      (b.status === "pending" || b.status === "confirmed") &&
      new Date(b.startsAt).getTime() >= now
    );
  }
  // past
  return (
    b.status === "completed" ||
    b.status === "cancelled" ||
    new Date(b.startsAt).getTime() < now
  );
}

export default function ProviderBookingsScreen() {
  const [items, setItems] = useState<Booking[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<BookingTab>("all");
  const [query, setQuery] = useState("");

  const loadPage = useCallback(async (nextPage: number, mode: "replace" | "append") => {
    setError(null);
    logger.debug("provider-bookings", "list", { page: nextPage, mode, limit: PAGE_SIZE });
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      logger.error("provider-bookings", "list failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadPage(1, "replace");
  }, [loadPage]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const q = query.trim().toLowerCase();
    return items.filter((b) => {
      if (!matchesTab(b, tab, now)) return false;
      if (!q) return true;
      const hay = `${b.serviceName} ${b.customer?.name || ""} ${b.customerId} ${b.status}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, tab, query]);

  if (loading) return <LoadingState />;
  if (error && items.length === 0) return <ErrorState message={error} onRetry={() => loadPage(1, "replace")} />;

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadPage(1, "replace");
      }}
    >
      <Title>Bookings</Title>
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
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {TABS.map((t) => (
          <Chip
            key={t.id}
            label={t.label}
            active={tab === t.id}
            onPress={() => {
              setTab(t.id);
              logger.debug("provider-bookings", "tab", { tab: t.id });
            }}
          />
        ))}
      </View>
      <Muted>
        Showing {filtered.length} of {items.length} loaded
      </Muted>
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {filtered.length === 0 ? (
        <EmptyState title="No bookings" body="Try another tab or load more." />
      ) : (
        filtered.map((b) => (
          <BookingCard
            key={b._id}
            booking={b}
            subtitle={b.customer?.name || b.customerId}
            onPress={() => {
              const customerName = b.customer?.name;
              logger.debug("provider-bookings", "open detail", {
                id: b._id,
                hasCustomer: Boolean(customerName),
              });
              router.push({
                pathname: "/(provider)/bookings/[id]",
                params: {
                  id: b._id,
                  ...(customerName ? { customerName } : {}),
                },
              });
            }}
          />
        ))
      )}
      {hasMore ? (
        <Button
          label="Load more"
          variant="secondary"
          loading={loadingMore}
          onPress={() => {
            setLoadingMore(true);
            loadPage(page + 1, "append");
          }}
        />
      ) : items.length > 0 ? (
        <Muted>End of list</Muted>
      ) : null}
    </Screen>
  );
}
