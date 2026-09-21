import { formatMoney } from '@/src/utils/format';
import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  Bell,
  ChevronRight,
  Hand,
  History,
  MapPin,
  PenTool,
  Scissors,
  Search,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listBookings } from "@/src/api/bookings";
import { ApiError } from "@/src/api/client";
import { listCategories } from "@/src/api/categories";
import {
  establishmentPublicUrl,
  listEstablishments,
} from "@/src/api/establishments";
import { listProviders } from "@/src/api/providers";
import { AnimatedHeroScroll } from "@/src/components/animated/AnimatedHeroScroll";
import { AnimatedPressable } from "@/src/components/animated/AnimatedPressable";
import { staggeredEntering } from "@/src/components/animated/staggeredEntering";
import { BrandLogo } from "@/src/components/BrandLogo";
import { EmptyDiscoverIllustration } from "@/src/components/illustrations/EmptyDiscoverIllustration";
import { PortfolioGrid, type PortfolioTile } from "@/src/components/PortfolioGrid";
import { ProviderCard } from "@/src/components/ProviderCard";
import { ProvidersMapView } from "@/src/components/ProvidersMapView";
import {
  Chip,
  EmptyState,
  ErrorState,
  MonoLabel,
  Muted,
  OfflineState,
  Skeleton,
  StaleBadge,
  Title,
} from "@/src/components/ui";
import { readCache, savedAgoLabel, writeCache } from "@/src/offline/cache";
import type {
  Booking,
  EstablishmentListItem,
  ProviderListItem,
  ServiceCategory,
} from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { formatBookingTime } from "@/src/utils/bookingDisplay";
import {
  distanceKm,
  requestUserCoords,
  type UserCoords,
} from "@/src/utils/location";
import { logger } from "@/src/utils/logger";
import {
  clearRecentlyViewed,
  listRecentSearches,
  listRecentlyViewed,
  viewedToListItem,
  type ViewedProvider,
} from "@/src/utils/recentlyViewed";
import { useProviderOnboardingHome } from "@/src/hooks/useProviderOnboardingHome";

/** Swap this URL for a real hero photo asset once available. */
const HERO_IMAGE_URI =
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900&q=80";

function useDiscoveryPush() {
  const discoveryDisabled = useProviderOnboardingHome();
  const pushDiscovery = useCallback(
    (
      target: string | { pathname: string; params?: Record<string, string> },
      label: string,
    ) => {
      if (discoveryDisabled) {
        logger.info("home", "discovery disabled — skip nav", { target, label });
        console.log("[home] discovery disabled — skip nav", label, target);
        return;
      }
      // expo-router accepts string paths and typed href objects
      router.push(target as never);
    },
    [discoveryDisabled],
  );
  return { discoveryDisabled, pushDiscovery };
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

function sortProvidersByDistance(
  items: ProviderListItem[],
  coords: UserCoords,
): ProviderListItem[] {
  return [...items].sort((a, b) => {
    const aHas =
      Number.isFinite(a.location?.lat) && Number.isFinite(a.location?.lng);
    const bHas =
      Number.isFinite(b.location?.lat) && Number.isFinite(b.location?.lng);
    if (!aHas && !bHas) return 0;
    if (!aHas) return 1;
    if (!bHas) return -1;
    return (
      distanceKm(coords, { lat: a.location.lat, lng: a.location.lng }) -
      distanceKm(coords, { lat: b.location.lat, lng: b.location.lng })
    );
  });
}

const AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground);

const NEARBY_RADIUS_KM = 5;
const BROWSE_COLS = 4;
const BROWSE_GAP = 10;
const HOME_CACHE_KEY = "home:v1";

/** Everything Home renders from the network, saved so the screen still opens offline. */
type HomeSnapshot = {
  categories: ServiceCategory[];
  providers: ProviderListItem[];
  allProviders: ProviderListItem[];
  bookings: Booking[];
  salons: EstablishmentListItem[];
};

function categoryIcon(slug: string): LucideIcon {
  const key = slug.toLowerCase();
  if (key.includes("tattoo")) return PenTool;
  if (key.includes("nail")) return Hand;
  if (key.includes("barber") || key.includes("hair")) return Scissors;
  return Sparkles;
}

