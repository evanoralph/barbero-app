import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ProviderListItem } from "@/src/types/api";
import { distanceKm, type UserCoords } from "@/src/utils/location";
import { logger } from "@/src/utils/logger";

const STORAGE_KEY = "barbero_discovery_location:v1";

export type DiscoveryLocationSource = "gps" | "manual";

export type DiscoveryLocation = {
  lat: number;
  lng: number;
  label: string;
  source: DiscoveryLocationSource;
  completedAt: string;
};

/** Stepwise radii for home nearby expand fallback. */
export const NEARBY_RADIUS_STEPS_KM = [5, 15, 25, 40] as const;
export const NEARBY_PRIMARY_RADIUS_KM = NEARBY_RADIUS_STEPS_KM[0];

export type NearbyExpandResult = {
  items: Array<{ p: ProviderListItem; km: number }>;
  effectiveRadiusKm: number;
  fellBack: boolean;
};

function isValidLocation(value: unknown): value is DiscoveryLocation {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.lat === "number" &&
    Number.isFinite(v.lat) &&
    typeof v.lng === "number" &&
    Number.isFinite(v.lng) &&
    typeof v.label === "string" &&
    (v.source === "gps" || v.source === "manual") &&
    typeof v.completedAt === "string"
  );
}

export async function getDiscoveryLocation(): Promise<DiscoveryLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      logger.debug("discoveryLocation", "get — empty");
      console.log("[discoveryLocation] get empty");
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isValidLocation(parsed)) {
      logger.warn("discoveryLocation", "get — invalid shape, clearing");
      console.log("[discoveryLocation] get invalid — clearing");
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    logger.debug("discoveryLocation", "get ok", {
      source: parsed.source,
      label: parsed.label,
      lat: parsed.lat,
      lng: parsed.lng,
    });
    console.log("[discoveryLocation] get ok", parsed.source, parsed.label);
    return parsed;
  } catch (error) {
    logger.warn("discoveryLocation", "get failed", error);
    console.log("[discoveryLocation] get failed", error);
    return null;
  }
}

export async function setDiscoveryLocation(input: {
  lat: number;
  lng: number;
  label: string;
  source: DiscoveryLocationSource;
}): Promise<DiscoveryLocation> {
  const next: DiscoveryLocation = {
    lat: input.lat,
    lng: input.lng,
    label: input.label.trim() || (input.source === "gps" ? "Current location" : "Selected area"),
    source: input.source,
    completedAt: new Date().toISOString(),
  };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    logger.info("discoveryLocation", "set ok", {
      source: next.source,
      label: next.label,
      lat: next.lat,
      lng: next.lng,
    });
    console.log("[discoveryLocation] set ok", next.source, next.label);
  } catch (error) {
    logger.warn("discoveryLocation", "set failed", error);
    console.log("[discoveryLocation] set failed", error);
  }
  return next;
}

export async function clearDiscoveryLocation(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    logger.info("discoveryLocation", "cleared");
    console.log("[discoveryLocation] cleared");
  } catch (error) {
    logger.warn("discoveryLocation", "clear failed", error);
    console.log("[discoveryLocation] clear failed", error);
  }
}

/** True when the customer has completed the post-login location gate. */
export async function hasDiscoveryLocation(): Promise<boolean> {
  const loc = await getDiscoveryLocation();
  return Boolean(loc);
}

/**
 * Filter providers by expanding radius (5 → 15 → 25 → 40 km).
 * Returns empty items when nothing is within the largest step.
 */
export function nearbyWithExpandRadius(
  providers: ProviderListItem[],
  coords: UserCoords,
  limit = 8,
): NearbyExpandResult {
  const ranked = providers
    .filter((p) => Number.isFinite(p.location?.lat) && Number.isFinite(p.location?.lng))
    .map((p) => ({
      p,
      km: distanceKm(coords, { lat: p.location.lat, lng: p.location.lng }),
    }))
    .sort((a, b) => a.km - b.km);

  for (let i = 0; i < NEARBY_RADIUS_STEPS_KM.length; i++) {
    const radius = NEARBY_RADIUS_STEPS_KM[i];
    const hits = ranked.filter((x) => x.km <= radius).slice(0, limit);
    if (hits.length > 0) {
      const fellBack = i > 0;
      logger.debug("discoveryLocation", "nearbyWithExpandRadius", {
        effectiveRadiusKm: radius,
        fellBack,
        count: hits.length,
      });
      console.log(
        "[discoveryLocation] nearby",
        hits.length,
        "within",
        radius,
        "km",
        fellBack ? "(fell back)" : "",
      );
      return { items: hits, effectiveRadiusKm: radius, fellBack };
    }
  }

  const maxRadius = NEARBY_RADIUS_STEPS_KM[NEARBY_RADIUS_STEPS_KM.length - 1];
  logger.debug("discoveryLocation", "nearbyWithExpandRadius empty", {
    effectiveRadiusKm: maxRadius,
  });
  console.log("[discoveryLocation] nearby empty after", maxRadius, "km");
  return { items: [], effectiveRadiusKm: maxRadius, fellBack: true };
}
