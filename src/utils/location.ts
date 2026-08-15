import * as Location from "expo-location";
import { logger } from "@/src/utils/logger";

export type UserCoords = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

/** Haversine distance in kilometers between two lat/lng points. */
export function distanceKm(a: UserCoords, b: UserCoords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Request when-in-use location permission and return current coords.
 * Returns null on deny / error so callers can fall back gracefully.
 */
export async function requestUserCoords(): Promise<UserCoords | null> {
  logger.debug("location", "requestUserCoords start");
  console.log("[location] requestUserCoords start");
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    logger.debug("location", "permission result", { status });
    console.log("[location] permission", status);
    if (status !== Location.PermissionStatus.GRANTED) {
      logger.warn("location", "permission denied", { status });
      console.log("[location] permission denied");
      return null;
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const coords: UserCoords = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    };
    logger.debug("location", "coords ok", {
      lat: coords.lat,
      lng: coords.lng,
    });
    console.log("[location] coords", coords.lat, coords.lng);
    return coords;
  } catch (e) {
    logger.warn("location", "requestUserCoords failed", e);
    console.log("[location] requestUserCoords failed", e);
    return null;
  }
}

/** Build a bbox around a point for map API queries (delta ≈ nearby city area). */
export function bboxAround(
  coords: UserCoords,
  delta = 0.06,
): { swLat: number; swLng: number; neLat: number; neLng: number } {
  return {
    swLat: coords.lat - delta,
    swLng: coords.lng - delta,
    neLat: coords.lat + delta,
    neLng: coords.lng + delta,
  };
}
