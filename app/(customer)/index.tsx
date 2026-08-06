import { router } from "expo-router";
import { Bell, ChevronRight, MapPin, Search, Star } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getAccountMe } from "@/src/api/account";
import { listBookings } from "@/src/api/bookings";
import { listCategories } from "@/src/api/categories";
import { listProviders } from "@/src/api/providers";
import { useSession } from "@/src/auth/session";
import { PortfolioGrid, type PortfolioTile } from "@/src/components/PortfolioGrid";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MonoLabel,
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import type { Booking, ProviderListItem, ServiceCategory } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { formatBookingTime } from "@/src/utils/bookingDisplay";
import { logger } from "@/src/utils/logger";

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function firstNameFrom(name?: string | null, email?: string | null): string {
  const fromName = (name ?? "").trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const local = (email ?? "").split("@")[0]?.trim();
  if (local) return local;
  return "there";
}

function formatNextApptDate(iso: string): { month: string; day: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { month: "—", day: "—" };
  return {
    month: d.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: String(d.getDate()).padStart(2, "0"),
  };
}

function pickNextAppointment(bookings: Booking[]): Booking | null {
  const now = Date.now();
  const upcoming = bookings
    .filter((b) => {
      if (b.status !== "pending" && b.status !== "confirmed") return false;
      const t = new Date(b.startsAt).getTime();
      return Number.isFinite(t) && t >= now;
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return upcoming[0] ?? null;
}

function pickBookAgainProviderIds(bookings: Booking[]): string[] {
  const sorted = [...bookings].sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
  );
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const b of sorted) {
    if (!b.providerId || seen.has(b.providerId)) continue;
    seen.add(b.providerId);
    ids.push(b.providerId);
    if (ids.length >= 8) break;
  }
  return ids;
}

