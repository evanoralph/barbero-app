import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { listProviders } from "@/src/api/providers";
import { FilterSheet } from "@/src/components/FilterSheet";
import { ProviderCard } from "@/src/components/ProviderCard";
import { ProvidersMapView } from "@/src/components/ProvidersMapView";
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  FilterButton,
  Muted,
  OfflineState,
  Screen,
  SearchField,
  Skeleton,
  SpinnerRow,
  StaleBadge,
  Title,
} from "@/src/components/ui";
import { useUserCoords } from "@/src/hooks/useUserCoords";
import { savedAgoLabel, updatedAgoLabel } from "@/src/offline/cache";
import { useCachedQuery } from "@/src/offline/useCachedQuery";
import type { ProviderListItem } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import {
  ANY_DISTANCE_KM,
  DEFAULT_FILTERS,
  activeFilterCount,
  appliedChips,
  clearFilter,
  filterProviders,
  type ExploreFilters,
} from "@/src/utils/exploreFilters";
import {
  getDiscoveryLocation,
  type DiscoveryLocation,
} from "@/src/utils/discoveryLocation";
import { distanceKm, type UserCoords } from "@/src/utils/location";
import { logger } from "@/src/utils/logger";
import { recordSearch } from "@/src/utils/recentlyViewed";

type ViewMode = "list" | "map";

const PAGE_SIZE = 10;
const MAX_APPLIED_CHIPS = 2;
/** Default Explore radius when the user has a saved discovery location. */
const EXPLORE_NEAR_KM = 15;

