import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, ChevronRight, Clock, Star } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import spinnerGold from "@/assets/lottie/spinner-gold.json";
import { addFavorite, listFavoriteIds, removeFavorite } from "@/src/api/favorites";
import { getProvider, getProviderReviews } from "@/src/api/providers";
import { AnimatedHeroScroll } from "@/src/components/animated/AnimatedHeroScroll";
import { AnimatedPressable } from "@/src/components/animated/AnimatedPressable";
import { LottieView } from "@/src/components/animated/LottieView";
import { staggeredEntering } from "@/src/components/animated/staggeredEntering";
import { PortfolioGrid, type PortfolioTile } from "@/src/components/PortfolioGrid";
import { PortfolioLightbox } from "@/src/components/PortfolioLightbox";
import type { ProviderProfile, Review } from "@/src/types/api";
import { fonts } from "@/src/theme/fonts";
import { formatRating } from "@/src/utils/format";
import { logger } from "@/src/utils/logger";

const AnimatedImage = Animated.createAnimatedComponent(Image);
const COVER_HEIGHT = 260;

/** Profile-local light palette (aligned with app white/gold theme). */
const theme = {
  bg: "#FFFFFF",
  surface: "#FAFAFA",
  surfaceAlt: "#F3F3F3",
  border: "#E5E5E5",
  text: "#0A0A0A",
  textMuted: "#6B6B6B",
  gold: "#C9973A",
  goldSoft: "rgba(201, 151, 58, 0.16)",
  onGold: "#FFFFFF",
};

export type ProviderProfileViewMode = "customer" | "preview";

type Props = {
  slug: string;
  mode: ProviderProfileViewMode;
  onBack?: () => void;
};

