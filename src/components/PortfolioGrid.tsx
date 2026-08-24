import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AnimatedPressable } from "@/src/components/animated/AnimatedPressable";
import { staggeredEntering } from "@/src/components/animated/staggeredEntering";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { logger } from "@/src/utils/logger";

export type PortfolioTile = {
  id: string;
  image?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  likes?: number;
};

const CAROUSEL_TILE_WIDTH = Math.min(180, Dimensions.get("window").width * 0.48);

export function PortfolioGrid({
  items,
  onPressItem,
  variant = "grid",
}: {
  items: PortfolioTile[];
  onPressItem?: (item: PortfolioTile, index: number) => void;
  variant?: "grid" | "carousel";
}) {
  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No featured work yet</Text>
      </View>
    );
  }

  const renderTile = (item: PortfolioTile, index: number, carousel: boolean) => {
    const uri = item.image?.trim();
    return (
      <AnimatedPressable
        key={item.id}
        style={carousel ? styles.carouselTile : styles.tile}
        entering={staggeredEntering(index)}
        onPress={() => {
          logger.debug("portfolio", "tile press", { id: item.id, index, variant });
          onPressItem?.(item, index);
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.fallback]}>
            <Text style={styles.fallbackText}>{(item.title ?? "?").slice(0, 1)}</Text>
          </View>
        )}
        <View style={carousel ? styles.carouselOverlay : styles.overlay}>
          {item.title ? (
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
          ) : null}
          {item.subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
        </View>
      </AnimatedPressable>
    );
  };

  if (variant === "carousel") {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
      >
        {items.map((item, index) => renderTile(item, index, true))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.grid}>
      {items.map((item, index) => renderTile(item, index, false))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  carousel: {
    gap: 12,
    paddingRight: 4,
  },
  tile: {
    width: "48.5%",
    aspectRatio: 0.85,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  carouselTile: {
    width: CAROUSEL_TILE_WIDTH,
    aspectRatio: 0.72,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
  },
  image: { width: "100%", height: "100%" },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
  },
  fallbackText: {
    color: colors.accent,
    fontSize: 28,
    fontFamily: fonts.serif,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    backgroundColor: colors.overlay,
    gap: 2,
  },
  carouselOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    gap: 2,
  },
  title: {
    color: colors.onImage,
    fontSize: 13,
    fontFamily: fonts.serifMedium,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.78)",
    fontSize: 10,
    fontFamily: fonts.mono,
  },
  empty: {
    paddingVertical: 28,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.mono,
  },
});
