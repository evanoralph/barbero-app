import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import type { PortfolioTile } from "@/src/components/PortfolioGrid";
import { fonts } from "@/src/theme/fonts";
import { logger } from "@/src/utils/logger";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export function PortfolioLightbox({
  items,
  initialIndex,
  visible,
  onClose,
}: {
  items: PortfolioTile[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<PortfolioTile>>(null);
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) {
      const safe = Math.max(0, Math.min(initialIndex, items.length - 1));
      setIndex(safe);
      logger.debug("portfolio-lightbox", "open", { index: safe, count: items.length });
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: safe, animated: false });
      });
    }
  }, [visible, initialIndex, items.length]);

  const handleClose = () => {
    logger.debug("portfolio-lightbox", "close", { index });
    onClose();
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) {
        setIndex(first.index);
        logger.debug("portfolio-lightbox", "page", { index: first.index });
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;

  const onScrollToIndexFailed = useCallback(
    (info: { index: number }) => {
      logger.warn("portfolio-lightbox", "scrollToIndex failed", info);
      setTimeout(() => {
        listRef.current?.scrollToOffset({
          offset: info.index * SCREEN_W,
          animated: false,
        });
      }, 50);
    },
    [],
  );

  const current = items[index];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={[styles.close, { top: insets.top + 8 }]}
          onPress={handleClose}
          hitSlop={12}
          accessibilityLabel="Close gallery"
        >
          <X color="#FFFFFF" size={22} strokeWidth={2} />
        </Pressable>

        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.max(0, Math.min(initialIndex, items.length - 1))}
          getItemLayout={(_, i) => ({
            length: SCREEN_W,
            offset: SCREEN_W * i,
            index: i,
          })}
          onScrollToIndexFailed={onScrollToIndexFailed}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            if (next !== index) {
              setIndex(next);
              logger.debug("portfolio-lightbox", "swipe", { index: next });
            }
          }}
          renderItem={({ item }) => {
            const uri = item.image?.trim();
            return (
              <View style={styles.page}>
                {uri ? (
                  <Image source={{ uri }} style={styles.image} resizeMode="contain" />
                ) : (
                  <View style={styles.fallback}>
                    <Text style={styles.fallbackText}>
                      {(item.title ?? "?").slice(0, 1)}
                    </Text>
                  </View>
                )}
              </View>
            );
          }}
        />

        <View style={[styles.meta, { paddingBottom: insets.bottom + 20 }]}>
          {current?.title ? (
            <Text style={styles.title} numberOfLines={2}>
              {current.title}
            </Text>
          ) : null}
          {current?.description ? (
            <Text style={styles.description} numberOfLines={3}>
              {current.description}
            </Text>
          ) : null}
          <Text style={styles.counter}>
            {items.length > 0 ? `${index + 1} / ${items.length}` : "0 / 0"}
            {typeof current?.likes === "number" ? `  ·  ${current.likes} likes` : ""}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.96)",
    justifyContent: "center",
  },
  close: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  page: {
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H * 0.72,
  },
  fallback: {
    width: SCREEN_W * 0.8,
    height: SCREEN_H * 0.5,
    borderRadius: 16,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    color: "#C9973A",
    fontSize: 48,
    fontFamily: fonts.serif,
  },
  meta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    gap: 6,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    paddingTop: 16,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: fonts.serifMedium,
  },
  description: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 14,
    fontFamily: fonts.mono,
    lineHeight: 20,
  },
  counter: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 12,
    fontFamily: fonts.mono,
    marginTop: 4,
  },
});
