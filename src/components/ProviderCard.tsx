import { formatMoney } from '@/src/utils/format';
import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ProviderListItem } from "@/src/types/api";
import { categoryAccent, colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { formatRating } from "@/src/utils/format";
import { logger } from "@/src/utils/logger";

const TITLE_GRADIENT = [
  "transparent",
  "rgba(10, 10, 10, 0.35)",
  "rgba(10, 10, 10, 0.82)",
] as const;

export function ProviderCard({
  provider,
  onPress,
  variant = "list",
}: {
  provider: ProviderListItem;
  onPress: () => void;
  /** list = full-width card; portrait = horizontal artist card */
  variant?: "list" | "portrait";
}) {
  const imageUri = (provider.coverImage || provider.avatar || "").trim();
  const accent = categoryAccent(provider.categorySlug);

  return (
    <Pressable
      onPress={() => {
        logger.debug("ProviderCard", "press", { slug: provider.slug, variant });
        onPress();
      }}
      style={[styles.card, variant === "portrait" && styles.portraitCard]}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.fallback, { borderColor: accent + "40" }]}>
          <Text style={[styles.fallbackText, { color: accent }]}>
            {provider.name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      <LinearGradient
        pointerEvents="none"
        colors={[...TITLE_GRADIENT]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.overlay}
      >
        <Text style={styles.name} numberOfLines={1}>{provider.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {provider.categorySlug} · ★ {formatRating(provider.rating)}
        </Text>
        {variant === "list" ? (
          <Text style={styles.meta} numberOfLines={1}>
            {provider.location.city} · from {formatMoney(provider.startingPrice)}
          </Text>
        ) : null}
      </LinearGradient>
      {provider.isPremium ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Premium</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    height: 180,
  },
  portraitCard: {
    width: 112,
    height: 148,
  },
  image: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
  },
  fallbackText: {
    fontSize: 32,
    fontFamily: fonts.serif,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 28,
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 2,
  },
  name: {
    color: colors.onImage,
    fontSize: 15,
    fontFamily: fonts.serifMedium,
  },
  meta: {
    color: "rgba(255, 255, 255, 0.78)",
    fontSize: 10,
    fontFamily: fonts.mono,
  },
  badge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    color: colors.text,
    fontSize: 10,
    fontFamily: fonts.monoMedium,
  },
});