export default function CustomerHome() {
  const { user } = useSession();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [allProviders, setAllProviders] = useState<ProviderListItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    logger.debug("home", "load");
    console.log("[home] load start");
    try {
      const [catsResult, featuredResult, allResult, bookingsResult, accountResult] =
        await Promise.allSettled([
          listCategories(),
          listProviders({ featured: true, sort: "rating" }),
          listProviders({ sort: "rating" }),
          listBookings(),
          getAccountMe(),
        ]);

      if (catsResult.status === "rejected" && featuredResult.status === "rejected") {
        throw catsResult.reason instanceof Error
          ? catsResult.reason
          : new Error("Failed to load home");
      }

      if (catsResult.status === "fulfilled") {
        setCategories(catsResult.value.sort((a, b) => a.sortOrder - b.sortOrder));
      } else {
        logger.warn("home", "categories failed", catsResult.reason);
        setCategories([]);
      }

      if (featuredResult.status === "fulfilled") {
        setProviders(featuredResult.value);
      } else if (allResult.status === "fulfilled") {
        setProviders(allResult.value.slice(0, 8));
        logger.warn("home", "featured failed; using all providers slice", featuredResult.reason);
      } else {
        throw featuredResult.reason instanceof Error
          ? featuredResult.reason
          : new Error("Failed to load providers");
      }

      if (allResult.status === "fulfilled") {
        setAllProviders(allResult.value);
      } else {
        logger.warn("home", "all providers failed", allResult.reason);
        setAllProviders(featuredResult.status === "fulfilled" ? featuredResult.value : []);
      }

      if (bookingsResult.status === "fulfilled") {
        setBookings(bookingsResult.value);
        logger.debug("home", "bookings loaded", { count: bookingsResult.value.length });
      } else {
        logger.warn("home", "bookings failed — continuing without", bookingsResult.reason);
        console.log("[home] bookings soft-fail");
        setBookings([]);
      }

      if (accountResult.status === "fulfilled") {
        setDisplayName(accountResult.value.name ?? null);
      } else {
        logger.warn("home", "account failed — greeting fallback", accountResult.reason);
        setDisplayName(null);
      }

      logger.debug("home", "loaded", {
        categories:
          catsResult.status === "fulfilled" ? catsResult.value.length : 0,
        featured:
          featuredResult.status === "fulfilled" ? featuredResult.value.length : 0,
        bookings:
          bookingsResult.status === "fulfilled" ? bookingsResult.value.length : 0,
      });
      console.log("[home] load ok");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load home");
      logger.warn("home", "load failed", e);
      console.log("[home] load failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const providerById = useMemo(() => {
    const map = new Map<string, ProviderListItem>();
    for (const p of allProviders) map.set(p._id, p);
    for (const p of providers) {
      if (!map.has(p._id)) map.set(p._id, p);
    }
    return map;
  }, [allProviders, providers]);

  const nextAppointment = useMemo(() => pickNextAppointment(bookings), [bookings]);

  const bookAgainProviders = useMemo(() => {
    const ids = pickBookAgainProviderIds(bookings);
    return ids
      .map((id) => providerById.get(id))
      .filter((p): p is ProviderListItem => Boolean(p));
  }, [bookings, providerById]);

  const discoveryProviders = useMemo(() => {
    if (bookAgainProviders.length > 0) return bookAgainProviders;
    return providers.slice(0, 6);
  }, [bookAgainProviders, providers]);

  const showBookAgain = bookAgainProviders.length > 0;
  const firstName = firstNameFrom(displayName, user?.email);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allProviders) {
      const key = (p.categorySlug || "").toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [allProviders]);

  const recentWork: PortfolioTile[] = useMemo(() => {
    return providers.slice(0, 6).map((p) => ({
      id: p._id,
      image: p.coverImage || p.avatar,
      title: p.name,
      subtitle: p.categorySlug,
    }));
  }, [providers]);

  if (loading) return <LoadingState label="Loading home…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const nextProvider = nextAppointment
    ? providerById.get(nextAppointment.providerId)
    : undefined;
  const nextDate = nextAppointment
    ? formatNextApptDate(nextAppointment.startsAt)
    : null;

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        console.log("[home] pull-to-refresh");
        load();
      }}
      contentStyle={styles.content}
    >
      <View style={styles.headerRow}>
        <Text style={styles.brand}>BARBERO</Text>
        <View style={styles.headerActions}>
          <Pressable
            hitSlop={10}
            accessibilityLabel="Open map"
            onPress={() => {
              logger.debug("home", "header map");
              console.log("[home] tap map pin");
              router.push("/(customer)/map");
            }}
          >
            <MapPin color={colors.text} size={22} strokeWidth={1.75} />
          </Pressable>
          <Pressable
            hitSlop={10}
            accessibilityLabel="Messages"
            onPress={() => {
              logger.debug("home", "header bell → messages");
              console.log("[home] tap bell");
              router.push("/(customer)/messages");
            }}
          >
            <Bell color={colors.text} size={22} strokeWidth={1.75} />
          </Pressable>
        </View>
      </View>

      <View style={styles.greetingBlock}>
        <MonoLabel>
          {greetingForNow().toUpperCase()} {firstName}
        </MonoLabel>
      </View>

      <Pressable
        style={styles.searchBar}
        onPress={() => {
          logger.debug("home", "search bar");
          console.log("[home] tap search");
          router.push("/(customer)/search");
        }}
      >
        <Search color={colors.textMuted} size={18} strokeWidth={1.75} />
        <Text style={styles.searchPlaceholder}>Artists, shops, or services</Text>
      </Pressable>

      {nextAppointment && nextDate ? (
        <Pressable
          style={styles.nextCard}
          onPress={() => {
            logger.debug("home", "next appointment", { id: nextAppointment._id });
            console.log("[home] tap next appointment", nextAppointment._id);
            router.push(`/(customer)/bookings/${nextAppointment._id}`);
          }}
        >
          <View style={styles.nextDateBlock}>
            <Text style={styles.nextMonth}>{nextDate.month}</Text>
            <Text style={styles.nextDay}>{nextDate.day}</Text>
          </View>
          <View style={styles.nextBody}>
            <Text style={styles.nextService} numberOfLines={1}>
              {nextAppointment.serviceName}
            </Text>
            <Text style={styles.nextMeta} numberOfLines={1}>
              {formatBookingTime(nextAppointment.startsAt)}
              {nextProvider ? ` · ${nextProvider.name}` : ""}
            </Text>
          </View>
          <ChevronRight color={colors.onImage} size={20} strokeWidth={1.75} />
        </Pressable>
      ) : null}

      <View style={styles.sectionBlock}>
        <MonoLabel>Browse</MonoLabel>
        {categories.length === 0 ? (
          <Muted>No categories yet.</Muted>
        ) : (
          <View style={styles.browseList}>
            {categories.map((c, index) => {
              const count = categoryCounts.get(c.slug.toLowerCase()) ?? 0;
              const num = String(index + 1).padStart(2, "0");
              return (
                <Pressable
                  key={c.slug}
                  style={styles.browseRow}
                  onPress={() => {
                    logger.debug("home", "browse category", { slug: c.slug });
                    console.log("[home] tap browse", c.slug);
                    router.push({
                      pathname: "/(customer)/search",
                      params: { category: c.slug },
                    });
                  }}
                >
                  <Text style={styles.browseLeft}>
                    <Text style={styles.browseNum}>{num} </Text>
                    <Text style={styles.browseName}>{c.name}</Text>
                  </Text>
                  {count > 0 ? (
                    <Text style={styles.browseCount}>{count}</Text>
                  ) : (
                    <ChevronRight color={colors.textMuted} size={18} strokeWidth={1.75} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHead}>
          <Title style={styles.sectionTitle}>
            {showBookAgain ? "Book again" : "Discover artists"}
          </Title>
          <Pressable
            onPress={() => {
              logger.debug("home", "see all artists");
              console.log("[home] tap see all");
              router.push("/(customer)/search");
            }}
          >
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>

        {discoveryProviders.length === 0 ? (
          <EmptyState
            title="No artists yet"
            body="Browse search to find someone near you."
          />
        ) : (
          <View style={styles.providerList}>
            {discoveryProviders.map((p) => {
              const avatarUri = (p.avatar || "").trim();
              return (
                <View key={p._id} style={styles.providerRow}>
                  <Pressable
                    style={styles.providerMain}
                    onPress={() => {
                      logger.debug("home", "open provider", { slug: p.slug });
                      console.log("[home] tap provider row", p.slug);
                      router.push(`/(customer)/provider/${p.slug}`);
                    }}
                  >
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.avatarLetter}>
                          {p.name.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.providerInfo}>
                      <Text style={styles.providerName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <View style={styles.providerMetaRow}>
                        <Text style={styles.providerMeta} numberOfLines={1}>
                          {(p.categorySlug || "artist").replace(/-/g, " ")}
                        </Text>
                        <Star color={colors.accent} size={12} fill={colors.accent} />
                        <Text style={styles.providerRating}>
                          {p.rating.toFixed(1)}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                  <View style={styles.providerActions}>
                    <Text style={styles.fromPrice}>FROM ${p.startingPrice}</Text>
                    <Pressable
                      style={styles.bookBtn}
                      onPress={() => {
                        logger.debug("home", "book again", { slug: p.slug });
                        console.log("[home] tap book", p.slug);
                        router.push(`/(customer)/book/${p.slug}`);
                      }}
                    >
                      <Text style={styles.bookBtnText}>Book</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.sectionBlock}>
        <Title style={styles.sectionTitle}>Recent work</Title>
        <PortfolioGrid
          variant="carousel"
          items={recentWork}
          onPressItem={(item) => {
            const match = providers.find((p) => p._id === item.id);
            logger.debug("home", "recent work", { id: item.id, slug: match?.slug });
            console.log("[home] tap recent work", item.id);
            if (match) router.push(`/(customer)/provider/${match.slug}`);
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 18, paddingBottom: 28 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    fontSize: 28,
    letterSpacing: 1,
    color: colors.text,
    fontFamily: fonts.serifBold,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  greetingBlock: { gap: 2, marginTop: -4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  searchPlaceholder: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.mono,
  },
  nextCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.text,
    borderRadius: 14,
    padding: 16,
  },
  nextDateBlock: {
    alignItems: "center",
    minWidth: 48,
  },
  nextMonth: {
    color: colors.onImage,
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: fonts.monoMedium,
  },
  nextDay: {
    color: colors.onImage,
    fontSize: 28,
    lineHeight: 32,
    fontFamily: fonts.serifBold,
  },
  nextBody: { flex: 1, gap: 4, minWidth: 0 },
  nextService: {
    color: colors.onImage,
    fontSize: 17,
    fontFamily: fonts.serifMedium,
  },
  nextMeta: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontFamily: fonts.mono,
  },
  sectionBlock: { gap: 12 },
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
  browseList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  browseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  browseLeft: { flex: 1, minWidth: 0 },
  browseNum: {
    color: colors.textMuted,
    fontSize: 15,
    fontFamily: fonts.mono,
  },
  browseName: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fonts.serifMedium,
  },
  browseCount: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.mono,
  },
  providerList: { gap: 14 },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  providerMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceAlt,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fonts.serifMedium,
  },
  providerInfo: { flex: 1, gap: 3, minWidth: 0 },
  providerName: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.serifMedium,
  },
  providerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  providerMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.mono,
    textTransform: "capitalize",
    maxWidth: 90,
  },
  providerRating: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.mono,
  },
  providerActions: {
    alignItems: "flex-end",
    gap: 6,
  },
  fromPrice: {
    color: colors.accent,
    fontSize: 11,
    fontFamily: fonts.monoMedium,
  },
  bookBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  bookBtnText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: fonts.monoMedium,
  },
});
