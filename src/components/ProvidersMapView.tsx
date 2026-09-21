import { router } from "expo-router";
import { Star, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { listProvidersMap } from "@/src/api/providers";
import { FilterSheet } from "@/src/components/FilterSheet";
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  FilterButton,
  OfflineState,
  StaleBadge,
} from "@/src/components/ui";
import { useUserCoords } from "@/src/hooks/useUserCoords";
import { savedAgoLabel } from "@/src/offline/cache";
import { useCachedQuery } from "@/src/offline/useCachedQuery";
import type { ProviderMapMarker } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import {
  ANY_DISTANCE_KM,
  DEFAULT_FILTERS,
  activeFilterCount,
  filterMarkers,
  type ExploreFilters,
} from "@/src/utils/exploreFilters";
import { formatRating } from "@/src/utils/format";
import { bboxAround, type UserCoords } from "@/src/utils/location";
import { logger } from "@/src/utils/logger";

const CATEGORIES = ["", "barber", "tattoo", "nails", "salon"] as const;

const DEFAULT_REGION: Region = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

const NEARBY_DELTA = 0.06;

const FIT_PADDING = { top: 100, right: 48, bottom: 160, left: 48 };
const EMBEDDED_FIT_PADDING = { top: 48, right: 36, bottom: 100, left: 36 };

function regionForUser(coords: UserCoords): Region {
  return {
    latitude: coords.lat,
    longitude: coords.lng,
    latitudeDelta: NEARBY_DELTA * 2,
    longitudeDelta: NEARBY_DELTA * 2,
  };
}

