import type { ProviderListItem, ProviderMapMarker } from "@/src/types/api";
import { distanceKm, type UserCoords } from "@/src/utils/location";

export type PriceTier = 0 | 1 | 2 | 3;
export type Availability = "any" | "today" | "week";

/** Slider maximum; at this value distance is not filtered. */
export const ANY_DISTANCE_KM = 25;

export type ExploreFilters = {
  /** "" = all categories. */
  category: string;
  /** 0 = any; 1 = under ₱400; 2 = ₱400–₱800; 3 = ₱800+ (matched on startingPrice). */
  price: PriceTier;
  distanceKm: number;
  availability: Availability;
};

export const DEFAULT_FILTERS: ExploreFilters = {
  category: "",
  price: 0,
  distanceKm: ANY_DISTANCE_KM,
  availability: "any",
};

export const CATEGORY_OPTIONS = ["", "barber", "tattoo", "nails", "salon"] as const;

export const PRICE_LABELS: Record<PriceTier, string> = {
  0: "Any price",
  1: "Under ₱400",
  2: "₱400 – ₱800",
  3: "₱800+",
};

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  any: "Anytime",
  today: "Today",
  week: "This week",
};

export function distanceLabel(km: number): string {
  return km >= ANY_DISTANCE_KM ? "Any distance" : `Within ${km} km`;
}

export function activeFilterCount(f: ExploreFilters): number {
  return (
    (f.category !== "" ? 1 : 0) +
    (f.price !== 0 ? 1 : 0) +
    (f.distanceKm < ANY_DISTANCE_KM ? 1 : 0) +
    (f.availability !== "any" ? 1 : 0)
  );
}

export type FilterKey = keyof ExploreFilters;

export function appliedChips(f: ExploreFilters): { key: FilterKey; label: string }[] {
  const chips: { key: FilterKey; label: string }[] = [];
  if (f.category) chips.push({ key: "category", label: f.category[0].toUpperCase() + f.category.slice(1) });
  if (f.price) chips.push({ key: "price", label: PRICE_LABELS[f.price] });
  if (f.distanceKm < ANY_DISTANCE_KM) chips.push({ key: "distanceKm", label: distanceLabel(f.distanceKm) });
  if (f.availability !== "any") chips.push({ key: "availability", label: AVAILABILITY_LABELS[f.availability] });
  return chips;
}

export function clearFilter(f: ExploreFilters, key: FilterKey): ExploreFilters {
  return { ...f, [key]: DEFAULT_FILTERS[key] };
}

function priceMatches(price: number, tier: PriceTier): boolean {
  if (tier === 0) return true;
  if (tier === 1) return price < 400;
  if (tier === 2) return price >= 400 && price <= 800;
  return price > 800;
}

/**
 * Applies category / price / distance to a result set. Availability has no per-provider
 * field in the list payload yet, so it is not filtered here (the API receives it instead).
 * Without user coordinates the distance filter is skipped rather than hiding everything.
 */
export function filterProviders(
  items: ProviderListItem[],
  f: ExploreFilters,
  coords: UserCoords | null,
): ProviderListItem[] {
  return items.filter((p) => {
    if (f.category && p.categorySlug !== f.category) return false;
    if (!priceMatches(p.startingPrice, f.price)) return false;
    if (coords && f.distanceKm < ANY_DISTANCE_KM) {
      if (distanceKm(coords, { lat: p.location.lat, lng: p.location.lng }) > f.distanceKm) return false;
    }
    return true;
  });
}

/** Map markers carry no price; category is filtered server-side, distance here. */
export function filterMarkers(
  markers: ProviderMapMarker[],
  f: ExploreFilters,
  coords: UserCoords | null,
): ProviderMapMarker[] {
  if (!coords || f.distanceKm >= ANY_DISTANCE_KM) return markers;
  return markers.filter((m) => distanceKm(coords, { lat: m.lat, lng: m.lng }) <= f.distanceKm);
}