function NearbyCard({
  provider,
  km,
  onOpen,
  onBook,
}: {
  provider: ProviderListItem;
  km: number;
  onOpen: () => void;
  onBook: () => void;
}) {
  const imageUri = (provider.coverImage || provider.avatar || "").trim();
  return (
    <Pressable style={styles.nearCard} onPress={onOpen} accessibilityLabel={`View ${provider.name}`}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.nearImage} />
      ) : (
        <View style={[styles.nearImage, styles.nearFallback]}>
          <Text style={styles.avatarLetter}>{provider.name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.nearBody}>
        <Text style={styles.nearName} numberOfLines={1}>
          {provider.name}
        </Text>
        <View style={styles.nearMeta}>
          <Star color={colors.accent} size={11} fill={colors.accent} />
          <Text style={styles.nearMetaText}>
            {provider.rating.toFixed(1)} · {km < 10 ? km.toFixed(1) : Math.round(km)} km
          </Text>
        </View>
        <AnimatedPressable style={styles.nearBook} onPress={onBook} accessibilityLabel={`Book ${provider.name}`}>
          <Text style={styles.nearBookText}>Book</Text>
        </AnimatedPressable>
      </View>
    </Pressable>
  );
}

function HeroBanner({ scrollY }: { scrollY: SharedValue<number> }) {
  const { pushDiscovery } = useDiscoveryPush();
  console.log("[home] hero banner render");
  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(scrollY.value, [-120, 0], [1.15, 1], Extrapolation.CLAMP);
    const opacity = interpolate(scrollY.value, [0, 160], [1, 0.85], Extrapolation.CLAMP);
    const translateY = interpolate(scrollY.value, [0, 160], [0, 24], Extrapolation.CLAMP);
    return { transform: [{ scale }, { translateY }], opacity };
  });
  return (
    <AnimatedImageBackground
      source={{ uri: HERO_IMAGE_URI }}
      style={[styles.heroBanner, animatedStyle]}
      imageStyle={styles.heroImage}
      resizeMode="cover"
      accessibilityLabel="Hero banner"
    >
      <View style={styles.heroOverlay}>
        <Text style={styles.heroEyebrow}>BARBERO</Text>
        <Text style={styles.heroHeadline}>Look sharp,{"\n"}feel confident.</Text>
        <Pressable
          style={styles.heroCta}
          onPress={() => {
            console.log("[home] tap hero cta");
            pushDiscovery("/(customer)/search", "hero-cta");
          }}
          accessibilityLabel="Book now"
        >
          <Text style={styles.heroCtaText}>Book now</Text>
        </Pressable>
      </View>
    </AnimatedImageBackground>
  );
}

function FeaturedProviderCard({
  provider,
  index,
}: {
  provider: ProviderListItem;
  index: number;
}) {
  const { pushDiscovery } = useDiscoveryPush();
  const imageUri = (provider.coverImage || provider.avatar || "").trim();
  return (
    <AnimatedPressable
      style={styles.featCard}
      entering={staggeredEntering(index)}
      onPress={() => {
        console.log("[home] featured card press", provider.slug);
        pushDiscovery(`/(customer)/provider/${provider.slug}`, "featured-card");
      }}
      accessibilityLabel={`View ${provider.name}`}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.featImage} />
      ) : (
        <View style={[styles.featImage, styles.featImageFallback]}>
          <Text style={styles.featImageLetter}>
            {provider.name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.featCardBody}>
        <Text style={styles.featName} numberOfLines={1}>
          {provider.name}
        </Text>
        <View style={styles.featRatingRow}>
          <Star color={colors.accent} size={11} fill={colors.accent} />
          <Text style={styles.featRating}>{provider.rating.toFixed(1)}</Text>
          <Text style={styles.featCategory} numberOfLines={1}>
            · {(provider.categorySlug || "artist").replace(/-/g, " ")}
          </Text>
        </View>
        <Pressable
          style={styles.featBookBtn}
          onPress={() => {
            console.log("[home] featured book press", provider.slug);
            pushDiscovery(`/(customer)/book/${provider.slug}`, "featured-book");
          }}
          accessibilityLabel={`Book ${provider.name}`}
        >
          <Text style={styles.featBookText}>Book</Text>
        </Pressable>
      </View>
    </AnimatedPressable>
  );
}

