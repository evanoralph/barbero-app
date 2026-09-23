import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { updateAccountMe } from "@/src/api/account";
import type { PlaceDetails } from "@/src/api/geo";
import { ApiError } from "@/src/api/client";
import { PhPlacesSearchField } from "@/src/components/PhPlacesSearchField";
import { Button, Muted, Screen, Title } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { setDiscoveryLocation } from "@/src/utils/discoveryLocation";
import {
  requestUserCoords,
  reverseGeocodeLabel,
} from "@/src/utils/location";
import { logger } from "@/src/utils/logger";

export default function LocationManualScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const isChange = params.mode === "change";
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const finishToHome = () => {
    logger.info("location-manual", "navigate customer home", { isChange });
    console.log("[location-manual] → customer home", { isChange });
    if (isChange && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(customer)");
  };

  const savePlace = async (place: PlaceDetails) => {
    setSaving(true);
    setError(null);
    logger.info("location-manual", "save place", {
      placeIdPrefix: place.placeId.slice(0, 12),
      label: place.label,
    });
    console.log("[location-manual] save place", place.label);
    try {
      await setDiscoveryLocation({
        lat: place.lat,
        lng: place.lng,
        label: place.label,
        source: "manual",
      });
      try {
        await updateAccountMe({ city: place.city || place.label });
        logger.debug("location-manual", "account city updated", {
          city: place.city || place.label,
        });
        console.log(
          "[location-manual] account city updated",
          place.city || place.label,
        );
      } catch (e) {
        logger.warn("location-manual", "account city update failed (continuing)", e);
        console.log("[location-manual] account city update failed", e);
      }
      finishToHome();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Unable to save that location. Try again.",
      );
      logger.warn("location-manual", "save failed", e);
      console.log("[location-manual] save failed", e);
    } finally {
      setSaving(false);
    }
  };

  const onTryGps = async () => {
    setError(null);
    setGpsLoading(true);
    logger.info("location-manual", "try GPS again");
    console.log("[location-manual] try GPS again");
    try {
      const coords = await requestUserCoords();
      if (!coords) {
        setError("Location permission is still off. Search a city below.");
        logger.warn("location-manual", "GPS still denied");
        return;
      }
      const label = await reverseGeocodeLabel(coords);
      await setDiscoveryLocation({
        lat: coords.lat,
        lng: coords.lng,
        label,
        source: "gps",
      });
      finishToHome();
    } catch (e) {
      setError("Unable to get GPS. Search a city instead.");
      logger.warn("location-manual", "try GPS failed", e);
      console.log("[location-manual] try GPS failed", e);
    } finally {
      setGpsLoading(false);
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{isChange ? "Change location" : "Where should we look?"}</Title>
      <Muted>
        Search a city or area in the Philippines and we&apos;ll show artists
        near there.
      </Muted>
      <PhPlacesSearchField
        value={query}
        onChangeText={setQuery}
        onPlaceSelected={savePlace}
        disabled={saving || gpsLoading}
        testID="location-manual-input"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Muted style={styles.hint}>
        Tap a suggestion to continue — Philippines only.
      </Muted>
      <Button
        label="Try again with GPS"
        variant="ghost"
        onPress={onTryGps}
        loading={gpsLoading}
        disabled={saving}
        testID="location-manual-try-gps"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingTop: 8 },
  error: { color: colors.danger, fontSize: 14 },
  hint: { marginTop: -4 },
});
