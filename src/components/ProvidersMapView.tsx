import { router } from "expo-router";
import { Star, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { listProvidersMap } from "@/src/api/providers";
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/src/components/ui";
import type { ProviderMapMarker } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { formatRating } from "@/src/utils/format";
import { logger } from "@/src/utils/logger";

const CATEGORIES = ["", "barber", "tattoo", "nails", "salon"] as const;

const DEFAULT_REGION: Region = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

const FIT_PADDING = { top: 100, right: 48, bottom: 160, left: 48 };

function MapMarkerPin({
  marker,
  selected,
  onSelect,
}: {
  marker: ProviderMapMarker;
  selected: boolean;
  onSelect: (marker: ProviderMapMarker) => void;
}) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const avatar = (marker.avatar || "").trim();

  useEffect(() => {
    // Re-track briefly when selection changes so pin colors update on native maps.
    setTracksViewChanges(true);
    const t = setTimeout(() => setTracksViewChanges(false), 400);
    return () => clearTimeout(t);
  }, [selected]);

  useEffect(() => {
    if (!avatar) {
      const t = setTimeout(() => setTracksViewChanges(false), 200);
      return () => clearTimeout(t);
    }
  }, [avatar]);

  return (
    <Marker
      coordinate={{ latitude: marker.lat, longitude: marker.lng }}
      tracksViewChanges={tracksViewChanges}
      onPress={(e) => {
        e.stopPropagation();
        onSelect(marker);
      }}
      anchor={{ x: 0.5, y: 1 }}
    >
      <View style={styles.pinWrap} pointerEvents="none">
        <View
          style={[
            styles.pinPill,
            selected && styles.pinPillSelected,
            marker.isPremium && !selected && styles.pinPillPremium,
          ]}
        >
          {avatar ? (
            <Image
              source={{ uri: avatar }}
              style={styles.pinAvatar}
              onLoadEnd={() => setTracksViewChanges(false)}
              onError={() => setTracksViewChanges(false)}
            />
          ) : (
            <View style={[styles.pinAvatar, styles.pinAvatarFallback]}>
              <Text style={styles.pinAvatarLetter}>
                {marker.name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.pinRating}>
            <Star
              size={10}
              color={selected ? colors.bg : colors.text}
              fill={selected ? colors.bg : colors.text}
            />
            <Text style={[styles.pinRatingText, selected && styles.pinRatingTextSelected]}>
              {formatRating(marker.rating)}
            </Text>
          </View>
        </View>
        <View style={[styles.pinTail, selected && styles.pinTailSelected]} />
      </View>
    </Marker>
  );
}

export function ProvidersMapView({
  initialCategory = "",
  category: controlledCategory,
  onCategoryChange,
  showCategoryChips = true,
}: {
  /** Used when uncontrolled, or as first value before parent syncs. */
  initialCategory?: string;
  /** Controlled category from Explore (shared with list mode). */
  category?: string;
  onCategoryChange?: (category: string) => void;
  showCategoryChips?: boolean;
}) {
  const mapRef = useRef<MapView | null>(null);
  const [internalCategory, setInternalCategory] = useState(initialCategory);
  const category = controlledCategory !== undefined ? controlledCategory : internalCategory;

  const [markers, setMarkers] = useState<ProviderMapMarker[]>([]);
  const [selected, setSelected] = useState<ProviderMapMarker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setCategory = useCallback(
    (next: string) => {
      logger.debug("ProvidersMapView", "category change", { next });
      if (controlledCategory === undefined) setInternalCategory(next);
      onCategoryChange?.(next);
    },
    [controlledCategory, onCategoryChange],
  );

  const fitMarkers = useCallback((items: ProviderMapMarker[]) => {
    if (items.length === 0 || !mapRef.current) return;
    const coords = items.map((m) => ({
      latitude: m.lat,
      longitude: m.lng,
    }));
    logger.debug("ProvidersMapView", "fitToCoordinates", { count: coords.length });
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: FIT_PADDING,
      animated: true,
    });
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    logger.debug("ProvidersMapView", "load markers", { category: category || undefined });
    try {
      const next = await listProvidersMap({
        category: category || undefined,
      });
      setMarkers(next);
      setSelected(null);
      logger.debug("ProvidersMapView", "markers loaded", { count: next.length });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Map failed";
      logger.error("ProvidersMapView", "load failed", message);
      setError(message);
      setMarkers([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (loading || error || markers.length === 0) return;
    const id = requestAnimationFrame(() => fitMarkers(markers));
    return () => cancelAnimationFrame(id);
  }, [loading, error, markers, fitMarkers]);

  const selectMarker = useCallback((marker: ProviderMapMarker) => {
    logger.debug("ProvidersMapView", "select marker", {
      slug: marker.slug,
      name: marker.name,
    });
    setSelected(marker);
  }, []);

  const openProfile = useCallback((marker: ProviderMapMarker) => {
    logger.debug("ProvidersMapView", "view profile", { slug: marker.slug });
    router.push(`/(customer)/provider/${marker.slug}`);
  }, []);

  const openBook = useCallback((marker: ProviderMapMarker) => {
    logger.debug("ProvidersMapView", "book", { slug: marker.slug });
    router.push(`/(customer)/book/${marker.slug}`);
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        showsCompass
        showsUserLocation={false}
        onMapReady={() => {
          logger.debug("ProvidersMapView", "map ready", {
            markerCount: markers.length,
          });
          // Empty Google Maps keys in app.json may break Android Google Maps builds.
          fitMarkers(markers);
        }}
        onPress={() => {
          if (selected) {
            logger.debug("ProvidersMapView", "deselect via map press");
            setSelected(null);
          }
        }}
      >
        {markers.map((m) => (
          <MapMarkerPin
            key={m._id}
            marker={m}
            selected={selected?._id === m._id}
            onSelect={selectMarker}
          />
        ))}
      </MapView>

      {showCategoryChips ? (
        <View style={styles.chipsOverlay} pointerEvents="box-none">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            style={styles.chipsScroll}
          >
            {CATEGORIES.map((c) => (
              <Chip
                key={c || "all"}
                label={c || "All"}
                active={category === c}
                onPress={() => setCategory(c)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.countBadge} pointerEvents="none">
        <Text style={styles.countText}>
          <Text style={styles.countBold}>{markers.length}</Text>
          {" providers in this area"}
        </Text>
        {error ? <Text style={styles.countError}>{error}</Text> : null}
      </View>

      {loading ? (
        <View style={styles.stateOverlay}>
          <LoadingState label="Loading map data…" />
        </View>
      ) : null}

      {!loading && error && markers.length === 0 ? (
        <View style={styles.stateOverlay}>
          <ErrorState message={error} onRetry={load} />
        </View>
      ) : null}

      {!loading && !error && markers.length === 0 ? (
        <View style={styles.emptyOverlay} pointerEvents="box-none">
          <EmptyState title="No providers on the map" body="Try another category." />
        </View>
      ) : null}

      {selected ? (
        <View style={styles.selectionCard}>
          <View style={styles.selectionHeader}>
            <View style={styles.selectionIdentity}>
              {(selected.avatar || "").trim() ? (
                <Image
                  source={{ uri: selected.avatar }}
                  style={styles.selectionAvatar}
                />
              ) : (
                <View style={[styles.selectionAvatar, styles.pinAvatarFallback]}>
                  <Text style={styles.pinAvatarLetter}>
                    {selected.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.selectionMeta}>
                <Text style={styles.selectionName} numberOfLines={1}>
                  {selected.name}
                </Text>
                <View style={styles.selectionRow}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{selected.categorySlug}</Text>
                  </View>
                  <Text style={styles.selectionDot}>·</Text>
                  <Star size={12} color={colors.text} fill={colors.text} />
                  <Text style={styles.selectionRating}>
                    {formatRating(selected.rating)}
                  </Text>
                </View>
              </View>
            </View>
            <Pressable
              onPress={() => {
                logger.debug("ProvidersMapView", "dismiss selection");
                setSelected(null);
              }}
              hitSlop={12}
              style={styles.dismissBtn}
            >
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.selectionActions}>
            <View style={styles.actionFlex}>
              <Button
                label="View Profile"
                variant="secondary"
                onPress={() => openProfile(selected)}
              />
            </View>
            <View style={styles.actionFlex}>
              <Button label="Book" onPress={() => openBook(selected)} />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  chipsOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    zIndex: 20,
  },
  chipsScroll: {
    maxWidth: "100%",
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countBadge: {
    position: "absolute",
    bottom: 16,
    left: 12,
    zIndex: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: "60%",
  },
  countText: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.mono,
  },
  countBold: {
    color: colors.text,
    fontFamily: fonts.monoMedium,
  },
  countError: {
    color: colors.danger,
    fontSize: 11,
    marginTop: 4,
  },
  stateOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
    backgroundColor: colors.bg,
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 25,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.overlay,
    padding: 24,
  },
  pinWrap: {
    alignItems: "center",
  },
  pinPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pinPillSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  pinPillPremium: {
    borderColor: colors.accent,
  },
  pinAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surfaceAlt,
  },
  pinAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  pinAvatarLetter: {
    fontSize: 10,
    fontFamily: fonts.monoMedium,
    color: colors.accent,
  },
  pinRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  pinRatingText: {
    fontSize: 12,
    fontFamily: fonts.monoMedium,
    color: colors.text,
  },
  pinRatingTextSelected: {
    color: colors.bg,
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.bg,
    marginTop: -1,
  },
  pinTailSelected: {
    borderTopColor: colors.text,
  },
  selectionCard: {
    position: "absolute",
    bottom: 72,
    left: 12,
    right: 12,
    zIndex: 40,
    backgroundColor: colors.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  selectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  selectionIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  selectionAvatar: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
  },
  selectionMeta: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  selectionName: {
    fontSize: 16,
    fontFamily: fonts.serifMedium,
    color: colors.text,
  },
  selectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.textMuted,
    textTransform: "capitalize",
  },
  selectionDot: {
    color: colors.textMuted,
    fontSize: 12,
  },
  selectionRating: {
    fontSize: 13,
    fontFamily: fonts.mono,
    color: colors.text,
  },
  dismissBtn: {
    padding: 4,
  },
  selectionActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionFlex: {
    flex: 1,
  },
});