function FeaturedSalonCard({
  salon,
  index,
}: {
  salon: EstablishmentListItem;
  index: number;
}) {
  const imageUri = (salon.coverImage || salon.logo || "").trim();
  return (
    <AnimatedPressable
      style={styles.featCard}
      entering={staggeredEntering(index)}
      onPress={() => {
        const url = establishmentPublicUrl(salon.slug);
        console.log("[home] featured salon press", salon.slug, url);
        void WebBrowser.openBrowserAsync(url);
      }}
      accessibilityLabel={`View salon ${salon.name}`}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.featImage} />
      ) : (
        <View style={[styles.featImage, styles.featImageFallback]}>
          <Text style={styles.featImageLetter}>
            {salon.name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.featCardBody}>
        <Text style={styles.featName} numberOfLines={1}>
          {salon.name}
        </Text>
        <Text style={styles.featCategory} numberOfLines={1}>
          {(salon.location.city || salon.categorySlug || "salon").replace(/-/g, " ")}
        </Text>
        <Pressable
          style={styles.featBookBtn}
          onPress={() => {
            const url = establishmentPublicUrl(salon.slug);
            console.log("[home] featured salon open", salon.slug, url);
            void WebBrowser.openBrowserAsync(url);
          }}
          accessibilityLabel={`Open ${salon.name}`}
        >
          <Text style={styles.featBookText}>View</Text>
        </Pressable>
      </View>
    </AnimatedPressable>
  );
}

