import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Text } from "react-native";
import { getMyProvider, updateMyProvider } from "@/src/api/providers";
import { getAccountMe } from "@/src/api/account";
import type { PlaceDetails } from "@/src/api/geo";
import { useSession } from "@/src/auth/session";
import {
  Button,
  Card,
  ErrorState,
  Field,
  LoadingState,
  Muted,
  Screen,
  Subtitle,
  Title,
} from "@/src/components/ui";
import { NotificationPreferencesSection } from "@/src/components/NotificationPreferencesSection";
import { ImageUploadField } from "@/src/components/ImageUploadField";
import { PhPlacesSearchField } from "@/src/components/PhPlacesSearchField";
import {
  ProviderLocationMapPicker,
  type ProviderLocationCoords,
} from "@/src/components/ProviderLocationMapPicker";
import type {
  AccountProfile,
  ProviderProfile,
  ProviderPromotion,
  UpdateProviderProfileInput,
} from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { toDateKey } from "@/src/utils/dateKeys";
import { logger } from "@/src/utils/logger";

type BusyKey = "profile" | "promotion" | "avatar" | "cover" | null;

function parseOptionalCoord(raw: string): number | undefined | "invalid" {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return "invalid";
  return n;
}

export default function ProviderProfileScreen() {
  const { signOut } = useSession();
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [accountPrefs, setAccountPrefs] = useState<
    AccountProfile["notificationPreferences"] | null
  >(null);
  const [bio, setBio] = useState("");
  const [responseTime, setResponseTime] = useState("");
  const [avatar, setAvatar] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const [promoTitle, setPromoTitle] = useState("");
  const [promoDescription, setPromoDescription] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState("10");
  const [promoValidUntil, setPromoValidUntil] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<BusyKey>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const applyProfile = useCallback((me: ProviderProfile) => {
    setProfile(me);
    setBio(me.bio ?? "");
    setResponseTime(me.responseTime ?? "");
    setAvatar(me.avatar ?? "");
    setCoverImage(me.coverImage ?? "");
    setCity(me.location?.city ?? "");
    setAddress(me.location?.address ?? "");
    setPlaceQuery(me.location?.address ?? me.location?.city ?? "");
    setLat(
      me.location?.lat != null && Number.isFinite(me.location.lat)
        ? String(me.location.lat)
        : "",
    );
    setLng(
      me.location?.lng != null && Number.isFinite(me.location.lng)
        ? String(me.location.lng)
        : "",
    );
    logger.debug("provider-profile", "apply location", {
      hasAddress: Boolean(me.location?.address),
      hasCity: Boolean(me.location?.city),
      hasCoords:
        me.location?.lat != null &&
        Number.isFinite(me.location.lat) &&
        me.location?.lng != null &&
        Number.isFinite(me.location.lng),
    });
  }, []);

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    if (opts?.refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const me = await getMyProvider();
      applyProfile(me);
      try {
        const account = await getAccountMe();
        setAccountPrefs(account.notificationPreferences);
        logger.info("provider-profile", "account prefs loaded", {
          prefsPush: account.notificationPreferences.push,
        });
      } catch (prefsError) {
        logger.warn("provider-profile", "account prefs load failed", prefsError);
      }
      logger.info("provider-profile", "loaded", {
        services: me.services?.length ?? 0,
        portfolio: me.portfolio?.length ?? 0,
        promotions: me.promotions?.length ?? 0,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load profile";
      setError(msg);
      logger.info("provider-profile", "load failed", { msg });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyProfile]);

  useEffect(() => {
    load();
  }, [load]);

  const mutate = async (
    key: BusyKey,
    body: UpdateProviderProfileInput,
    successMsg: string,
    logAction: string,
  ) => {
    setBusy(key);
    setError(null);
    setOk(null);
    try {
      const updated = await updateMyProvider(body);
      applyProfile(updated);
      setOk(successMsg);
      logger.info("provider-profile", logAction, { keys: Object.keys(body) });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setError(msg);
      logger.info("provider-profile", `${logAction} failed`, { msg });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const mapCoords = useMemo((): ProviderLocationCoords | null => {
    const parsedLat = parseOptionalCoord(lat);
    const parsedLng = parseOptionalCoord(lng);
    if (
      parsedLat === "invalid" ||
      parsedLng === "invalid" ||
      parsedLat == null ||
      parsedLng == null
    ) {
      return null;
    }
    if (parsedLat === 0 && parsedLng === 0) return null;
    return { lat: parsedLat, lng: parsedLng };
  }, [lat, lng]);

  const applyPlace = useCallback((place: PlaceDetails) => {
    const nextAddress = place.label.trim();
    const nextCity = (place.city ?? "").trim();
    setAddress(nextAddress);
    setPlaceQuery(nextAddress);
    if (nextCity) setCity(nextCity);
    setLat(String(place.lat));
    setLng(String(place.lng));
    logger.info("provider-profile", "place selected", {
      label: nextAddress,
      city: nextCity || null,
      lat: place.lat,
      lng: place.lng,
    });
    console.log("[provider-profile] place selected", nextAddress, place.lat, place.lng);
  }, []);

  const applyMapPin = useCallback((coords: ProviderLocationCoords) => {
    setLat(String(coords.lat));
    setLng(String(coords.lng));
    logger.info("provider-profile", "map pin set", coords);
    console.log("[provider-profile] map pin set", coords.lat, coords.lng);
  }, []);

  const saveImageField = async (field: "avatar" | "coverImage", url: string) => {
    const busyKey = field === "avatar" ? "avatar" : "cover";
    logger.info("provider-profile", "save image", {
      field,
      hasUrl: Boolean(url.trim()),
    });
    await mutate(
      busyKey,
      field === "avatar"
        ? { avatar: url.trim() || undefined }
        : { coverImage: url.trim() || undefined },
      field === "avatar" ? "Avatar updated" : "Cover image updated",
      `saved ${field}`,
    );
  };

  const saveProfile = async () => {
    const parsedLat = parseOptionalCoord(lat);
    const parsedLng = parseOptionalCoord(lng);
    if (parsedLat === "invalid" || parsedLng === "invalid") {
      setError("Latitude and longitude must be valid numbers");
      logger.warn("provider-profile", "invalid lat/lng", { lat, lng });
      return;
    }
    if ((parsedLat != null) !== (parsedLng != null)) {
      setError("Provide both latitude and longitude, or leave both empty");
      logger.warn("provider-profile", "lat/lng pair incomplete", { lat, lng });
      return;
    }
    if (parsedLat != null && (parsedLat < -90 || parsedLat > 90)) {
      setError("Latitude must be between -90 and 90");
      return;
    }
    if (parsedLng != null && (parsedLng < -180 || parsedLng > 180)) {
      setError("Longitude must be between -180 and 180");
      return;
    }

    const locationPayload = {
      ...(city.trim() ? { city: city.trim() } : {}),
      ...(address.trim() ? { address: address.trim() } : {}),
      ...(parsedLat != null && parsedLng != null
        ? { lat: parsedLat, lng: parsedLng }
        : {}),
    };

    logger.debug("provider-profile", "save profile", {
      hasAvatar: Boolean(avatar.trim()),
      hasCover: Boolean(coverImage.trim()),
      hasAddress: Boolean(locationPayload.address),
      hasCity: Boolean(locationPayload.city),
      hasCoords: parsedLat != null,
    });
    console.log("[provider-profile] save profile location", locationPayload);

    await mutate(
      "profile",
      {
        bio,
        responseTime,
        avatar: avatar.trim() || undefined,
        coverImage: coverImage.trim() || undefined,
        ...(Object.keys(locationPayload).length > 0
          ? { location: locationPayload }
          : {}),
      },
      "Profile saved",
      "saved profile",
    );
  };

  const resetPromoForm = () => {
    setPromoTitle("");
    setPromoDescription("");
    setPromoCode("");
    setPromoDiscount("10");
    setPromoValidUntil("");
  };

  const savePromotion = async () => {
    const title = promoTitle.trim();
    const description = promoDescription.trim();
    const code = promoCode.trim().toUpperCase();
    const discountPercent = Math.round(Number(promoDiscount));
    const validUntil = promoValidUntil.trim();

    if (!title || !description || !code) {
      setError("Promotion title, description, and code are required");
      return;
    }
    if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 100) {
      setError("Discount must be between 1 and 100");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) {
      setError("Valid until must be YYYY-MM-DD");
      return;
    }
    if (validUntil < toDateKey(new Date())) {
      setError("Valid until must be today or a future date");
      return;
    }

    logger.debug("provider-profile", "add promotion", { code, discountPercent, validUntil });
    const okSave = await mutate(
      "promotion",
      {
        addPromotion: {
          title,
          description,
          code,
          discountPercent,
          validUntil,
        },
      },
      "Promotion added",
      "added promotion",
    );
    if (okSave) resetPromoForm();
  };

  const removePromotion = (promo: ProviderPromotion) => {
    Alert.alert("Remove promotion", `Remove “${promo.title}” (${promo.code})?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await mutate(
            "promotion",
            { removePromotionId: promo.id },
            "Promotion removed",
            "removed promotion",
          );
        },
      },
    ]);
  };

  const services = profile?.services ?? [];
  const portfolio = profile?.portfolio ?? [];
  const promotions = profile?.promotions ?? [];

  if (loading) return <LoadingState />;
  if (error && !profile) return <ErrorState message={error} onRetry={() => load()} />;

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => load({ refresh: true })}>
      <Title>{profile?.name || "Provider profile"}</Title>
      <Muted>{profile?.categorySlug}</Muted>
      {profile?.slug ? (
        <Button
          label="View public profile"
          variant="secondary"
          onPress={() => {
            logger.info("provider-profile", "open public preview", { slug: profile.slug });
            router.push({
              pathname: "/(provider)/public-profile",
              params: { slug: profile.slug },
            });
          }}
        />
      ) : null}

      <Subtitle>Basics</Subtitle>
      <ImageUploadField
        label="Profile photo"
        value={avatar}
        onChange={(url) => {
          setAvatar(url);
          void saveImageField("avatar", url);
        }}
        kind="provider-avatar"
        hideUrlInput
        previewStyle={{
          width: 72,
          height: 72,
          borderRadius: 36,
          alignSelf: "flex-start",
        }}
      />
      <ImageUploadField
        label="Cover banner"
        value={coverImage}
        onChange={(url) => {
          setCoverImage(url);
          void saveImageField("coverImage", url);
        }}
        kind="provider-cover"
        hideUrlInput
      />
      <Subtitle>Location</Subtitle>
      <Muted>
        Search a Philippines address, edit the fields, or tap the map to mark your pin.
      </Muted>
      <PhPlacesSearchField
        label="Search address"
        placeholder="e.g. Makati, Quezon City"
        value={placeQuery}
        onChangeText={setPlaceQuery}
        onPlaceSelected={applyPlace}
        testID="provider-location-search"
      />
      <Field
        label="Address"
        value={address}
        onChangeText={setAddress}
        placeholder="Street / building"
      />
      <Field
        label="City"
        value={city}
        onChangeText={setCity}
        placeholder="e.g. Manila"
      />
      <ProviderLocationMapPicker coords={mapCoords} onChange={applyMapPin} />
      <Field
        label="Latitude"
        value={lat}
        onChangeText={setLat}
        keyboardType="decimal-pad"
        placeholder="e.g. 14.5995"
      />
      <Field
        label="Longitude"
        value={lng}
        onChangeText={setLng}
        keyboardType="decimal-pad"
        placeholder="e.g. 120.9842"
      />
      <Muted>Map pin uses lat/lng so customers can find you on the map.</Muted>
      <Button label="Save profile" onPress={saveProfile} loading={busy === "profile"} />

      <Subtitle>Services</Subtitle>
      <Muted>
        {services.length === 0
          ? "No services yet."
          : `${services.length} service${services.length === 1 ? "" : "s"} on your profile.`}
      </Muted>
      <Button
        label="Manage services"
        variant="secondary"
        onPress={() => {
          logger.info("provider-profile", "open services");
          router.push("/(provider)/services");
        }}
      />

      <Subtitle>Portfolio</Subtitle>
      <Muted>
        {portfolio.length === 0
          ? "No portfolio items yet."
          : `${portfolio.length} item${portfolio.length === 1 ? "" : "s"} on your profile.`}
      </Muted>
      <Button
        label="Manage portfolio"
        variant="secondary"
        onPress={() => {
          logger.info("provider-profile", "open portfolio");
          router.push("/(provider)/portfolio");
        }}
      />

      <Subtitle>Promotions</Subtitle>
      {promotions.length === 0 ? (
        <Muted>No promotions yet. Add a discount code customers can use.</Muted>
      ) : (
        promotions.map((promo) => (
          <Card key={promo.id}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{promo.title}</Text>
            <Muted>
              Code {promo.code} · {promo.discountPercent}% off · until {promo.validUntil}
            </Muted>
            {promo.description ? <Muted>{promo.description}</Muted> : null}
            <Button
              label="Remove"
              variant="danger"
              onPress={() => removePromotion(promo)}
              disabled={busy === "promotion"}
            />
          </Card>
        ))
      )}
      <Muted>Add promotion</Muted>
      <Field label="Title" value={promoTitle} onChangeText={setPromoTitle} />
      <Field
        label="Description"
        value={promoDescription}
        onChangeText={setPromoDescription}
        multiline
      />
      <Field
        label="Code"
        value={promoCode}
        onChangeText={setPromoCode}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Field
        label="Discount %"
        value={promoDiscount}
        onChangeText={setPromoDiscount}
        keyboardType="number-pad"
      />
      <Field
        label="Valid until (YYYY-MM-DD)"
        value={promoValidUntil}
        onChangeText={setPromoValidUntil}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={toDateKey(new Date())}
      />
      <Button
        label="Add promotion"
        onPress={savePromotion}
        loading={busy === "promotion"}
      />

      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {ok ? <Text style={{ color: colors.success }}>{ok}</Text> : null}

      <Subtitle>Payout settings</Subtitle>
      <Muted>
        {!profile?.payoutDestination
          ? "No payout account on file yet."
          : profile.payoutVerificationStatus === "verified"
            ? `Verified — payouts go to your ${profile.payoutDestination.type} account.`
            : `Pending review — payouts go to your ${profile.payoutDestination.type} account once verified.`}
      </Muted>
      <Button
        label="Manage payout settings"
        variant="secondary"
        onPress={() => {
          logger.info("provider-profile", "open payout settings");
          router.push("/(provider)/payout-settings");
        }}
      />

      <Button
        label="Subscription plan"
        variant="secondary"
        onPress={() => {
          logger.info("provider-profile", "open subscription");
          console.log("[provider-profile] open subscription");
          router.push("/(provider)/subscription");
        }}
      />

      {accountPrefs ? (
        <NotificationPreferencesSection
          preferences={accountPrefs}
          onUpdated={(notificationPreferences) => {
            setAccountPrefs(notificationPreferences);
            logger.info("provider-profile", "notification prefs updated in state");
          }}
        />
      ) : null}

      <Button
        label="Sign out"
        variant="danger"
        testID="sign-out-button"
        onPress={async () => {
          logger.info("provider-profile", "sign out");
          await signOut();
          router.replace("/(auth)/login");
        }}
      />
    </Screen>
  );
}
