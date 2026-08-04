import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { listCategories } from "@/src/api/categories";
import { listProviders } from "@/src/api/providers";
import { PortfolioGrid, type PortfolioTile } from "@/src/components/PortfolioGrid";
import { ProviderCard } from "@/src/components/ProviderCard";
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  MonoLabel,
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import type { ProviderListItem, ServiceCategory } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { logger } from "@/src/utils/logger";

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function CustomerHome() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    logger.debug("home", "load");
    try {
      const [cats, featured] = await Promise.all([
        listCategories(),
        listProviders({ featured: true, sort: "rating" }),
      ]);
      setCategories(cats.sort((a, b) => a.sortOrder - b.sortOrder));
      setProviders(featured);
      logger.debug("home", "loaded", {
        categories: cats.length,
        featured: featured.length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load home");
      logger.warn("home", "load failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hero = providers[0];
  const heroUri = (hero?.coverImage || hero?.avatar || "").trim();

  const featuredWork: PortfolioTile[] = useMemo(() => {
    return providers.slice(0, 6).map((p) => ({
      id: p._id,
      image: p.coverImage || p.avatar,
      title: p.name,
      subtitle: p.categorySlug,
    }));
  }, [providers]);

  if (loading) return <LoadingState label="Loading home…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      contentStyle={styles.content}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <MonoLabel>{greetingForNow()}</MonoLabel>
          <Title style={styles.brand}>Barbero</Title>
          <Muted>Book the best beauty & grooming professionals.</Muted>
        </View>
      </View>

      <View style={styles.hero}>
        {heroUri ? (
          <Image source={{ uri: heroUri }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={[styles.heroImage, styles.heroFallback]} />
        )}
        <View style={styles.heroOverlay}>
          <MonoLabel style={{ color: colors.onImage }}>
            {hero?.location.city ? hero.location.city.toUpperCase() : "DISCOVER"}
          </MonoLabel>
          <Text style={styles.heroTitle}>{hero?.name ?? "Featured artists"}</Text>
          {hero ? (
            <Pressable
              style={styles.heroCta}
              onPress={() => {
                logger.debug("home", "hero book", { slug: hero.slug });
                router.push(`/(customer)/book/${hero.slug}`);
              }}
            >
              <Text style={styles.heroCtaText}>Book Now</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {categories.map((c) => (
          <Chip
            key={c.slug}
            label={c.name}
            onPress={() => {
              logger.debug("home", "category chip", { slug: c.slug });
              router.push({ pathname: "/(customer)/search", params: { category: c.slug } });
            }}
          />
        ))}
      </ScrollView>

      <View style={styles.sectionHead}>
        <Title style={styles.sectionTitle}>Our Artists</Title>
        <Pressable
          onPress={() => {
            logger.debug("home", "see all artists");
            router.push("/(customer)/search");
          }}
        >
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>
      {providers.length === 0 ? (
        <EmptyState title="No featured providers" body="Try search to browse everyone." />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.artists}>
          {providers.map((p) => (
            <ProviderCard
              key={p._id}
              provider={p}
              variant="portrait"
              onPress={() => router.push(`/(customer)/provider/${p.slug}`)}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.sectionHead}>
        <Title style={styles.sectionTitle}>Featured Work</Title>
      </View>
      <PortfolioGrid
        items={featuredWork}
        onPressItem={(item) => {
          const match = providers.find((p) => p._id === item.id);
          if (match) router.push(`/(customer)/provider/${match.slug}`);
        }}
      />

      <View style={styles.quickBook}>
        <Title style={styles.sectionTitle}>Quick Book</Title>
        <Muted>Jump into map browse or explore all providers.</Muted>
        <View style={styles.row}>
          <Button label="Open map" variant="secondary" onPress={() => router.push("/(customer)/map")} />
          <Button label="Search all" variant="ghost" onPress={() => router.push("/(customer)/search")} />
        </View>
        {categories.slice(0, 3).map((c) => (
          <Pressable
            key={c.slug}
            style={styles.quickRow}
            onPress={() =>
              router.push({ pathname: "/(customer)/search", params: { category: c.slug } })
            }
          >
            <Text style={styles.quickRowText}>{c.name}</Text>
            <Text style={styles.quickRowMeta}>Book →</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "flex-start" },
  brand: { fontSize: 34, fontFamily: fonts.serif },
  hero: {
    height: 200,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroImage: { width: "100%", height: "100%" },
  heroFallback: { backgroundColor: colors.surfaceAlt },
  heroOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "flex-end",
    padding: 16,
    gap: 6,
    backgroundColor: "rgba(10, 10, 10, 0.38)",
  },
  heroTitle: {
    color: colors.onImage,
    fontSize: 24,
    fontFamily: fonts.serif,
  },
  heroCta: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroCtaText: {
    color: colors.text,
    fontSize: 11,
    fontFamily: fonts.monoMedium,
  },
  chips: { gap: 8, paddingVertical: 2 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 22 },
  seeAll: {
    color: colors.accent,
    fontSize: 12,
    fontFamily: fonts.mono,
  },
  artists: { gap: 10, paddingVertical: 2 },
  quickBook: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  row: { flexDirection: "row", gap: 8 },
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickRowText: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.serifMedium,
  },
  quickRowMeta: {
    color: colors.accent,
    fontSize: 12,
    fontFamily: fonts.mono,
  },
});
