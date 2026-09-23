import { apiRequest } from "@/src/api/client";
import { logger } from "@/src/utils/logger";

export type PlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
};

export type PlaceDetails = {
  placeId: string;
  label: string;
  lat: number;
  lng: number;
  city?: string;
};

/** New Places session token so autocomplete + details bill as one session. */
export function createPlacesSessionToken(): string {
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  logger.debug("geo-api", "createPlacesSessionToken");
  console.log("[geo-api] new session token");
  return token;
}

export function autocompletePlaces(q: string, sessionToken?: string) {
  const params = new URLSearchParams({ q: q.trim() });
  if (sessionToken) params.set("sessionToken", sessionToken);
  logger.debug("geo-api", "autocompletePlaces", { qLen: q.trim().length });
  console.log("[geo-api] autocomplete", q.trim().length);
  return apiRequest<PlaceSuggestion[]>(
    `/geo/places/autocomplete?${params.toString()}`,
  );
}

export function getPlaceDetails(placeId: string, sessionToken?: string) {
  const params = new URLSearchParams({ placeId });
  if (sessionToken) params.set("sessionToken", sessionToken);
  logger.debug("geo-api", "getPlaceDetails", {
    placeIdPrefix: placeId.slice(0, 12),
  });
  console.log("[geo-api] details", placeId.slice(0, 12));
  return apiRequest<PlaceDetails>(`/geo/places/details?${params.toString()}`);
}
