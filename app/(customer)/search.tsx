import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { listProviders } from "@/src/api/providers";
import { ProviderCard } from "@/src/components/ProviderCard";
import { ProvidersMapView } from "@/src/components/ProvidersMapView";
import {
  Chip,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  MonoLabel,
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import type { ProviderListItem } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { logger } from "@/src/utils/logger";

const CATEGORIES = ["", "barber", "tattoo", "nails", "salon"] as const;

type ViewMode = "list" | "map";

export default function SearchScreen() {
  const params = useLocalSearchParams<{ category?: string; q?: string }>();
  const [q, setQ] = useState(typeof params.q === "string" ? params.q : "");
  const [category, setCategory] = useState(typeof params.category === "string" ? params.category : "");
  const [sort, setSort] = useState<"rating" | "name" | "newest">("rating");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [items, setItems] = useState<ProviderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    logger.debug("search", "load", { q, category, sort });
    try {
      const data = await listProviders({
        q: q.trim() || undefined,
        category: category || undefined,
        sort,
      });
      setItems(data);
      logger.debug("search", "results", { count: data.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      logger.warn("search", "load failed", e);
    } finally {
      setLoading(false);
    }
  }, [q, category, sort]);

  useEffect(() => {
    if (viewMode !== "list") return;
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load, viewMode]);

  useEffect(() => {
    if (typeof params.category === "string") setCategory(params.category);
    if (typeof params.q === "string") setQ(params.q);
  }, [params.category, params.q]);

  const switchMode = useCallback((mode: ViewMode) => {
    logger.debug("search", "viewMode", { mode, category });
    setViewMode(mode);
  }, [category]);

  if (viewMode === "map") {
    return (
      <View style={styles.mapScreen}>
        <View style={styles.mapHeader}>
          <Title>Explore</Title>
          <ViewModeToggle mode={viewMode} onChange={switchMode} />
        </View>
        <View style={styles.mapBody}>
          <ProvidersMapView
            category={category}
            onCategoryChange={setCategory}
            showCategoryChips
          />
        </View>
      </View>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.listHeader}>
        <View style={styles.titleBlock}>
          <Title>Explore</Title>
          <Muted>Browse artists by style, category, or name.</Muted>
        </View>
        <ViewModeToggle mode={viewMode} onChange={switchMode} />
      </View>
      <Field
        label="Search"
        placeholder="Search styles, tags..."
        value={q}
        onChangeText={setQ}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <MonoLabel>Category</MonoLabel>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c || "all"}
            label={c || "All"}
            active={category === c}
            onPress={() => {
              logger.debug("search", "category", { c });
              setCategory(c);
            }}
          />
        ))}
      </View>

      <MonoLabel>Sort</MonoLabel>
      <View style={styles.chips}>
        {(["rating", "name", "newest"] as const).map((s) => (
          <Chip key={s} label={s} active={sort === s} onPress={() => setSort(s)} />
        ))}
      </View>

      {loading ? <LoadingState label="Searching…" /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="No results found" body="Try another category or query." />
      ) : null}
      <View style={styles.list}>
        {items.map((p) => (
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  list: { gap: 12 },
  mapScreen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  mapHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
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
