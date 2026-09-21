import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/src/api/client";
import { readCache, writeCache } from "@/src/offline/cache";
import { logger } from "@/src/utils/logger";

type Options<T> = {
  /** Unique per (endpoint + params + user). Null disables the query. */
  key: string | null;
  fetcher: () => Promise<T>;
  /** Wait this long after `key` changes before fetching (search typing). */
  debounceMs?: number;
};

export type CachedQuery<T> = {
  data: T | null;
  /** No data at all yet (first load, nothing cached) → show skeletons. */
  loading: boolean;
  /** Data on screen and a request in flight → dim the list, show "Refining…". */
  refetching: boolean;
  /** Pull-to-refresh spinner. */
  refreshing: boolean;
  /** Request failed and there is nothing to fall back to. */
  error: string | null;
  /** The failure was a network failure (offline empty state instead of error). */
  offline: boolean;
  /** Data on screen came from storage, not from a request this session. */
  stale: boolean;
  /** When the data on screen was last written (cache) or fetched. */
  savedAt: number | null;
  refetch: () => Promise<void>;
  refresh: () => Promise<void>;
};

/**
 * Stale-while-revalidate for API reads: paint cached data immediately, refetch in the
 * background, and keep the cached data (marked stale) when the network is unreachable.
 */
export function useCachedQuery<T>({ key, fetcher, debounceMs = 0 }: Options<T>): CachedQuery<T> {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState<T | null>(null);
  const [fetching, setFetching] = useState(key !== null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [stale, setStale] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const runId = useRef(0);
  const hasData = useRef(false);

  const run = useCallback(async () => {
    if (key === null) return;
    const id = ++runId.current;
    setFetching(true);
    try {
      const next = await fetcherRef.current();
      if (id !== runId.current) return;
      hasData.current = true;
      setData(next);
      setError(null);
      setOffline(false);
      setStale(false);
      const at = await writeCache(key, next);
      if (id === runId.current) setSavedAt(at);
    } catch (e) {
      if (id !== runId.current) return;
      const isNetwork = e instanceof ApiError && e.code === "NETWORK";
      logger.warn("query", "fetch failed", { key, network: isNetwork });
      setOffline(isNetwork);
      if (hasData.current) {
        // Keep what is on screen; it is now known-stale.
        setStale(true);
        setError(isNetwork ? null : e instanceof Error ? e.message : "Request failed");
      } else {
        setError(e instanceof Error ? e.message : "Request failed");
      }
    } finally {
      if (id === runId.current) setFetching(false);
    }
  }, [key]);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    hasData.current = false;
    setData(null);
    setError(null);
    setOffline(false);
    setSavedAt(null);
    setStale(false);
    setFetching(true);

    void readCache<T>(key).then((hit) => {
      if (cancelled || !hit) return;
      // Only paint the cache if the network hasn't already answered.
      if (!hasData.current) {
        hasData.current = true;
        setData(hit.data);
        setSavedAt(hit.savedAt);
        setStale(true);
      }
    });

    const timer = setTimeout(() => void run(), debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      runId.current += 1;
    };
  }, [key, debounceMs, run]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await run();
    } finally {
      setRefreshing(false);
    }
  }, [run]);

  const hasAny = data !== null;
  return {
    data,
    loading: fetching && !hasAny,
    refetching: fetching && hasAny && !refreshing,
    refreshing,
    error: hasAny ? null : error,
    offline,
    stale,
    savedAt,
    refetch: run,
    refresh,
  };
}
