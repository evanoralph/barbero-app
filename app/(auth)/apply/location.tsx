import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { ApiError } from "@/src/api/client";
import { updateProviderApply } from "@/src/api/providerApply";
import { Button, Field, Muted, Screen, Title } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

function parseOptionalCoord(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : NaN;
}

export default function ApplyLocationScreen() {
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);

    const parsedLat = parseOptionalCoord(lat);
    const parsedLng = parseOptionalCoord(lng);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      setError("Latitude/longitude must be numbers");
      return;
    }
    if ((parsedLat === null) !== (parsedLng === null)) {
      setError("Provide both latitude and longitude, or leave both empty");
      return;
    }

    setLoading(true);
    try {
      await updateProviderApply({
        location: {
          address: address.trim(),
          city: city.trim(),
          lat: parsedLat ?? 0,
          lng: parsedLng ?? 0,
        },
      });
      router.push("/(auth)/apply/proofs");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to save location");
      logger.warn("apply-location", "failed", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Title>Location</Title>
      <Muted>Where can customers find you?</Muted>
      <Field label="Address" value={address} onChangeText={setAddress} />
      <Field label="City" value={city} onChangeText={setCity} />
      <Field label="Latitude (optional)" keyboardType="numeric" value={lat} onChangeText={setLat} />
      <Field label="Longitude (optional)" keyboardType="numeric" value={lng} onChangeText={setLng} />
      <Muted>Map pin uses lat/lng so customers can find you on the map.</Muted>
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button label="Continue" onPress={onSubmit} loading={loading} disabled={!city.trim()} />
    </Screen>
  );
}