export default function CustomerHome() {
  const insets = useSafeAreaInsets();
  const { pushDiscovery } = useDiscoveryPush();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [featuredSalons, setFeaturedSalons] = useState<EstablishmentListItem[]>([]);
  const [allProviders, setAllProviders] = useState<ProviderListItem[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [stale, setStale] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [offlineFail, setOfflineFail] = useState(false);
  const hasDataRef = useRef(false);
  const { width: screenWidth } = useWindowDimensions();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [viewed, setViewed] = useState<ViewedProvider[]>([]);

  // Re-read on focus so a profile you just opened shows up when you come back.
  useFocusEffect(
    useCallback(() => {
      void listRecentSearches().then(setRecentSearches);
      void listRecentlyViewed().then(setViewed);
    }, []),
  );

  const load = useCallback(async () => {
    setError(null);
    setOfflineFail(false);
    logger.debug("home", "load");
    console.log("[home] load start");
    try {
      const [catsResult, featuredResult, allResult, bookingsResult, salonsResult] =
        await Promise.allSettled([
          listCategories(),
          listProviders({ featured: true, sort: "rating" }),
          listProviders({ sort: "rating" }),
          listBookings(),
          listEstablishments({ featured: true, limit: 8 }),
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

      if (salonsResult.status === "fulfilled") {
        setFeaturedSalons(salonsResult.value);
        console.log("[home] featured salons loaded", salonsResult.value.length);
      } else {
        setFeaturedSalons([]);
        logger.warn("home", "featured salons failed", salonsResult.reason);
        console.log("[home] featured salons soft-fail", salonsResult.reason);
      }

      const snapshot: HomeSnapshot = {
        categories:
          catsResult.status === "fulfilled"
            ? [...catsResult.value].sort((a, b) => a.sortOrder - b.sortOrder)
            : [],
        providers:
          featuredResult.status === "fulfilled"
            ? featuredResult.value
            : allResult.status === "fulfilled"
              ? allResult.value.slice(0, 8)
              : [],
        allProviders:
          allResult.status === "fulfilled"
            ? allResult.value
            : featuredResult.status === "fulfilled"
              ? featuredResult.value
              : [],
        bookings: bookingsResult.status === "fulfilled" ? bookingsResult.value : [],
        salons: salonsResult.status === "fulfilled" ? salonsResult.value : [],
      };
      hasDataRef.current = true;
      setStale(false);
      void writeCache(HOME_CACHE_KEY, snapshot).then(setSavedAt);

      logger.debug("home", "loaded", {
        categories:
          catsResult.status === "fulfilled" ? catsResult.value.length : 0,
        featured:
          featuredResult.status === "fulfilled" ? featuredResult.value.length : 0,
        salons: salonsResult.status === "fulfilled" ? salonsResult.value.length : 0,
        bookings:
          bookingsResult.status === "fulfilled" ? bookingsResult.value.length : 0,
      });
      console.log("[home] load ok");
    } catch (e) {
      logger.warn("home", "load failed", e);
      if (hasDataRef.current) {
        // Keep showing what we have; it is now known to be out of date.
        setStale(true);
      } else {
        setError(e instanceof Error ? e.message : "Failed to load home");
        setOfflineFail(e instanceof ApiError && e.code === "NETWORK");
      }
      console.log("[home] load failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadLocation = useCallback(async () => {
    logger.debug("home", "loadLocation");
    console.log("[home] loadLocation start");
    const coords = await requestUserCoords();
    setUserCoords(coords);
    logger.debug("home", "loadLocation done", {
      hasCoords: Boolean(coords),
      lat: coords?.lat,
      lng: coords?.lng,
    });
    console.log("[home] loadLocation done", coords ? "ok" : "none");
  }, []);

  // Paint the last saved Home immediately; the network load below replaces it.
  useEffect(() => {
    let cancelled = false;
    void readCache<HomeSnapshot>(HOME_CACHE_KEY).then((hit) => {
      if (cancelled || !hit || hasDataRef.current) return;
      hasDataRef.current = true;
      setCategories(hit.data.categories);
      setProviders(hit.data.providers);
      setAllProviders(hit.data.allProviders);
      setBookings(hit.data.bookings);
      setFeaturedSalons(hit.data.salons);
      setSavedAt(hit.savedAt);
      setStale(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    load();
    loadLocation();
  }, [load, loadLocation]);

  useEffect(() => {
    logger.debug("home", "map mount/coords", {
      hasCoords: Boolean(userCoords),
    });
    console.log("[home] map coords", userCoords ? "ready" : "waiting/denied");
  }, [userCoords]);

  useEffect(() => {
    logger.debug("home", "header brand size", { logoSize: "hero" });
    console.log("[home] header brand size hero");
  }, []);

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
    const pool = providers.slice(0, 12);
    if (!userCoords) {
      logger.debug("home", "discover without GPS sort", { count: pool.length });
      return pool.slice(0, 6);
    }
    const sorted = sortProvidersByDistance(pool, userCoords).slice(0, 6);
    logger.debug("home", "discover near-you sort", {
      count: sorted.length,
      first: sorted[0]?.slug,
    });
    console.log("[home] near-you sort", sorted.length);
    return sorted;
  }, [bookAgainProviders, providers, userCoords]);

  const nearby = useMemo(() => {
    if (!userCoords) return [];
    return allProviders
      .filter((p) => Number.isFinite(p.location?.lat) && Number.isFinite(p.location?.lng))
      .map((p) => ({ p, km: distanceKm(userCoords, { lat: p.location.lat, lng: p.location.lng }) }))
      .filter((x) => x.km <= NEARBY_RADIUS_KM)
      .sort((a, b) => a.km - b.km)
      .slice(0, 8);
  }, [allProviders, userCoords]);

  const viewedItems = useMemo(
    () => viewed.map((v) => providerById.get(v._id) ?? viewedToListItem(v)),
    [viewed, providerById],
  );

  const suggestions = useMemo(() => {
    const list: {
      key: string;
      label: string;
      icon?: React.ReactNode;
      params: Record<string, string>;
    }[] = [];
    if (recentSearches[0]) {
      list.push({
        key: "recent",
        label: recentSearches[0],
        icon: <History size={12} color={colors.textMuted} />,
        params: { q: recentSearches[0] },
      });
    }
    list.push(
      { key: "near", label: "Near me", icon: <MapPin size={12} color={colors.textMuted} />, params: { near: "1" } },
      { key: "today", label: "Open today", params: { avail: "today" } },
      { key: "beard", label: "Beard trim", params: { q: "beard trim" } },
    );
    return list;
  }, [recentSearches]);

  const showBookAgain = bookAgainProviders.length > 0;
  const showNearYou = !showBookAgain && Boolean(userCoords);

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

  const topInsetPadding = Math.max(insets.top, 10);

  useEffect(() => {
    logger.debug("home", "safe area top inset", {
      topInset: insets.top,
      appliedPaddingTop: topInsetPadding,
    });
    console.log("[home] safe area top inset", {
      topInset: insets.top,
      appliedPaddingTop: topInsetPadding,
    });
  }, [insets.top, topInsetPadding]);

  const scrollY = useSharedValue(0);

  if (loading) {
    // Same shapes as the real page (header, hero, search, rails) so nothing jumps on load.
    return (
      <View style={[styles.content, styles.skelPage, { paddingTop: topInsetPadding }]}>
        <View style={styles.headerRow}>
          <Skeleton style={{ height: 40, width: 100 }} />
          <View style={styles.headerActions}>
            <Skeleton style={{ height: 22, width: 22, borderRadius: 11 }} />
            <Skeleton style={{ height: 22, width: 22, borderRadius: 11 }} />
          </View>
        </View>
        <Skeleton style={{ height: 180, marginHorizontal: -20, borderRadius: 0 }} />
        <Skeleton style={{ height: 52, borderRadius: 12 }} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[80, 72, 92, 84].map((w, i) => (
            <Skeleton key={i} style={{ height: 34, width: w, borderRadius: 999 }} />
          ))}
        </View>
        <Skeleton style={{ height: 24, width: 140, borderRadius: 6 }} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          {[0, 1].map((i) => (
            <Skeleton key={i} style={{ height: 190, width: 168 }} />
          ))}
        </View>
      </View>
    );
  }
  if (error) {
    return offlineFail ? (
      <OfflineState onRetry={load} body="Home isn't saved on this device yet." />
    ) : (
      <ErrorState message={error} onRetry={load} />
    );
  }

  const nextProvider = nextAppointment
    ? providerById.get(nextAppointment.providerId)
    : undefined;
  const nextDate = nextAppointment
    ? formatNextApptDate(nextAppointment.startsAt)
    : null;

  return (
    <AnimatedHeroScroll
      scrollY={scrollY}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        console.log("[home] pull-to-refresh");
        load();
        loadLocation();
      }}
      contentStyle={{ ...styles.content, paddingTop: topInsetPadding }}
    >
      <Animated.View style={styles.headerRow} entering={FadeInDown.duration(400)}>
        <BrandLogo variant="dark" size="hero" style={styles.brandLogo} />
        <View style={styles.headerActions}>
          <Pressable
            hitSlop={10}
            accessibilityLabel="Open full map"
            onPress={() => {
              logger.debug("home", "header map");
              console.log("[home] tap map pin");
              pushDiscovery("/(customer)/map", "header-map");
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
      </Animated.View>

      {stale ? <StaleBadge label={savedAgoLabel(savedAt)} /> : null}

      <HeroBanner scrollY={scrollY} />

      <Pressable
        style={styles.searchBar}
        onPress={() => {
          logger.debug("home", "search bar");
          console.log("[home] tap search");
          pushDiscovery("/(customer)/search", "search-bar");
        }}
      >
        <Search color={colors.textMuted} size={18} strokeWidth={1.75} />
        <Text style={styles.searchPlaceholder}>Artists, shops, or services</Text>
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.suggestWrap}
        contentContainerStyle={styles.suggestRow}
      >
        {suggestions.map((sg) => (
          <Chip
            key={sg.key}
            label={sg.label}
            icon={sg.icon}
            onPress={() => {
              logger.debug("home", "suggestion", { key: sg.key });
              pushDiscovery({ pathname: "/(customer)/search", params: sg.params }, `suggestion-${sg.key}`);
            }}
          />
        ))}
      </ScrollView>

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

      {nearby.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHead}>
            <View style={styles.nearTitleRow}>
              <Text style={styles.featSectionTitle}>Nearby now</Text>
              <Text style={styles.nearRadius}>within {NEARBY_RADIUS_KM} km</Text>
            </View>
            <Pressable
              onPress={() => pushDiscovery({ pathname: "/(customer)/search", params: { near: "1" } }, "nearby-see-all")}
            >
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featScroll}
          >
            {nearby.map(({ p, km }) => (
              <NearbyCard
                key={p._id}
                provider={p}
                km={km}
                onOpen={() => pushDiscovery(`/(customer)/provider/${p.slug}`, "nearby-card")}
                onBook={() => pushDiscovery(`/(customer)/book/${p.slug}`, "nearby-book")}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {viewedItems.length > 0 ? (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHead}>
            <Text style={styles.featSectionTitle}>Recently viewed</Text>
            <Pressable
              onPress={() => {
                setViewed([]);
                void clearRecentlyViewed();
              }}
            >
              <Text style={styles.clearLink}>Clear</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featScroll}
          >
            {viewedItems.map((p) => (
              <ProviderCard
                key={p._id}
                provider={p}
                variant="portrait"
                onPress={() => pushDiscovery(`/(customer)/provider/${p.slug}`, "recently-viewed")}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.sectionBlock}>
        <MonoLabel>Browse</MonoLabel>
        {categories.length === 0 ? (
          <Muted>No categories yet.</Muted>
        ) : (
          <View style={styles.browseGrid}>
            {categories.map((c, index) => {
              const count = categoryCounts.get(c.slug.toLowerCase()) ?? 0;
              const Icon = categoryIcon(c.slug);
              const tile = Math.floor((screenWidth - 40 - BROWSE_GAP * (BROWSE_COLS - 1)) / BROWSE_COLS);
              return (
                <AnimatedPressable
                  key={c.slug}
                  style={[styles.browseTile, { width: tile }]}
                  entering={staggeredEntering(index)}
                  accessibilityLabel={`${c.name}${count > 0 ? `, ${count} providers` : ""}`}
                  onPress={() => {
                    logger.debug("home", "browse category", { slug: c.slug });
                    pushDiscovery(
                      { pathname: "/(customer)/search", params: { category: c.slug } },
                      "browse-category",
                    );
                  }}
                >
                  <View style={[styles.browseIconBox, { width: tile, height: tile }]}>
                    <Icon size={26} color={colors.text} strokeWidth={1.75} />
                    {count > 0 ? (
                      <View style={styles.browseBadge}>
                        <Text style={styles.browseBadgeText}>{count}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.browseLabel} numberOfLines={1}>
                    {c.name}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.mapWrap}>
        <ProvidersMapView
          embedded
          centerOnUser
          showsUserLocation={Boolean(userCoords)}
          userCoordinate={userCoords}
          showCategoryChips={false}
        />
      </View>

      {providers.length > 0 && (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHead}>
            <Text style={styles.featSectionTitle}>Featured</Text>
            <Pressable
              onPress={() => {
                console.log("[home] featured see all");
                pushDiscovery("/(customer)/search", "featured-see-all");
              }}
            >
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featScroll}
          >
            {providers.slice(0, 8).map((p, index) => (
              <FeaturedProviderCard key={p._id} provider={p} index={index} />
            ))}
          </ScrollView>
        </View>
      )}

      {featuredSalons.length > 0 && (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHead}>
            <Text style={styles.featSectionTitle}>Featured salons</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featScroll}
          >
            {featuredSalons.slice(0, 8).map((salon, index) => (
              <FeaturedSalonCard key={salon._id} salon={salon} index={index} />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHead}>
          <Title style={styles.sectionTitle}>
            {showBookAgain ? "Book again" : showNearYou ? "Near you" : "Discover artists"}
          </Title>
          <Pressable
            onPress={() => {
              logger.debug("home", "see all artists");
              console.log("[home] tap see all");
              pushDiscovery("/(customer)/search", "see-all-artists");
            }}
          >
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>

        {discoveryProviders.length === 0 ? (
          <EmptyState
            title="No artists yet"
            body="Browse search to find someone near you."
            illustration={<EmptyDiscoverIllustration />}
          />
        ) : (
          <View style={styles.providerList}>
            {discoveryProviders.map((p, index) => {
              const avatarUri = (p.avatar || "").trim();
              return (
                <Animated.View key={p._id} style={styles.providerRow} entering={staggeredEntering(index)}>
                  <AnimatedPressable
                    style={styles.providerMain}
                    onPress={() => {
                      logger.debug("home", "open provider", { slug: p.slug });
                      console.log("[home] tap provider row", p.slug);
                      pushDiscovery(`/(customer)/provider/${p.slug}`, "provider-row");
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
                  </AnimatedPressable>
                  <View style={styles.providerActions}>
                    <Text style={styles.fromPrice}>from {formatMoney(p.startingPrice)}</Text>
                    <AnimatedPressable
                      style={styles.bookBtn}
                      onPress={() => {
                        logger.debug("home", "book again", { slug: p.slug });
                        console.log("[home] tap book", p.slug);
                        pushDiscovery(`/(customer)/book/${p.slug}`, "book-again");
                      }}
                    >
                      <Text style={styles.bookBtnText}>Book</Text>
                    </AnimatedPressable>
                  </View>
                </Animated.View>
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
            if (match) {
              pushDiscovery(`/(customer)/provider/${match.slug}`, "recent-work");
            }
          }}
        />
      </View>
    </AnimatedHeroScroll>
  );
}

const styles = StyleSheet.create({
  suggestWrap: { marginHorizontal: -20, marginTop: -8, flexGrow: 0 },
  suggestRow: { paddingHorizontal: 20, gap: 8 },
  nearTitleRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  nearRadius: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.mono },
  clearLink: { color: colors.textMuted, fontSize: 12, fontFamily: fonts.mono },
  nearCard: {
    width: 168,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  nearImage: { width: "100%", height: 96, backgroundColor: colors.surfaceAlt },
  nearFallback: { alignItems: "center", justifyContent: "center" },
  nearBody: { padding: 10, gap: 5 },
  nearName: { color: colors.text, fontSize: 14, fontFamily: fonts.serifMedium },
  nearMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  nearMetaText: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.mono },
  nearBook: {
    marginTop: 4,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
  },
  nearBookText: { color: colors.text, fontSize: 12, fontFamily: fonts.monoMedium },
  content: { paddingTop: 10, gap: 18, paddingBottom: 28 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
  },
  brandLogo: { alignSelf: "center" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  mapWrap: {
    height: 280,
    width: "100%",
  },
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
  skelPage: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  browseGrid: { flexDirection: "row", flexWrap: "wrap", gap: BROWSE_GAP, rowGap: 16 },
  browseTile: { alignItems: "center", gap: 8 },
  browseIconBox: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  browseBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  browseBadgeText: { color: colors.text, fontSize: 11, lineHeight: 13, fontFamily: fonts.monoMedium },
  browseLabel: { color: colors.text, fontSize: 11, fontFamily: fonts.mono },
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
  // ── Hero banner ──────────────────────────────────────────────────────────
  heroBanner: {
    height: 180,
    marginHorizontal: -20,
    overflow: "hidden",
  },
  heroImage: {
    borderRadius: 0,
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,10,10,0.52)",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 6,
  },
  heroEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontFamily: fonts.monoMedium,
    letterSpacing: 2,
  },
  heroHeadline: {
    color: colors.onImage,
    fontSize: 26,
    fontFamily: fonts.serifBold,
    lineHeight: 32,
  },
  heroCta: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  heroCtaText: {
    color: colors.onImage,
    fontSize: 13,
    fontFamily: fonts.monoMedium,
  },
  // ── Featured providers row ────────────────────────────────────────────────
  featSectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontFamily: fonts.serifBold,
  },
  featScroll: {
    gap: 12,
    paddingRight: 4,
  },
  featCard: {
    width: 150,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featImage: {
    width: "100%",
    height: 110,
    backgroundColor: colors.surfaceAlt,
  },
  featImageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  featImageLetter: {
    color: colors.text,
    fontSize: 28,
    fontFamily: fonts.serifBold,
  },
  featCardBody: {
    padding: 10,
    gap: 4,
  },
  featName: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.serifMedium,
  },
  featRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  featRating: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.mono,
  },
  featCategory: {
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.mono,
    textTransform: "capitalize",
    flex: 1,
  },
  featBookBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 6,
    alignItems: "center",
  },
  featBookText: {
    color: colors.text,
    fontSize: 12,
    fontFamily: fonts.monoMedium,
  },
});