function formatCategory(slug?: string) {
  if (!slug) return "Artist";
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function logScope(mode: ProviderProfileViewMode) {
  return mode === "preview" ? "provider-public-preview" : "provider";
}

/**
 * Shared public provider profile UI used by the customer stack and the
 * provider "public preview" screen so both stay visually in sync.
 */
export function ProviderProfileView({ slug, mode, onBack }: Props) {
  const scope = logScope(mode);
  const isPreview = mode === "preview";
  const insets = useSafeAreaInsets();
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      logger.debug(scope, "focus profile", { mode, slug });
      return () => {
        logger.debug(scope, "blur leave profile", { mode, slug });
      };
    }, [mode, scope, slug]),
  );

  const load = useCallback(async () => {
    if (!slug) {
      setError("Missing provider slug");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    logger.debug(scope, "load profile", { mode, slug });
    try {
      const [profile, revsResult] = await Promise.all([
        getProvider(slug),
        getProviderReviews(slug).catch((e) => {
          logger.warn(scope, "reviews load failed", e);
          return [] as Review[];
        }),
      ]);
      setProvider(profile);
      setReviews(revsResult);

      if (!isPreview) {
        const favs = await listFavoriteIds().catch(() => ({
          providerIds: [] as string[],
        }));
        setFavorited(favs.providerIds.includes(profile._id));
      } else {
        setFavorited(false);
      }

      logger.debug(scope, "loaded", {
        mode,
        slug,
        services: profile.services.length,
        portfolio: profile.portfolio.length,
        reviews: revsResult.length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load provider");
      logger.warn(scope, "load failed", e);
    } finally {
      setLoading(false);
    }
  }, [isPreview, mode, scope, slug]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBack = () => {
    logger.debug(scope, "back", { mode });
    if (onBack) {
      onBack();
      return;
    }
    router.back();
  };

  const toggleFavorite = async () => {
    if (!provider) return;
    if (isPreview) {
      logger.debug(scope, "save ignored in preview", { id: provider._id });
      return;
    }
    try {
      if (favorited) {
        await removeFavorite(provider._id);
        setFavorited(false);
        logger.debug(scope, "unsaved", { id: provider._id });
      } else {
        await addFavorite(provider._id);
        setFavorited(true);
        logger.debug(scope, "saved", { id: provider._id });
      }
    } catch (e) {
      logger.warn(scope, "favorite toggle failed", e);
    }
  };

  const portfolioTiles: PortfolioTile[] = useMemo(() => {
    if (!provider) return [];
    if (provider.portfolio.length > 0) {
      return provider.portfolio.map((p) => ({
        id: p.id,
        image: p.image,
        title: p.title,
        subtitle: provider.name.split(" ")[0] ?? provider.name,
        description: p.description,
        likes: p.likes,
      }));
    }
    const cover = (provider.coverImage || provider.avatar || "").trim();
    if (!cover) return [];
    return [
      {
        id: "cover",
        image: cover,
        title: provider.name,
        subtitle: formatCategory(provider.categorySlug),
      },
    ];
  }, [provider]);

  const specialtyChips = useMemo(() => {
    if (!provider) return [] as string[];
    const fromServices = provider.services
      .map((s) => s.category?.trim())
      .filter((c): c is string => Boolean(c));
    const unique = Array.from(new Set(fromServices));
    if (unique.length > 0) return unique.slice(0, 6);
    return [formatCategory(provider.categorySlug)];
  }, [provider]);

  // Back button must sit on the screen root (not inside coverWrap).
  // coverWrap uses marginTop: -insets.top for an edge-to-edge hero; putting
  // top: insets.top on a child of that wrap cancels out and lands under the notch.
  const backTop = insets.top + 8;

  useEffect(() => {
    logger.debug(scope, "safe area back button", {
      mode,
      insetsTop: insets.top,
      backTop,
    });
  }, [backTop, insets.top, mode, scope]);

  // Lifted here (not created inside AnimatedHeroScroll) so the back button, which
  // renders as a sibling of the scroll content, can animate off the same offset.
  const scrollY = useSharedValue(0);
  const coverHeight = COVER_HEIGHT + insets.top;

  const coverAnimatedStyle = useAnimatedStyle(() => {
    const stretch = interpolate(scrollY.value, [-150, 0], [1.6, 1], Extrapolation.CLAMP);
    const parallax = interpolate(scrollY.value, [0, coverHeight], [0, coverHeight * 0.35], Extrapolation.CLAMP);
    return {
      transform: [{ translateY: parallax }, { scale: stretch }],
    };
  });

  const backBtnAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(0, 0, 0, ${interpolate(scrollY.value, [0, coverHeight - 40, coverHeight], [0.4, 0.4, 0.85], Extrapolation.CLAMP)})`,
  }));

  if (loading) {
    return (
      <View style={[styles.screenRoot, styles.centerState, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <LottieView source={spinnerGold} style={styles.loadingLottie} />
        <Text style={styles.emptyHint}>Loading…</Text>
      </View>
    );
  }
  if (error || !provider) {
    return (
      <View style={[styles.screenRoot, styles.centerState, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <Text style={styles.errorText}>{error ?? "Not found"}</Text>
        <Pressable style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const coverUri = (provider.coverImage || "").trim();
  const avatarUri = (provider.avatar || "").trim();
  const firstName = provider.name.split(" ")[0] || provider.name;

  const goBook = (serviceId?: string) => {
    if (isPreview) {
      logger.debug(scope, "book ignored in preview", {
        slug: provider.slug,
        serviceId,
      });
      return;
    }
    logger.debug(scope, "book now", { slug: provider.slug, serviceId });
    if (serviceId) {
      router.push(
        `/(customer)/book/${provider.slug}?serviceId=${encodeURIComponent(serviceId)}`,
      );
    } else {
      router.push(`/(customer)/book/${provider.slug}`);
    }
  };

  return (
    <View style={styles.screenRoot}>
      <StatusBar style="dark" />
      <AnimatedPressable
        style={[styles.backBtn, { top: backTop }, backBtnAnimatedStyle]}
        onPress={handleBack}
        hitSlop={10}
        accessibilityLabel="Go back"
      >
        <ArrowLeft color="#FFFFFF" size={20} strokeWidth={2} />
      </AnimatedPressable>
      <AnimatedHeroScroll
        scrollY={scrollY}
        style={styles.screenRoot}
        contentStyle={{ ...styles.content, paddingBottom: 32 + insets.bottom }}
        refreshing={false}
        onRefresh={load}
      >
        <View
          style={[
            styles.coverWrap,
            { marginTop: -insets.top, height: 260 + insets.top },
          ]}
        >
          {coverUri ? (
            <AnimatedImage
              source={{ uri: coverUri }}
              style={[styles.cover, coverAnimatedStyle]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.cover, { backgroundColor: theme.surfaceAlt }]} />
          )}
          <LinearGradient
            pointerEvents="none"
            colors={["transparent", "rgba(255, 255, 255, 0.45)", theme.bg]}
            locations={[0, 0.5, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.coverFade}
          />
        </View>

        <View style={styles.identity}>
          <View style={styles.avatarRing}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarLetter}>
                  {provider.name.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.identityText}>
            <Text style={styles.name}>{provider.name}</Text>
            <Text style={styles.titleGold}>{formatCategory(provider.categorySlug)}</Text>
            <View style={styles.metaRow}>
              <Star color={theme.gold} size={13} fill={theme.gold} />
              <Text style={styles.metaText}>
                {formatRating(provider.rating)}
                <Text style={styles.metaMuted}> ({provider.reviewCount})</Text>
              </Text>
              {provider.location.city ? (
                <Text style={styles.metaMuted}> · {provider.location.city}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {isPreview ? (
          <View style={styles.previewBanner}>
            <Text style={styles.previewBannerText}>
              Public preview · /{provider.slug}
            </Text>
          </View>
        ) : null}

        {provider.bio ? <Text style={styles.bio}>{provider.bio}</Text> : null}

        <View style={styles.chips}>
          {specialtyChips.map((chip, index) => (
            <Animated.View key={chip} style={styles.chip} entering={staggeredEntering(index)}>
              <Text style={styles.chipText}>{chip}</Text>
            </Animated.View>
          ))}
          {provider.isPremium ? (
            <Animated.View
              style={[styles.chip, styles.chipGold]}
              entering={staggeredEntering(specialtyChips.length)}
            >
              <Text style={[styles.chipText, { color: theme.gold }]}>Premium</Text>
            </Animated.View>
          ) : null}
        </View>

        <AnimatedPressable
          style={[styles.bookCta, isPreview && styles.bookCtaPreview]}
          onPress={() => goBook()}
          accessibilityState={{ disabled: isPreview }}
        >
          <Text style={styles.bookCtaText}>Book with {firstName}</Text>
        </AnimatedPressable>

        <View style={styles.secondaryActions}>
          <Pressable onPress={toggleFavorite} hitSlop={8}>
            <Text style={[styles.secondaryLink, isPreview && styles.secondaryLinkPreview]}>
              {favorited ? "Unsave" : "Save"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Portfolio</Text>
        {portfolioTiles.length === 0 ? (
          <Text style={styles.emptyHint}>No portfolio items yet</Text>
        ) : (
          <PortfolioGrid
            items={portfolioTiles}
            variant="carousel"
            onPressItem={(_item, index) => {
              logger.debug(scope, "open lightbox", { index, mode });
              setLightboxIndex(index);
            }}
          />
        )}

        <Text style={styles.section}>Quick Book</Text>
        {provider.services.length === 0 ? (
          <Text style={styles.emptyHint}>No services listed</Text>
        ) : (
          <View style={styles.serviceList}>
            {provider.services.map((s, index) => (
              <AnimatedPressable
                key={s.id}
                style={[styles.serviceRow, isPreview && styles.serviceRowPreview]}
                entering={staggeredEntering(index)}
                onPress={() => goBook(s.id)}
                accessibilityState={{ disabled: isPreview }}
              >
                {(() => {
                  const serviceImageUri = (s.image || avatarUri || "").trim();
                  return serviceImageUri ? (
                    <Image source={{ uri: serviceImageUri }} style={styles.serviceAvatar} />
                  ) : (
                    <View style={[styles.serviceAvatar, styles.avatarFallback]}>
                      <Text style={styles.serviceAvatarLetter}>
                        {provider.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  );
                })()}
                <View style={styles.serviceBody}>
                  <Text style={styles.serviceName} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <View style={styles.serviceMeta}>
                    <Clock color={theme.textMuted} size={12} />
                    <Text style={styles.serviceDuration}>{s.durationMinutes} min</Text>
                  </View>
                </View>
                <Text style={styles.servicePrice}>${s.price}</Text>
                <ChevronRight color={theme.textMuted} size={18} />
              </AnimatedPressable>
            ))}
          </View>
        )}

        <Text style={styles.section}>Reviews</Text>
        {reviews.length === 0 ? (
          <Text style={styles.emptyHint}>No reviews yet</Text>
        ) : (
          reviews.slice(0, 10).map((r) => (
            <View key={r._id} style={styles.reviewCard}>
              <Text style={styles.reviewName}>
                {r.userName} · ★ {r.rating}
              </Text>
              <Text style={styles.reviewBody}>{r.comment}</Text>
            </View>
          ))
        )}
      </AnimatedHeroScroll>

      <PortfolioLightbox
        items={portfolioTiles}
        initialIndex={lightboxIndex ?? 0}
        visible={lightboxIndex != null}
        onClose={() => {
          logger.debug(scope, "close lightbox", { mode });
          setLightboxIndex(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  centerState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  loadingLottie: { width: 64, height: 64 },
  errorText: {
    color: theme.text,
    fontSize: 15,
    fontFamily: fonts.mono,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.gold,
  },
  retryText: {
    color: theme.gold,
    fontSize: 13,
    fontFamily: fonts.mono,
  },
  content: {
    paddingTop: 0,
    gap: 14,
    backgroundColor: theme.bg,
  },
  coverWrap: {
    marginHorizontal: -20,
    height: 260,
    backgroundColor: theme.surface,
    overflow: "hidden",
  },
  cover: { width: "100%", height: "100%" },
  coverFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
  },
  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewBanner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.goldSoft,
    backgroundColor: theme.goldSoft,
  },
  previewBannerText: {
    color: theme.gold,
    fontSize: 12,
    fontFamily: fonts.mono,
    textAlign: "center",
  },
  identity: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-end",
    marginTop: -44,
  },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.gold,
    padding: 2,
    backgroundColor: theme.bg,
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surfaceAlt,
  },
  avatarLetter: {
    fontSize: 30,
    fontFamily: fonts.serif,
    color: theme.gold,
  },
  identityText: {
    flex: 1,
    gap: 4,
    paddingBottom: 4,
  },
  name: {
    color: theme.text,
    fontSize: 28,
    fontFamily: fonts.serifMedium,
    letterSpacing: -0.3,
  },
  titleGold: {
    color: theme.gold,
    fontSize: 13,
    fontFamily: fonts.mono,
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    flexWrap: "wrap",
  },
  metaText: {
    color: theme.text,
    fontSize: 13,
    fontFamily: fonts.mono,
  },
  metaMuted: {
    color: theme.textMuted,
    fontSize: 13,
    fontFamily: fonts.mono,
  },
  bio: {
    color: theme.textMuted,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.mono,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  chipGold: {
    borderColor: theme.goldSoft,
    backgroundColor: theme.goldSoft,
  },
  chipText: {
    color: theme.text,
    fontSize: 12,
    fontFamily: fonts.mono,
  },
  bookCta: {
    backgroundColor: theme.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  bookCtaPreview: {
    opacity: 0.55,
  },
  bookCtaText: {
    color: theme.onGold,
    fontSize: 16,
    fontFamily: fonts.serifMedium,
  },
  secondaryActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: -4,
  },
  secondaryLink: {
    color: theme.textMuted,
    fontSize: 13,
    fontFamily: fonts.mono,
    textDecorationLine: "underline",
  },
  secondaryLinkPreview: {
    opacity: 0.55,
  },
  section: {
    color: theme.text,
    fontSize: 24,
    fontFamily: fonts.serifMedium,
    marginTop: 10,
  },
  emptyHint: {
    color: theme.textMuted,
    fontSize: 13,
    fontFamily: fonts.mono,
    paddingVertical: 12,
  },
  serviceList: {
    gap: 10,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  serviceRowPreview: {
    opacity: 0.7,
  },
  serviceAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  serviceAvatarLetter: {
    color: theme.gold,
    fontSize: 16,
    fontFamily: fonts.serif,
  },
  serviceBody: {
    flex: 1,
    gap: 3,
  },
  serviceName: {
    color: theme.text,
    fontSize: 15,
    fontFamily: fonts.serifMedium,
  },
  serviceMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  serviceDuration: {
    color: theme.textMuted,
    fontSize: 12,
    fontFamily: fonts.mono,
  },
  servicePrice: {
    color: theme.gold,
    fontSize: 15,
    fontFamily: fonts.monoMedium,
  },
  reviewCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  reviewName: {
    color: theme.text,
    fontSize: 14,
    fontFamily: fonts.serifMedium,
  },
  reviewBody: {
    color: theme.textMuted,
    fontSize: 13,
    fontFamily: fonts.mono,
    lineHeight: 20,
  },
});
