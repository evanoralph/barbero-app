import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { LoadingState } from "@/src/components/ui";
import { ProvidersMapView } from "@/src/components/ProvidersMapView";
import { useDiscoveryDisabledRedirect } from "@/src/hooks/useDiscoveryDisabledRedirect";
import { colors } from "@/src/theme/colors";
import { DEFAULT_FILTERS, type ExploreFilters } from "@/src/utils/exploreFilters";
import { logger } from "@/src/utils/logger";

export default function MapScreen() {
  const discoveryDisabled = useDiscoveryDisabledRedirect("map");
  const params = useLocalSearchParams<{ category?: string }>();
  const category = typeof params.category === "string" ? params.category : "";
  const [filters, setFilters] = useState<ExploreFilters>({ ...DEFAULT_FILTERS, category });

  useEffect(() => {
    if (discoveryDisabled) return;
    logger.debug("map", "mount ProvidersMapView", { category: category || undefined });
  }, [category, discoveryDisabled]);

  if (discoveryDisabled) {
    return <LoadingState />;
  }

  return (
    <View style={styles.container}>
      <ProvidersMapView filters={filters} onFiltersChange={setFilters} showCategoryChips />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
