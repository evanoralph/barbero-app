import React from "react";
import { RefreshControl, StyleSheet, type ViewStyle } from "react-native";
import Animated, { useAnimatedScrollHandler, type SharedValue } from "react-native-reanimated";
import { colors } from "@/src/theme/colors";
import { ScrollYContext } from "@/src/hooks/useScrollY";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  /**
   * Caller-owned shared value (create with useSharedValue(0)). Lifting this to the
   * caller lets absolutely-positioned siblings (e.g. a floating back button that
   * sits outside this scroll container) animate off the same scroll offset.
   */
  scrollY: SharedValue<number>;
};

/**
 * Drop-in replacement for `Screen scroll` on hero screens that need scroll-driven
 * animations (parallax cover, collapsing header). Also provides the offset via
 * context through useScrollY, for descendants that aren't passed it directly.
 */
export function AnimatedHeroScroll({ children, style, contentStyle, refreshing, onRefresh, scrollY }: Props) {
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  return (
    <ScrollYContext.Provider value={scrollY}>
      <Animated.ScrollView
        style={[styles.screen, style]}
        contentContainerStyle={[styles.screenContent, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.accent} />
          ) : undefined
        }
      >
        {children}
      </Animated.ScrollView>
    </ScrollYContext.Provider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: 20, paddingBottom: 40, gap: 14 },
});
