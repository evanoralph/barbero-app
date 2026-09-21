import { Info, MapPin, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedPressable } from "@/src/components/animated/AnimatedPressable";
import { Chip, SegmentedControl } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import {
  ANY_DISTANCE_KM,
  AVAILABILITY_LABELS,
  CATEGORY_OPTIONS,
  DEFAULT_FILTERS,
  PRICE_LABELS,
  distanceLabel,
  type Availability,
  type ExploreFilters,
  type PriceTier,
} from "@/src/utils/exploreFilters";

const ANIM_MS = 260;
const MIN_KM = 1;

type Props = {
  visible: boolean;
  filters: ExploreFilters;
  /** Result count for a draft, computed from the cached set; null while unknown. */
  countFor: (draft: ExploreFilters) => number | null;
  /** Plural noun for the CTA ("artists", "providers"). */
  noun?: string;
  /** Whether device location is available (distance can only filter with it). */
  hasLocation: boolean;
  /** Hide controls the current surface can't apply (the map has no price data). */
  hide?: Partial<Record<"price" | "availability", boolean>>;
  onApply: (next: ExploreFilters) => void;
  onClose: () => void;
};

/** Full-width bottom sheet with draft state: nothing applies until "Show N". */
export function FilterSheet({
  visible,
  filters,
  countFor,
  noun = "artists",
  hasLocation,
  hide,
  onApply,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [draft, setDraft] = useState(filters);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setMounted(true);
      progress.value = withTiming(1, { duration: ANIM_MS, easing: Easing.out(Easing.cubic) });
      return;
    }
    progress.value = withTiming(0, { duration: ANIM_MS, easing: Easing.out(Easing.cubic) });
    const t = setTimeout(() => setMounted(false), ANIM_MS);
    return () => clearTimeout(t);
    // `filters` is read only when opening; resyncing mid-edit would discard the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * height }],
  }));

  const count = useMemo(() => countFor(draft), [countFor, draft]);
  const set = <K extends keyof ExploreFilters>(key: K, value: ExploreFilters[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close filters" />
      </Animated.View>
      <Animated.View style={[styles.sheet, { maxHeight: height * 0.88 }, sheetStyle]}>
        <View style={styles.grabWrap}>
          <View style={styles.grab} />
        </View>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Filters</Text>
          <Pressable hitSlop={12} onPress={onClose} accessibilityLabel="Close filters">
            <X size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Section label="Category">
            <View style={styles.chipRow}>
              {CATEGORY_OPTIONS.map((c) => (
                <Chip
                  key={c || "all"}
                  label={c ? c[0].toUpperCase() + c.slice(1) : "All"}
                  active={draft.category === c}
                  onPress={() => set("category", c)}
                />
              ))}
            </View>
          </Section>

          {hide?.price ? null : (
            <Section label="Price" value={PRICE_LABELS[draft.price]}>
              <SegmentedControl<string>
                options={[
                  { id: "1", label: "₱" },
                  { id: "2", label: "₱₱" },
                  { id: "3", label: "₱₱₱" },
                ]}
                value={String(draft.price)}
                // Tapping the active tier again clears it back to "any price".
                onChange={(id) =>
                  set("price", (String(draft.price) === id ? 0 : Number(id)) as PriceTier)
                }
              />
            </Section>
          )}

          <Section label="Distance" value={distanceLabel(draft.distanceKm)}>
            <Slider
              value={draft.distanceKm}
              min={MIN_KM}
              max={ANY_DISTANCE_KM}
              onChange={(v) => set("distanceKm", v)}
            />
            <View style={styles.locRow}>
              <MapPin size={14} color={colors.accentDark} />
              <Text style={styles.locText}>
                {hasLocation ? "From your location" : "Location unavailable — distance won't filter"}
              </Text>
            </View>
          </Section>

          {hide?.availability ? null : (
            <Section label="Availability">
              <View style={styles.chipRow}>
                {(Object.keys(AVAILABILITY_LABELS) as Availability[]).map((a) => (
                  <Chip
                    key={a}
                    label={AVAILABILITY_LABELS[a]}
                    active={draft.availability === a}
                    onPress={() => set("availability", a)}
                  />
                ))}
              </View>
            </Section>
          )}

          <View style={styles.note}>
            <Info size={15} color={colors.accentDark} style={{ marginTop: 2 }} />
            <Text style={styles.noteText}>
              Counts update as you pick, from the cached result set. The list only refreshes when
              you tap Show.
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
          <AnimatedPressable
            onPress={() => setDraft(DEFAULT_FILTERS)}
            accessibilityRole="button"
            style={styles.resetBtn}
          >
            <Text style={styles.resetText}>Reset</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => onApply(draft)}
            accessibilityRole="button"
            style={styles.showBtn}
          >
            <Text style={styles.showText}>
              {count === null ? `Show ${noun}` : `Show ${count} ${count === 1 ? noun.replace(/s$/, "") : noun}`}
            </Text>
          </AnimatedPressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

function Section({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>{label}</Text>
        {value ? <Text style={styles.sectionValue}>{value}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** Minimal single-thumb slider (no gesture-handler dependency). */
function Slider({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<View>(null);
  const geo = useRef({ width: 1, pageX: 0 });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [width, setWidth] = useState(1);

  const valueAt = (pageX: number) => {
    const ratio = Math.min(1, Math.max(0, (pageX - geo.current.pageX) / geo.current.width));
    return Math.round(min + ratio * (max - min));
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const touchX = e.nativeEvent.pageX;
          trackRef.current?.measure((_x, _y, w, _h, pageX) => {
            geo.current = { width: w || 1, pageX };
            onChangeRef.current(valueAt(touchX));
          });
        },
        onPanResponderMove: (_e, g) => onChangeRef.current(valueAt(g.moveX)),
      }),
    // valueAt reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [min, max],
  );

  const ratio = (value - min) / (max - min);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.sliderHit} {...responder.panHandlers}>
      <View ref={trackRef} style={styles.track} onLayout={onLayout}>
        <View style={[styles.trackFill, { width: `${ratio * 100}%` }]} />
        <View style={[styles.thumb, { left: ratio * width - 9 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  grabWrap: { alignItems: "center", paddingTop: 14, paddingBottom: 6 },
  grab: { width: 38, height: 4, borderRadius: 999, backgroundColor: colors.border },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 24, color: colors.text, fontFamily: fonts.serif },
  body: { paddingHorizontal: 20, paddingVertical: 18, gap: 22 },
  section: { gap: 10 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  sectionValue: { color: colors.text, fontSize: 12, fontFamily: fonts.monoMedium },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  locRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  locText: { color: colors.textMuted, fontSize: 11, fontFamily: fonts.mono },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  noteText: { flex: 1, color: colors.textMuted, fontSize: 11, lineHeight: 17, fontFamily: fonts.mono },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  resetBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetText: { color: colors.text, fontSize: 13, fontFamily: fonts.monoMedium },
  showBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  showText: { color: colors.text, fontSize: 15, fontFamily: fonts.monoMedium },
  sliderHit: { height: 32, justifyContent: "center" },
  track: { height: 4, borderRadius: 999, backgroundColor: colors.border },
  trackFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: colors.accent, borderRadius: 999 },
  thumb: {
    position: "absolute",
    top: -7,
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.accent,
  },
});
