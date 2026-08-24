import { FadeInDown } from "react-native-reanimated";

const MAX_STAGGER_INDEX = 9;

/** Consistent stagger timing for list/grid entrance animations, capped so long lists don't feel sluggish. */
export function staggeredEntering(index: number, baseDelayMs = 40) {
  const clampedIndex = Math.min(index, MAX_STAGGER_INDEX);
  return FadeInDown.delay(clampedIndex * baseDelayMs).duration(280).springify();
}
