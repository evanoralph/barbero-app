import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { updateAccountMe } from "@/src/api/account";
import type { PlaceDetails } from "@/src/api/geo";
import { PhPlacesSearchField } from "@/src/components/PhPlacesSearchField";
import { ProvidersMapView } from "@/src/components/ProvidersMapView";
import { colors } from "@/src/theme/colors";
import {
  getDiscoveryLocation,
  setDiscoveryLocation,
} from "@/src/utils/discoveryLocation";
import { DEFAULT_FILTERS, type ExploreFilters } from "@/src/utils/exploreFilters";
import type { UserCoords } from "@/src/utils/location";
import { logger } from "@/src/utils/logger";

function parseCoord(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseLabel(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim() : "";
}

export default function MapScreen() {
  const params = useLocalSearchParams<{
    category?: string;
    lat?: string;
    lng?: string;
    label?: string;
    source?: string;
  }>();
  const category = typeof params.category === "string" ? params.category : "";
  const routeLat = parseCoord(params.lat);
  const routeLng = parseCoord(params.lng);
  const routeLabel = parseLabel(params.label);
  const routeCoords = useMemo((): UserCoords | null => {
    if (routeLat == null || routeLng == null) return null;
    return { lat: routeLat, lng: routeLng };
  }, [routeLat, routeLng]);

  const [filters, setFilters] = useState<ExploreFilters>({
    ...DEFAULT_FILTERS,
    category,
  });
  const [userCoords, setUserCoords] = useState<UserCoords | null>(routeCoords);
  const [locationSource, setLocationSource] = useState<"gps" | "manual" | null>(
    routeCoords ? "manual" : null,
  );
  const [locationQuery, setLocationQuery] = useState(routeLabel);

  useEffect(() => {
    logger.debug("map", "mount ProvidersMapView", {
      category: category || undefined,
      hasRouteCoords: Boolean(routeCoords),
      routeLabel: routeLabel || undefined,
    });
    console.log("[map] mount ProvidersMapView", {
      category: category || undefined,
      hasRouteCoords: Boolean(routeCoords),
      routeLabel: routeLabel || undefined,
    });
  }, [category, routeCoords, routeLabel]);

  // Apply deep-link / home-search params as soon as they change.
  useEffect(() => {
    if (!routeCoords) return;
    setUserCoords(routeCoords);
    setLocationSource("manual");
    if (routeLabel) setLocationQuery(routeLabel);
    logger.info("map", "apply route location", {
      lat: routeCoords.lat,
      lng: routeCoords.lng,
      label: routeLabel || undefined,
    });
    console.log("[map] apply route location", routeLabel, routeCoords);
  }, [routeCoords, routeLabel]);

  // Re-sync from local storage when focusing (e.g. after home place pick).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getDiscoveryLocation().then((saved) => {
        if (cancelled || !saved) {
          if (!cancelled && !routeCoords) {
            logger.debug("map", "no discovery location — map uses default center");
            console.log("[map] no discovery location");
          }
          return;
        }
        // Prefer fresh route params when present; otherwise use saved location.
        if (routeCoords) {
          console.log(
            "[map] focus — route coords already applied, saved label",
            saved.label,
          );
          return;
        }
        setUserCoords({ lat: saved.lat, lng: saved.lng });
        setLocationSource(saved.source);
        setLocationQuery(saved.label);
        logger.debug("map", "focus sync saved discovery location", {
          source: saved.source,
          label: saved.label,
        });
        console.log(
          "[map] focus sync saved location (no places search)",
          saved.source,
          saved.label,
        );
      });
      return () => {
        cancelled = true;
      };
    }, [routeCoords]),
  );

  const applyPlaceLocation = useCallback(async (place: PlaceDetails) => {
    logger.info("map", "places selected", {
      label: place.label,
      placeIdPrefix: place.placeId.slice(0, 12),
    });
    console.log("[map] places selected", place.label);
    const next = await setDiscoveryLocation({
      lat: place.lat,
      lng: place.lng,
      label: place.label,
      source: "manual",
    });
    setUserCoords({ lat: place.lat, lng: place.lng });
    setLocationSource(next.source);
    setLocationQuery(place.label);
    try {
      await updateAccountMe({ city: place.city || place.label });
      console.log("[map] account city updated", place.city || place.label);
    } catch (e) {
      logger.warn("map", "account city update failed (continuing)", e);
      console.log("[map] account city update failed", e);
    }
  }, []);

  return (
    <View style={styles.container}>
      <ProvidersMapView
        filters={filters}
        onFiltersChange={setFilters}
        showCategoryChips
        centerOnUser={Boolean(userCoords)}
        userCoordinate={userCoords}
        showsUserLocation={locationSource === "gps"}
        topOverlay={
          <View style={styles.searchCard}>
            <PhPlacesSearchField
              compact
              label="Search address"
              placeholder="Search city or area in PH"
              value={locationQuery}
              onChangeText={setLocationQuery}
              onPlaceSelected={applyPlaceLocation}
              onClear={() => {
                logger.debug("map", "clear address field");
                console.log("[map] clear address field");
              }}
              testID="map-location-search"
            />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  searchCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    // Lift suggestions above map chrome.
    zIndex: 40,
    elevation: 8,
  },
});