export default function SearchScreen() {
  const params = useLocalSearchParams<{
    category?: string;
    q?: string;
    /** "1" = start with a 5 km distance filter (Home "Near me"). */
    near?: string;
    /** "today" | "week" preset (Home "Open today"). */
    avail?: string;
  }>();
  const [q, setQ] = useState(typeof params.q === "string" ? params.q : "");
  const [filters, setFilters] = useState<ExploreFilters>({
    ...DEFAULT_FILTERS,
    category: typeof params.category === "string" ? params.category : "",
    // Prefer nearby by default so Explore matches the user's saved area (not global).
    distanceKm:
      params.near === "1"
        ? 5
        : EXPLORE_NEAR_KM,
    availability: params.avail === "today" || params.avail === "week" ? params.avail : "any",
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [discovery, setDiscovery] = useState<DiscoveryLocation | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const discoveryLoggedRef = useRef(false);

  const needsGps =
    sheetOpen ||
    (filters.distanceKm < ANY_DISTANCE_KM && !discovery);
  const gpsCoords = useUserCoords(needsGps);
  const coords: UserCoords | null = discovery
    ? { lat: discovery.lat, lng: discovery.lng }
    : gpsCoords;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getDiscoveryLocation().then((saved) => {
        if (cancelled) return;
        setDiscovery(saved);
        setLocationReady(true);
        if (saved && !discoveryLoggedRef.current) {
          discoveryLoggedRef.current = true;
          logger.debug("search", "using saved discovery location", {
            label: saved.label,
            source: saved.source,
            distanceKm: EXPLORE_NEAR_KM,
          });
          console.log(
            "[search] discovery location → filter near",
            saved.label,
            `${EXPLORE_NEAR_KM}km`,
          );
        } else if (!saved) {
          console.log("[search] no discovery location — distance filter needs GPS");
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // One cached result set per query text; category, price and distance narrow it locally so
  // the sheet can show live counts without a request (only "Show" commits).
  const availability = filters.availability === "any" ? undefined : filters.availability;
  const query = useCachedQuery<ProviderListItem[]>({
    key: `providers:list:${q.trim().toLowerCase()}:${availability ?? "any"}`,
    debounceMs: 250,
    fetcher: () => {
      logger.debug("search", "load", { q, availability });
      return listProviders({ q: q.trim() || undefined, sort: "rating", availability });
    },
  });

  const results = useMemo(() => {
    // Don't flash the global list while we still need coords for a near filter.
    if (filters.distanceKm < ANY_DISTANCE_KM && !coords) {
      if (locationReady) {
        console.log("[search] near filter active but no coords yet");
      }
      return [];
    }
    const filtered = query.data ? filterProviders(query.data, filters, coords) : [];
    if (!coords) {
      console.log("[search] results (no coords filter)", filtered.length);
      return filtered;
    }
    const sorted = [...filtered].sort(
      (a, b) =>
        distanceKm(coords, { lat: a.location.lat, lng: a.location.lng }) -
        distanceKm(coords, { lat: b.location.lat, lng: b.location.lng }),
    );
    console.log("[search] results near location", {
      label: discovery?.label,
      distanceKm: filters.distanceKm,
      count: sorted.length,
      totalUnfiltered: query.data?.length ?? 0,
    });
    return sorted;
  }, [query.data, filters, coords, discovery?.label, locationReady]);

  const shown = results.slice(0, visibleCount);
  const filterCount = activeFilterCount(filters);
  const chips = appliedChips(filters);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [q, filters]);

  // Remember searches that actually returned (feeds Home's suggestion chips).
  useEffect(() => {
    if (!q.trim() || !query.data) return;
    const t = setTimeout(() => void recordSearch(q), 800);
    return () => clearTimeout(t);
  }, [q, query.data]);

  useEffect(() => {
    setFilters((f) => {
      const next = typeof params.category === "string" ? params.category : f.category;
      return next === f.category ? f : { ...f, category: next };
    });
    if (typeof params.q === "string") setQ(params.q);
  }, [params.category, params.q]);

  const countFor = useCallback(
    (draft: ExploreFilters) => (query.data ? filterProviders(query.data, draft, coords).length : null),
    [query.data, coords],
  );

  const applyFilters = useCallback((next: ExploreFilters) => {
    logger.debug("search", "apply filters", next);
    console.log("[search] apply filters", next);
    setFilters(next);
    setSheetOpen(false);
  }, []);

  const switchMode = useCallback(
    (mode: ViewMode) => {
      logger.debug("search", "viewMode", { mode, category: filters.category });
      console.log("[search] viewMode", mode);
      setViewMode(mode);
    },
    [filters.category],
  );

  if (viewMode === "map") {
    return (
      <View style={styles.mapScreen}>
        <View style={styles.mapHeader}>
          <View style={styles.mapHeaderRow}>
            <Title>Explore</Title>
            <ViewModeToggle mode={viewMode} onChange={switchMode} />
          </View>
          {discovery?.label ? (
            <Muted style={styles.nearHint}>Near {discovery.label}</Muted>
          ) : null}
        </View>
        <View style={styles.mapBody}>
          <ProvidersMapView
            filters={filters}
            onFiltersChange={setFilters}
            centerOnUser={Boolean(coords)}
            userCoordinate={coords}
            showsUserLocation={discovery?.source === "gps"}
          />
        </View>
      </View>
    );
  }

  const statusRight = query.refetching || query.refreshing ? (
    <Text style={styles.updated}>Refreshing</Text>
  ) : query.stale ? (
    <StaleBadge label={savedAgoLabel(query.savedAt)} />
  ) : query.savedAt ? (
    <View style={styles.updatedRow}>
      <View style={styles.dot} />
      <Text style={styles.updated}>{updatedAgoLabel(query.savedAt)}</Text>
    </View>
  ) : null;

  return (
    <Screen
      scroll
      refreshing={query.refreshing}
      onRefresh={query.refresh}
      contentStyle={styles.content}
    >
      <View style={styles.listHeader}>
        <View style={styles.titleBlock}>
          <Title>Explore</Title>
          <Muted>
            {discovery?.label
              ? `Artists near ${discovery.label}`
              : "Browse artists by style, category, or name."}
          </Muted>
        </View>
        <ViewModeToggle mode={viewMode} onChange={switchMode} />
      </View>

      <View style={styles.searchRow}>
        <SearchField value={q} onChangeText={setQ} placeholder="Search styles, tags…" />
        <FilterButton count={filterCount} onPress={() => setSheetOpen(true)} />
      </View>

      {chips.length > 0 ? (
        <View style={styles.appliedRow}>
          {chips.slice(0, MAX_APPLIED_CHIPS).map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              active
              onRemove={() => setFilters((f) => clearFilter(f, c.key))}
            />
          ))}
          {chips.length > MAX_APPLIED_CHIPS ? (
            <Chip label={`+${chips.length - MAX_APPLIED_CHIPS} more`} onPress={() => setSheetOpen(true)} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.countRow}>
        <Text style={styles.count}>
          {query.data ? `${results.length} artist${results.length === 1 ? "" : "s"}` : "Searching…"}
        </Text>
        {filterCount > 0 ? (
          <Pressable
            hitSlop={10}
            onPress={() => {
              const next = {
                ...DEFAULT_FILTERS,
                // Keep exploring near the saved area after clearing other filters.
                distanceKm: discovery ? EXPLORE_NEAR_KM : DEFAULT_FILTERS.distanceKm,
              };
              console.log("[search] clear all filters", next);
              setFilters(next);
            }}
          >
            <Text style={styles.clearAll}>Clear all</Text>
          </Pressable>
        ) : (
          statusRight
        )}
      </View>
      {filterCount > 0 && statusRight ? <View style={styles.statusLine}>{statusRight}</View> : null}

      {query.refetching ? <SpinnerRow label="Refining results…" /> : null}

      {query.loading || (!locationReady && filters.distanceKm < ANY_DISTANCE_KM) ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={styles.skeletonCard} />
          ))}
        </View>
      ) : null}

      {query.error && query.offline ? <OfflineState onRetry={query.refetch} /> : null}
      {query.error && !query.offline ? <ErrorState message={query.error} onRetry={query.refetch} /> : null}

      {query.data && locationReady && results.length === 0 ? (
        <EmptyState
          title="No artists nearby"
          body={
            discovery?.label
              ? `Nothing within ${filters.distanceKm < ANY_DISTANCE_KM ? `${filters.distanceKm} km` : "range"} of ${discovery.label}. Try a larger distance in Filters, or search another area from Home.`
              : filterCount > 0
                ? "Try loosening a filter."
                : "Try another category or query."
          }
        />
      ) : null}

      <View style={[styles.list, query.refetching && styles.dimmed]}>
        {shown.map((p) => (
          <ProviderCard
            key={p._id}
            provider={p}
            onPress={() => {
              logger.debug("search", "open provider", { slug: p.slug });
              router.push(`/(customer)/provider/${p.slug}`);
            }}
          />
        ))}
      </View>

      {results.length > shown.length ? (
        <Button
          label="Load more"
          variant="secondary"
          onPress={() => setVisibleCount((n) => n + PAGE_SIZE)}
        />
      ) : null}
      {results.length > PAGE_SIZE ? (
        <Text style={styles.pageNote}>
          Showing {shown.length} of {results.length} · pull to refresh
        </Text>
      ) : null}

      <FilterSheet
        visible={sheetOpen}
        filters={filters}
        countFor={countFor}
        hasLocation={coords !== null}
        onApply={applyFilters}
        onClose={() => setSheetOpen(false)}
      />
    </Screen>
  );
}

function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <View style={styles.toggle}>
      {(["list", "map"] as const).map((m) => {
        const active = mode === m;
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            style={[styles.toggleBtn, active && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
              {m === "list" ? "List" : "Map"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  listHeader: { gap: 12 },
  titleBlock: { gap: 6 },
  nearHint: { marginTop: 4 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  appliedRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  count: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  clearAll: { color: colors.accentDark, fontSize: 11, fontFamily: fonts.mono },
  statusLine: { flexDirection: "row" },
  updatedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: colors.success },
  updated: { color: colors.textMuted, fontSize: 10, fontFamily: fonts.mono },
  list: { gap: 12 },
  dimmed: { opacity: 0.45 },
  skeletonCard: { height: 180, borderWidth: 1, borderColor: colors.border },
  pageNote: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.mono,
    paddingTop: 2,
  },
  mapScreen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  mapHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  mapHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  mapBody: {
    flex: 1,
  },
  toggle: {
    flexDirection: "row",
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleText: {
    fontSize: 12,
    fontFamily: fonts.mono,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  toggleTextActive: {
    color: colors.text,
    fontFamily: fonts.monoMedium,
  },
});
