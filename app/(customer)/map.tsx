import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { ProvidersMapView } from "@/src/components/ProvidersMapView";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

export default function MapScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const category = typeof params.category === "string" ? params.category : "";

  useEffect(() => {
    logger.debug("map", "mount ProvidersMapView", { category: category || undefined });
  }, [category]);

  return (
    <View style={styles.container}>
      <ProvidersMapView initialCategory={category} showCategoryChips />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
