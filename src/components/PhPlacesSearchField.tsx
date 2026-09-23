import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import {
  autocompletePlaces,
  createPlacesSessionToken,
  getPlaceDetails,
  type PlaceDetails,
  type PlaceSuggestion,
} from "@/src/api/geo";
import { ApiError } from "@/src/api/client";
import { Muted } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { logger } from "@/src/utils/logger";

const DEBOUNCE_MS = 450;

type PhPlacesSearchFieldProps = {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onPlaceSelected: (place: PlaceDetails) => void | Promise<void>;
  /** Called when the user taps the clear (X) control. */
  onClear?: () => void;
  disabled?: boolean;
  testID?: string;
  /** Hide the field label (useful for map overlays). */
  compact?: boolean;
};

/**
 * Debounced PH-only Places autocomplete (via API proxy).
 * Selecting a suggestion resolves lat/lng through Place Details.
 */
export function PhPlacesSearchField({
  label = "City or area",
  placeholder = "e.g. Makati, Manila",
  value,
  onChangeText,
  onPlaceSelected,
  onClear,
  disabled,
  testID,
  compact = false,
}: PhPlacesSearchFieldProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionTokenRef = useRef(createPlacesSessionToken());
  const requestIdRef = useRef(0);
  /** Skip autocomplete when value was set by picking a suggestion (avoids re-opening the list). */
  const suppressAutocompleteRef = useRef(false);
  /**
   * Only hit Places when the user typed. Hydrating a saved label from AsyncStorage
   * (home/map open) must not re-search.
   */
  const userTypedRef = useRef(false);

  const showClear = value.trim().length > 0 && !disabled && !selecting;

  useEffect(() => {
    const trimmed = value.trim();
    if (suppressAutocompleteRef.current) {
      suppressAutocompleteRef.current = false;
      userTypedRef.current = false;
      requestIdRef.current += 1;
      setSuggestions([]);
      setSearching(false);
      setError(null);
      console.log(
        "[PhPlacesSearchField] skip autocomplete after select",
        trimmed.length,
      );
      return;
    }
    if (!userTypedRef.current) {
      // Programmatic value (saved discovery location) — reuse local coords, no API.
      requestIdRef.current += 1;
      setSuggestions([]);
      setSearching(false);
      setError(null);
      console.log(
        "[PhPlacesSearchField] skip autocomplete — saved/local value",
        trimmed.length,
      );
      return;
    }
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearching(false);
      setError(null);
      return;
    }

    // Wait for typing to pause before hitting Places (and before showing spinner).
    setSearching(false);
    const requestId = ++requestIdRef.current;
    console.log("[PhPlacesSearchField] debounce armed", {
      qLen: trimmed.length,
      ms: DEBOUNCE_MS,
      requestId,
    });
    const timer = setTimeout(() => {
      void (async () => {
        if (requestId !== requestIdRef.current) return;
        setSearching(true);
        try {
          logger.debug("PhPlacesSearchField", "autocomplete", {
            qLen: trimmed.length,
          });
          console.log(
            "[PhPlacesSearchField] autocomplete (debounced)",
            trimmed.length,
          );
          const next = await autocompletePlaces(
            trimmed,
            sessionTokenRef.current,
          );
          if (requestId !== requestIdRef.current) return;
          setSuggestions(next);
          setError(null);
          if (next.length === 0) {
            setError("No places in the Philippines match");
          }
        } catch (e) {
          if (requestId !== requestIdRef.current) return;
          const msg =
            e instanceof ApiError
              ? e.message
              : "Unable to search places. Try again.";
          setSuggestions([]);
          setError(msg);
          logger.warn("PhPlacesSearchField", "autocomplete failed", e);
          console.log("[PhPlacesSearchField] autocomplete failed", e);
        } finally {
          if (requestId === requestIdRef.current) setSearching(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      console.log("[PhPlacesSearchField] debounce cleared", { requestId });
    };
  }, [value]);

  const clearAddress = () => {
    logger.info("PhPlacesSearchField", "clear address");
    console.log("[PhPlacesSearchField] clear address");
    requestIdRef.current += 1;
    suppressAutocompleteRef.current = false;
    userTypedRef.current = false;
    setSuggestions([]);
    setSearching(false);
    setError(null);
    onChangeText("");
    onClear?.();
  };

  const onSelect = async (suggestion: PlaceSuggestion) => {
    setSelecting(true);
    setError(null);
    // Cancel any in-flight autocomplete and hide the list immediately.
    requestIdRef.current += 1;
    setSuggestions([]);
    setSearching(false);
    logger.info("PhPlacesSearchField", "select suggestion", {
      placeIdPrefix: suggestion.placeId.slice(0, 12),
    });
    console.log("[PhPlacesSearchField] select", suggestion.primaryText);
    try {
      const details = await getPlaceDetails(
        suggestion.placeId,
        sessionTokenRef.current,
      );
      suppressAutocompleteRef.current = true;
      onChangeText(details.label);
      setSuggestions([]);
      // Rotate session after a completed autocomplete → details cycle.
      sessionTokenRef.current = createPlacesSessionToken();
      await onPlaceSelected(details);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : "Unable to load that place. Try again.";
      setError(msg);
      logger.warn("PhPlacesSearchField", "details failed", e);
      console.log("[PhPlacesSearchField] details failed", e);
    } finally {
      setSelecting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {!compact && label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          value={value}
          onChangeText={(text) => {
            suppressAutocompleteRef.current = false;
            userTypedRef.current = true;
            onChangeText(text);
            setError(null);
          }}
          editable={!disabled && !selecting}
          testID={testID}
          style={[styles.input, showClear && styles.inputWithClear]}
          accessibilityLabel={label || "Search address"}
        />
        {showClear ? (
          <Pressable
            style={styles.clearBtn}
            onPress={clearAddress}
            hitSlop={10}
            accessibilityLabel="Clear address"
            accessibilityRole="button"
            testID={testID ? `${testID}-clear` : "ph-places-clear"}
          >
            <X size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {searching || selecting ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Muted>{selecting ? "Saving location…" : "Searching…"}</Muted>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {suggestions.length > 0 ? (
        <View style={styles.list} testID="ph-places-suggestions">
          {suggestions.map((s) => (
            <Pressable
              key={s.placeId}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.itemPressed,
              ]}
              disabled={selecting || disabled}
              onPress={() => void onSelect(s)}
              accessibilityLabel={`${s.primaryText}, ${s.secondaryText}`}
            >
              <Text style={styles.primary} numberOfLines={1}>
                {s.primaryText}
              </Text>
              {s.secondaryText ? (
                <Text style={styles.secondary} numberOfLines={1}>
                  {s.secondaryText}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  inputRow: {
    position: "relative",
    justifyContent: "center",
  },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputWithClear: {
    paddingRight: 40,
  },
  clearBtn: {
    position: "absolute",
    right: 10,
    height: 28,
    width: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  error: { color: colors.danger, fontSize: 14 },
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.bgDeep,
    zIndex: 20,
    elevation: 6,
  },
  item: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
  itemPressed: { backgroundColor: colors.surfaceAlt },
  primary: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.serifMedium,
  },
  secondary: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.mono,
  },
});
