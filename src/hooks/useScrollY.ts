import { createContext, useContext } from "react";
import type { SharedValue } from "react-native-reanimated";

export const ScrollYContext = createContext<SharedValue<number> | null>(null);

/** Reads the scroll offset shared value from the nearest AnimatedHeroScroll. */
export function useScrollY(): SharedValue<number> {
  const ctx = useContext(ScrollYContext);
  if (!ctx) {
    throw new Error("useScrollY must be used within an AnimatedHeroScroll");
  }
  return ctx;
}
