import { router } from "expo-router";
import { MapPin } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { updateAccountMe } from "@/src/api/account";
import { Button, Muted, Screen, Title } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { setDiscoveryLocation } from "@/src/utils/discoveryLocation";
import {
  requestUserCoords,
  reverseGeocodeLabel,
} from "@/src/utils/location";
import { logger } from "@/src/utils/logger";

export default function LocationPermissionScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishToHome = () => {
    logger.info("location-permission", "navigate customer home");
    console.log("[location-permission] → customer home");
    router.replace("/(customer)");
  };

  const onAllow = async () => {
    setError(null);
    setLoading(true);
    logger.info("location-permission", "allow tap — requesting GPS");
    console.log("[location-permission] allow tap");
    try {
      const coords = await requestUserCoords();
      if (!coords) {
        logger.warn("location-permission", "GPS denied/unavailable → manual");
        console.log("[location-permission] GPS denied → manual");
        router.push("/(auth)/location-manual");
        return;
      }
      const label = await reverseGeocodeLabel(coords);
      await setDiscoveryLocation({
        lat: coords.lat,
        lng: coords.lng,
        label,
        source: "gps",
      });
      try {
        if (label && label !== "Current location") {
          await updateAccountMe({ city: label });
          logger.debug("location-permission", "account city updated", { city: label });
          console.log("[location-permission] account city updated", label);
        }
      } catch (e) {
        logger.warn("location-permission", "account city update failed (continuing)", e);
        console.log("[location-permission] account city update failed", e);
      }
      finishToHome();
    } catch (e) {
      setError("Unable to get your location. You can enter a city instead.");
      logger.warn("location-permission", "allow failed", e);
      console.log("[location-permission] allow failed", e);
    } finally {
      setLoading(false);
    }
  };

  const onEnterInstead = () => {
    logger.info("location-permission", "enter location instead");
    console.log("[location-permission] → manual");
    router.push("/(auth)/location-manual");
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.iconWrap}>
        <MapPin color={colors.accent} size={40} strokeWidth={1.75} />
      </View>
      <Title>Find artists near you</Title>
      <Muted style={styles.body}>
        Allow location so we can show nearby barbers, tattoo artists, and salons.
        You can change this later.
      </Muted>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        label="Allow location"
        onPress={onAllow}
        loading={loading}
        testID="location-allow"
      />
      <Button
        label="Enter location instead"
        variant="secondary"
        onPress={onEnterInstead}
        disabled={loading}
        testID="location-enter-instead"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", gap: 16 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bgDeep,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 8,
  },
  body: { textAlign: "center", marginBottom: 8 },
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
});
