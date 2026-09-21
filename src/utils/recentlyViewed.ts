import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ProviderListItem } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

const VIEWED_KEY = "barbero_recently_viewed:v1";
const SEARCHES_KEY = "barbero_recent_searches:v1";
const MAX_VIEWED = 10;
const MAX_SEARCHES = 5;

/** Just enough of a provider to draw the portrait card without a network round-trip. */
export type ViewedProvider = Pick<
  ProviderListItem,
  "_id" | "slug" | "name" | "categorySlug" | "avatar" | "coverImage" | "rating" | "isFeatured" | "isPremium"
>;

async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    logger.warn("recent", "read failed", { key, error });
    return [];
  }
}

async function writeList<T>(key: string, list: T[]) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch (error) {
    logger.warn("recent", "write failed", { key, error });
  }
}

export const listRecentlyViewed = () => readList<ViewedProvider>(VIEWED_KEY);

export async function recordViewed(p: ViewedProvider) {
  const snapshot: ViewedProvider = {
    _id: p._id,
    slug: p.slug,
    name: p.name,
    categorySlug: p.categorySlug,
    avatar: p.avatar,
    coverImage: p.coverImage,
    rating: p.rating,
    isFeatured: p.isFeatured,
    isPremium: p.isPremium,
  };
  const rest = (await listRecentlyViewed()).filter((x) => x._id !== p._id);
  await writeList(VIEWED_KEY, [snapshot, ...rest].slice(0, MAX_VIEWED));
}

export const clearRecentlyViewed = () => writeList<ViewedProvider>(VIEWED_KEY, []);

export const listRecentSearches = () => readList<string>(SEARCHES_KEY);

export async function recordSearch(query: string) {
  const q = query.trim();
  if (q.length < 2) return;
  const rest = (await listRecentSearches()).filter((x) => x.toLowerCase() !== q.toLowerCase());
  await writeList(SEARCHES_KEY, [q, ...rest].slice(0, MAX_SEARCHES));
}

/** Fill the list-card fields a snapshot doesn't carry so it can render as a ProviderListItem. */
export function viewedToListItem(v: ViewedProvider): ProviderListItem {
  return {
    ...v,
    bio: "",
    location: { address: "", city: "", lat: 0, lng: 0 },
    reviewCount: 0,
    responseTime: "",
    startingPrice: 0,
    serviceCount: 0,
  };
}
