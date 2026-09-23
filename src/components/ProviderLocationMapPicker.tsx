import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { Button, Muted } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { requestUserCoords } from "@/src/utils/location";
import { logger } from "@/src/utils/logger";

/** Manila default — PH marketplace. */
const DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 };
const PIN_DELTA = 0.012;

export type ProviderLocationCoords = { lat: number; lng: number };

type ProviderLocationMapPickerProps = {
  coords: ProviderLocationCoords | null;
  onChange: (coords: ProviderLocationCoords) => void;
};

function toRegion(coords: ProviderLocationCoords): Region {
  return {
    latitude: coords.lat,
    longitude: coords.lng,
    latitudeDelta: PIN_DELTA,
    longitudeDelta: PIN_DELTA,
  };
}

function hasValidCoords(
  coords: ProviderLocationCoords | null,
): coords is ProviderLocationCoords {
  return (
    coords != null &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng) &&
    !(coords.lat === 0 && coords.lng === 0)
  );
}

/**
 * Tap-to-pin / drag marker map for provider business location.
 * Keeps lat/lng in sync with parent form fields.
 */
export function ProviderLocationMapPicker({
  coords,
  onChange,
}: ProviderLocationMapPickerProps) {
  const mapRef = useRef<MapView | null>(null);
  const [locating, setLocating] = useState(false);
  const center = hasValidCoords(coords) ? coords : DEFAULT_CENTER;
  const region = useMemo(() => toRegion(center), [center.lat, center.lng]);

  useEffect(() => {
    if (!hasValidCoords(coords)) return;
    logger.debug("ProviderLocationMapPicker", "animate to pin", coords);
    console.log("[ProviderLocationMapPicker] animate to pin", coords.lat, coords.lng);
    mapRef.current?.animateToRegion(toRegion(coords), 350);
  }, [coords?.lat, coords?.lng]);

  const placePin = (next: ProviderLocationCoords) => {
    onChange(next);
    logger.info("ProviderLocationMapPicker", "pin placed", next);
    console.log("[ProviderLocationMapPicker] pin placed", next.lat, next.lng);
  };

  const useMyLocation = async () => {
    setLocating(true);
    logger.debug("ProviderLocationMapPicker", "use my location start");
    console.log("[ProviderLocationMapPicker] use my location start");
    try {
      const me = await requestUserCoords();
      if (!me) {
        logger.warn("ProviderLocationMapPicker", "location unavailable");
        console.log("[ProviderLocationMapPicker] location unavailable");
        return;
      }
      placePin(me);
      mapRef.current?.animateToRegion(toRegion(me), 350);
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Muted>
        Tap the map to place your pin, or drag the marker. Customers use this to find you.
      </Muted>
      <View style={styles.mapShell}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={region}
          onPress={(e) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            placePin({ lat: latitude, lng: longitude });
          }}
          onMapReady={() => {
            logger.debug("ProviderLocationMapPicker", "map ready", {
              hasPin: hasValidCoords(coords),
            });
            console.log("[ProviderLocationMapPicker] map ready");
          }}
        >
          {hasValidCoords(coords) ? (
            <Marker
              coordinate={{ latitude: coords.lat, longitude: coords.lng }}
              draggable
              onDragEnd={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                placePin({ lat: latitude, lng: longitude });
              }}
              title="Your location"
            />
          ) : null}
        </MapView>
      </View>
      <Button
        label={locating ? "Locating…" : "Use my location"}
        variant="secondary"
        onPress={() => void useMyLocation()}
        loading={locating}
        disabled={locating}
      />
      {hasValidCoords(coords) ? (
        <Muted>
          Pin at {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
        </Muted>
      ) : (
        <Muted>No pin yet — tap the map or search an address above.</Muted>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  mapShell: {
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgDeep,
  },
  map: { flex: 1 },
});
