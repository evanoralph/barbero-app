import { useEffect, useState } from "react";
import { requestUserCoords, type UserCoords } from "@/src/utils/location";

let cached: UserCoords | null = null;
let inflight: Promise<UserCoords | null> | null = null;

/**
 * Device location for distance filtering. Only asks for permission once `enabled` flips true
 * (first time the user opens Filters), and shares the result across screens.
 */
export function useUserCoords(enabled: boolean): UserCoords | null {
  const [coords, setCoords] = useState<UserCoords | null>(cached);

  useEffect(() => {
    if (!enabled || cached) return;
    inflight ??= requestUserCoords().finally(() => {
      inflight = null;
    });
    let cancelled = false;
    void inflight.then((c) => {
      if (c) cached = c;
      if (!cancelled) setCoords(c);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return coords;
}
