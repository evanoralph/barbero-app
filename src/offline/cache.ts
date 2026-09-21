import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "@/src/utils/logger";

const PREFIX = "barbero_cache:v1:";

export type CacheEntry<T> = { data: T; savedAt: number };

/** Read a cached API result; null on miss or any storage/parse failure. */
export async function readCache<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    return parsed;
  } catch (error) {
    logger.warn("cache", "read failed", { key, error });
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<number> {
  const savedAt = Date.now();
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt }));
  } catch (error) {
    logger.warn("cache", "write failed", { key, error });
  }
  return savedAt;
}

/** Drop every cached result (called on sign-out so private lists never leak across accounts). */
export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(PREFIX));
    if (mine.length) await AsyncStorage.multiRemove(mine);
    logger.info("cache", "cleared", { count: mine.length });
  } catch (error) {
    logger.warn("cache", "clear failed", error);
  }
}

/** "Saved 12 min ago" style label for the stale badge. */
export function savedAgoLabel(savedAt: number | null, now = Date.now()): string {
  if (!savedAt) return "Saved offline";
  const min = Math.max(0, Math.round((now - savedAt) / 60000));
  if (min < 1) return "Saved just now";
  if (min < 60) return `Saved ${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `Saved ${hr} h ago`;
  const days = Math.round(hr / 24);
  return `Saved ${days} day${days === 1 ? "" : "s"} ago`;
}

/** "Updated just now" style label for the fetched-state indicator. */
export function updatedAgoLabel(updatedAt: number | null, now = Date.now()): string {
  if (!updatedAt) return "";
  const min = Math.max(0, Math.round((now - updatedAt) / 60000));
  if (min < 1) return "Updated just now";
  if (min < 60) return `Updated ${min} min ago`;
  return `Updated ${Math.round(min / 60)} h ago`;
}