function MapMarkerPin({
  marker,
  selected,
  dim,
  onSelect,
}: {
  marker: ProviderMapMarker;
  selected: boolean;
  /** Held in place but faded: refetching a new area, or showing saved pins offline. */
  dim: number;
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
      opacity={dim}
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
  embedded = false,
  userCoordinate = null,
  showsUserLocation = false,
  centerOnUser = false,
  filters,
  onFiltersChange,
}: {
  /** Used when uncontrolled, or as first value before parent syncs. */
  initialCategory?: string;
  /** Controlled category from Explore (shared with list mode). */
  category?: string;
  onCategoryChange?: (category: string) => void;
  showCategoryChips?: boolean;
  /** Home embed: fixed parent height, tighter overlays. */
  embedded?: boolean;
  /** User GPS coords for nearby centering / bbox. */
  userCoordinate?: UserCoords | null;
  showsUserLocation?: boolean;
  /** Prefer centering on user instead of fitting all markers. */
  centerOnUser?: boolean;
  /**
   * Shared Explore filters. When provided the chip rail gets the Filters button and the sheet
   * lives here; category, distance and the count badge follow it.
   */
  filters?: ExploreFilters;
  onFiltersChange?: (filters: ExploreFilters) => void;
}) {
  const mapRef = useRef<MapView | null>(null);
  const [internalCategory, setInternalCategory] = useState(initialCategory);
  const category =
    filters !== undefined
      ? filters.category
      : controlledCategory !== undefined
        ? controlledCategory
        : internalCategory;

  const [selected, setSelected] = useState<ProviderMapMarker | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filterCoords =
    useUserCoords(sheetOpen || (filters?.distanceKm ?? ANY_DISTANCE_KM) < ANY_DISTANCE_KM) ??
    userCoordinate;

  const useUserCenter = Boolean(centerOnUser && userCoordinate);
  const initialRegion = useUserCenter
    ? regionForUser(userCoordinate!)
    : DEFAULT_REGION;

  const setCategory = useCallback(
    (next: string) => {
      logger.debug("ProvidersMapView", "category change", { next });
      if (filters && onFiltersChange) onFiltersChange({ ...filters, category: next });
      else if (controlledCategory === undefined) setInternalCategory(next);
      onCategoryChange?.(next);
    },
    [controlledCategory, onCategoryChange, filters, onFiltersChange],
  );

  const bbox =
    centerOnUser && userCoordinate ? bboxAround(userCoordinate, NEARBY_DELTA) : undefined;
  const bboxKey = bbox
    ? [bbox.swLat, bbox.swLng, bbox.neLat, bbox.neLng].map((n) => n.toFixed(3)).join(",")
    : "all";

  // Markers are cached per (category, bbox): a new area keeps the old pins on screen (dimmed)
  // while it loads, and offline the last saved pins stay usable.
  const query = useCachedQuery<ProviderMapMarker[]>({
    key: `map:${category || "all"}:${bboxKey}`,
    fetcher: async () => {
      logger.debug("ProvidersMapView", "load markers", {
        category: category || undefined,
        centerOnUser,
        hasUser: Boolean(userCoordinate),
        bbox,
      });
      const next = await listProvidersMap({
        category: category || undefined,
        swLat: bbox?.swLat,
        swLng: bbox?.swLng,
        neLat: bbox?.neLat,
        neLng: bbox?.neLng,
      });
      // If nearby bbox returns nothing, fall back to all markers so Home still shows providers.
      if (bbox && next.length === 0) {
        logger.warn("ProvidersMapView", "nearby empty — falling back to all markers");
        return listProvidersMap({ category: category || undefined });
      }
      return next;
    },
  });

  const markers = useMemo(
    () => filterMarkers(query.data ?? [], filters ?? DEFAULT_FILTERS, filterCoords),
    [query.data, filters, filterCoords],
  );
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const loading = query.loading;
  const error = query.error;
  const updating = query.loading || query.refetching;
  const pinDim = updating ? 0.4 : query.stale ? 0.72 : 1;

  const applyCamera = useCallback(
    (items: ProviderMapMarker[]) => {
      if (!mapRef.current) return;
      if (useUserCenter && userCoordinate) {
        const region = regionForUser(userCoordinate);
        logger.debug("ProvidersMapView", "centerOnUser", {
          lat: userCoordinate.lat,
          lng: userCoordinate.lng,
          markerCount: items.length,
        });
        mapRef.current.animateToRegion(region, 400);
        return;
      }
      if (items.length === 0) return;
      const coords = items.map((m) => ({
        latitude: m.lat,
        longitude: m.lng,
      }));
      logger.debug("ProvidersMapView", "fitToCoordinates", { count: coords.length });
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: embedded ? EMBEDDED_FIT_PADDING : FIT_PADDING,
        animated: true,
      });
    },
    [embedded, useUserCenter, userCoordinate],
  );

  const load = query.refetch;

  // Re-frame only when a fetch lands (or the filter set changes), never on every render.
  useEffect(() => {
    if (updating || error) return;
    if (!useUserCenter && markersRef.current.length === 0) return;
    const id = requestAnimationFrame(() => applyCamera(markersRef.current));
    return () => cancelAnimationFrame(id);
  }, [updating, error, query.data, filters?.distanceKm, applyCamera, useUserCenter]);

  useEffect(() => {
    setSelected((cur) => (cur && markers.some((m) => m._id === cur._id) ? cur : null));
  }, [markers]);

  const filterCount = filters ? activeFilterCount(filters) : 0;
  const countFor = useCallback(
    (draft: ExploreFilters) =>
      // Category is filtered server-side, so a different category has no cached count.
      draft.category === category ? filterMarkers(query.data ?? [], draft, filterCoords).length : null,
    [category, query.data, filterCoords],
  );

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
    <View style={[styles.container, embedded && styles.containerEmbedded]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsCompass={!embedded}
        showsUserLocation={showsUserLocation}
        onMapReady={() => {
          logger.debug("ProvidersMapView", "map ready", {
            markerCount: markers.length,
            embedded,
            showsUserLocation,
          });
          console.log("[ProvidersMapView] map ready", markers.length);
          // Empty Google Maps keys in app.json may break Android Google Maps builds.
          applyCamera(markers);
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
            dim={pinDim}
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
          {filters && onFiltersChange ? (
            <FilterButton round count={filterCount} onPress={() => setSheetOpen(true)} />
          ) : null}
        </View>
      ) : null}

      {updating ? (
        <View style={styles.updatingPill} pointerEvents="none">
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.updatingText}>Updating this area…</Text>
        </View>
      ) : query.stale && markers.length > 0 ? (
        <View style={styles.stalePill} pointerEvents="none">
          <StaleBadge label={savedAgoLabel(query.savedAt)} />
        </View>
      ) : null}

      <View
        style={[styles.countBadge, embedded && styles.countBadgeEmbedded]}
        pointerEvents="none"
      >
        {updating ? (
          <Text style={styles.countText}>Counting providers…</Text>
        ) : (
          <Text style={styles.countText}>
            <Text style={styles.countBold}>{markers.length}</Text>
            {" providers in this area"}
          </Text>
        )}
        {error ? <Text style={styles.countError}>{error}</Text> : null}
      </View>

      {!loading && error && markers.length === 0 ? (
        <View style={styles.stateOverlay}>
          {query.offline ? (
            <OfflineState onRetry={load} body="The map can't refresh without a connection." />
          ) : (
            <ErrorState message={error} onRetry={load} />
          )}
        </View>
      ) : null}

      {!loading && !error && markers.length === 0 ? (
        <View style={styles.emptyOverlay} pointerEvents="box-none">
          <EmptyState title="No providers on the map" body="Try another category." />
        </View>
      ) : null}

      {query.stale && query.offline && markers.length > 0 && !selected ? (
        <View style={styles.offlineCard}>
          <Text style={styles.offlineCardTitle}>
            Showing {markers.length} saved pin{markers.length === 1 ? "" : "s"}
          </Text>
          <Text style={styles.offlineCardBody}>
            Panning won&apos;t load new providers until you&apos;re back online. Tapping a pin
            still opens the saved profile.
          </Text>
          <Button label="Retry" variant="secondary" onPress={load} />
        </View>
      ) : null}

      {filters && onFiltersChange ? (
        <FilterSheet
          visible={sheetOpen}
          filters={filters}
          countFor={countFor}
          noun="providers"
          hasLocation={filterCoords !== null}
          hide={{ price: true, availability: true }}
          onApply={(next) => {
            onFiltersChange(next);
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}

      {selected ? (
        <View style={[styles.selectionCard, embedded && styles.selectionCardEmbedded]}>
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
  containerEmbedded: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chipsScroll: {
    flex: 1,
    minWidth: 0,
  },
  updatingPill: {
    position: "absolute",
    top: 70,
    alignSelf: "center",
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.text,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  updatingText: { color: colors.white, fontSize: 11, fontFamily: fonts.mono },
  stalePill: { position: "absolute", top: 70, left: 12, zIndex: 20 },
  offlineCard: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    zIndex: 40,
    backgroundColor: colors.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  offlineCardTitle: { fontSize: 15, color: colors.text, fontFamily: fonts.serif },
  offlineCardBody: { fontSize: 12, lineHeight: 18, color: colors.textMuted, fontFamily: fonts.mono },
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
  countBadgeEmbedded: {
    bottom: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: "70%",
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
  selectionCardEmbedded: {
    bottom: 48,
    left: 8,
    right: 8,
    padding: 10,
    gap: 8,
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
