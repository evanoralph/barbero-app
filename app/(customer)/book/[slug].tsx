import { formatMoney } from '@/src/utils/format';
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Pencil,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createBooking } from "@/src/api/bookings";
import { getLoyaltyCard } from "@/src/api/loyalty";
import { ApiError } from "@/src/api/client";
import {
  bookingPaymentsAvailable,
  fetchPublicAppConfig,
} from "@/src/api/public-config";
import { getProvider, getProviderSlots } from "@/src/api/providers";
import { useSession } from "@/src/auth/session";
import { LoyaltyStampBanner } from "@/src/components/LoyaltyStampBanner";
import {
  Button,
  ErrorState,
  LoadingState,
  MonoLabel,
  Muted,
} from "@/src/components/ui";
import type { LoyaltyCardView, ProviderProfile, ProviderService } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { logger } from "@/src/utils/logger";

function todayISODate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODate(iso: string): Date {
  const [y, mo, d] = iso.split("-").map(Number);
  if (!y || !mo || !d) return new Date();
  return new Date(y, mo - 1, d);
}

function toISODate(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(iso: string): string {
  const date = parseISODate(iso);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatSheetDate(iso: string): string {
  const date = parseISODate(iso);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function combineLocal(date: string, time: string): Date {
  const ampm = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  let hours = 0;
  let minutes = 0;
  if (ampm) {
    hours = Number(ampm[1]) % 12;
    if (ampm[3].toUpperCase() === "PM") hours += 12;
    minutes = Number(ampm[2]);
  } else {
    const [h, m] = time.split(":").map(Number);
    hours = h;
    minutes = m || 0;
  }
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(y, mo - 1, d, hours, minutes, 0, 0);
}

function slotHour(time: string): number {
  const ampm = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (ampm) {
    let hours = Number(ampm[1]) % 12;
    if (ampm[3].toUpperCase() === "PM") hours += 12;
    return hours;
  }
  return Number(time.split(":")[0]) || 0;
}

type TimeBucket = { key: string; label: string; times: string[] };

function groupTimes(times: string[]): TimeBucket[] {
  const buckets: TimeBucket[] = [
    { key: "morning", label: "Morning", times: [] },
    { key: "afternoon", label: "Afternoon", times: [] },
    { key: "evening", label: "Evening", times: [] },
  ];
  for (const t of times) {
    const h = slotHour(t);
    if (h < 12) buckets[0].times.push(t);
    else if (h < 17) buckets[1].times.push(t);
    else buckets[2].times.push(t);
  }
  return buckets.filter((b) => b.times.length > 0);
}

const STICKY_BAR_BASE = 72;

export default function BookScreen() {
  const { slug, serviceId } = useLocalSearchParams<{ slug: string; serviceId?: string }>();
  const { user } = useSession();
  const insets = useSafeAreaInsets();
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [service, setService] = useState<ProviderService | null>(null);
  const [date, setDate] = useState(todayISODate());
  const [draftDate, setDraftDate] = useState(todayISODate());
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [times, setTimes] = useState<string[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loyaltyCard, setLoyaltyCard] = useState<LoyaltyCardView | null>(null);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);

  const draftDateValue = useMemo(() => parseISODate(draftDate), [draftDate]);
  const minDate = useMemo(() => parseISODate(todayISODate()), []);
  const timeBuckets = useMemo(() => groupTimes(times), [times]);
  const stickyPad = STICKY_BAR_BASE + Math.max(insets.bottom, 12);

  const loadProvider = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    const preferredId = typeof serviceId === "string" ? serviceId : undefined;
    logger.debug("book", "load provider", { slug, serviceId: preferredId });
    console.log("[book] load provider", slug);
    try {
      const [p, publicConfig] = await Promise.all([
        getProvider(slug),
        fetchPublicAppConfig(),
      ]);
      setProvider(p);
      setPaymentsEnabled(publicConfig?.paymentsEnabled === true);
      console.log("[book] public config paymentsEnabled", publicConfig?.paymentsEnabled === true);
      const preselected = preferredId
        ? p.services.find((s) => s.id === preferredId)
        : undefined;
      setService(preselected ?? p.services[0] ?? null);
      logger.debug("book", "provider loaded", {
        services: p.services.length,
        preselected: preselected?.id ?? null,
        paymentsEnabled: publicConfig?.paymentsEnabled === true,
      });
      console.log("[book] provider loaded", p.services.length, "services");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      logger.warn("book", "load failed", e);
      console.log("[book] load failed", e);
    } finally {
      setLoading(false);
    }
  }, [slug, serviceId]);

  useEffect(() => {
    loadProvider();
  }, [loadProvider]);

  useEffect(() => {
    if (!user || !provider?._id || !provider.loyaltyProgram?.enabled) {
      setLoyaltyCard(null);
      return;
    }
    let cancelled = false;
    getLoyaltyCard(provider._id)
      .then((card) => {
        if (cancelled) return;
        setLoyaltyCard(card);
        logger.debug("book", "loyalty card", {
          stamps: card.stamps,
          rewardReady: card.rewardReady,
        });
        console.log("[book] loyalty card", card.stamps, card.rewardReady);
      })
      .catch((e) => {
        logger.warn("book", "loyalty card skipped", e);
        console.log("[book] loyalty card skipped", e);
        if (!cancelled) setLoyaltyCard(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, provider?._id, provider?.loyaltyProgram?.enabled]);

  useEffect(() => {
    if (!slug || !date) return;
    let cancelled = false;
    (async () => {
      setSlotsLoading(true);
      setSlot(null);
      try {
        const res = await getProviderSlots(slug, date);
        if (!cancelled) {
          setTimes(res.times);
          logger.debug("book", "slots", { date, count: res.times.length });
          console.log("[book] slots", date, res.times.length);
        }
      } catch (e) {
        logger.warn("book", "slots failed", e);
        console.log("[book] slots failed", e);
        if (!cancelled) setTimes([]);
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, date]);

  const canSubmit = useMemo(
    () => Boolean(user && provider && service && slot && date),
    [user, provider, service, slot, date],
  );

  const openDateModal = () => {
    logger.debug("book", "open date modal", { date });
    console.log("[book] open date modal");
    setDraftDate(date);
    if (Platform.OS === "android") {
      setShowAndroidPicker(true);
      return;
    }
    setShowDateModal(true);
  };

  const closeDateModal = () => {
    logger.debug("book", "close date modal");
    setShowDateModal(false);
  };

  const confirmDate = () => {
    logger.debug("book", "confirm date", { date: draftDate });
    console.log("[book] confirm date", draftDate);
    setDate(draftDate);
    setShowDateModal(false);
  };

  const onAndroidDateChange = (event: DateTimePickerEvent, next?: Date) => {
    setShowAndroidPicker(false);
    if (event.type === "dismissed") {
      logger.debug("book", "android date dismissed");
      return;
    }
    if (!next) return;
    const iso = toISODate(next);
    logger.debug("book", "android date selected", { date: iso });
    console.log("[book] android date", iso);
    setDate(iso);
    setDraftDate(iso);
  };

  const onIosDateChange = (_event: DateTimePickerEvent, next?: Date) => {
    if (!next) return;
    const iso = toISODate(next);
    logger.debug("book", "ios date draft", { date: iso });
    setDraftDate(iso);
  };

  const openTimeModal = () => {
    logger.debug("book", "open time modal", { date, slotCount: times.length });
    console.log("[book] open time modal");
    setShowTimeModal(true);
  };

  const closeTimeModal = () => {
    logger.debug("book", "close time modal");
    setShowTimeModal(false);
  };

  const selectSlot = (t: string) => {
    logger.debug("book", "select slot", { t });
    console.log("[book] select slot", t);
    setSlot(t);
    setShowTimeModal(false);
  };

  const openNotesModal = () => {
    logger.debug("book", "open notes modal", { platform: Platform.OS });
    console.log("[book] open notes — keyboard sticky sheet enabled");
    setDraftNotes(notes);
    setShowNotesModal(true);
  };

  const confirmNotes = () => {
    logger.debug("book", "confirm notes", { length: draftNotes.trim().length });
    console.log("[book] confirm notes");
    setNotes(draftNotes);
    setShowNotesModal(false);
  };

  const closeNotesModal = () => {
    logger.debug("book", "close notes modal");
    console.log("[book] close notes");
    setShowNotesModal(false);
  };

  // Log keyboard events while notes sheet is open (lift handled by KeyboardStickyView).
  useEffect(() => {
    if (!showNotesModal) return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => {
      const height = e.endCoordinates?.height ?? 0;
      logger.debug("book", "notes keyboard show", { height, platform: Platform.OS });
      console.log("[book] notes keyboard show", height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      logger.debug("book", "notes keyboard hide");
      console.log("[book] notes keyboard hide");
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [showNotesModal]);

  const onConfirm = async () => {
    if (!user || !provider || !service || !slot) return;
    setSubmitting(true);
    setError(null);
    logger.debug("book", "confirm", {
      providerId: provider._id,
      service: service.name,
      date,
      slot,
      notes: notes.trim() || undefined,
    });
    console.log("[book] request booking", service.name, date, slot, {
      hasNotes: Boolean(notes.trim()),
    });
    try {
      const starts = combineLocal(date, slot);
      const ends = new Date(starts.getTime() + service.durationMinutes * 60_000);
      const bookingNotes = notes.trim() || undefined;
      const booking = await createBooking({
        customerId: user.userId,
        providerId: provider._id,
        serviceName: service.name,
        startsAt: starts.toISOString(),
        endsAt: ends.toISOString(),
        ...(bookingNotes ? { notes: bookingNotes } : {}),
      });
      logger.info("book", "created", {
        id: booking._id,
        amount: booking.amount,
        loyaltyRewardApplied: booking.loyaltyRewardApplied,
        hasNotes: Boolean(booking.notes),
      });
      console.log("[book] created", booking._id, booking.amount, {
        hasNotes: Boolean(booking.notes),
      });

      // Skip the checkmark overlay — land on booking detail so status is visible.
      // When payment is due, pass pay=1 so detail auto-opens PayMongo once.
      const needsPayment =
        bookingPaymentsAvailable({
          paymentsEnabled,
          paymentsDisabled: provider.paymentsDisabled,
        }) &&
        typeof booking.amount === "number" &&
        booking.amount > 0;
      if (needsPayment) {
        logger.info("book", "redirect to booking detail with pay", { bookingId: booking._id });
        console.log("[book] redirect to booking detail with pay", booking._id);
        router.replace(`/(customer)/bookings/${booking._id}?pay=1`);
      } else {
        if (typeof booking.amount === "number" && booking.amount <= 0) {
          logger.info("book", "skip checkout zero-amount loyalty booking", {
            bookingId: booking._id,
          });
          console.log("[book] skip checkout zero-amount loyalty booking", booking._id);
        } else {
          logger.info("book", "redirect to booking detail (no pay)", {
            bookingId: booking._id,
            paymentsEnabled,
            paymentsDisabled: provider.paymentsDisabled,
          });
          console.log("[book] redirect to booking detail (no pay)", booking._id, {
            paymentsEnabled,
            paymentsDisabled: provider.paymentsDisabled,
          });
        }
        router.replace(`/(customer)/bookings/${booking._id}`);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Booking failed");
      logger.warn("book", "create failed", e);
      console.log("[book] create failed", e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !provider) return <ErrorState message={error} onRetry={loadProvider} />;
  if (!provider) return <ErrorState message="Provider not found" />;

  const avatarUri = (provider.avatar || "").trim();
  const metaParts = [
    (provider.categorySlug || "artist").replace(/-/g, " "),
    provider.location?.city,
    provider.rating ? provider.rating.toFixed(1) : null,
  ].filter(Boolean);

  const loyaltyDiscountPercent =
    loyaltyCard?.rewardReady && provider.loyaltyProgram?.enabled
      ? loyaltyCard.rewardDiscountPercent
      : 0;
  const previewTotal =
    service && loyaltyDiscountPercent > 0
      ? Math.max(
          0,
          Math.round(service.price * (1 - loyaltyDiscountPercent / 100) * 100) / 100,
        )
      : service?.price ?? 0;

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            logger.debug("book", "back");
            console.log("[book] back");
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace(`/(customer)/provider/${slug}`);
            }
          }}
          hitSlop={10}
          accessibilityLabel="Go back"
        >
          <ArrowLeft color={colors.text} size={22} strokeWidth={2} />
        </Pressable>
        <Text style={styles.topTitle}>BOOKING</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: stickyPad + 16 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.providerSummary}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarLetter}>
                {provider.name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.providerInfo}>
            <Text style={styles.providerName}>{provider.name}</Text>
            <Text style={styles.providerMeta}>{metaParts.join(" · ").toUpperCase()}</Text>
          </View>
        </View>

        {provider.loyaltyProgram?.enabled ? (
          <View style={{ marginBottom: 16 }}>
            <LoyaltyStampBanner program={provider.loyaltyProgram} card={loyaltyCard} />
          </View>
        ) : null}

        <MonoLabel>Services</MonoLabel>
        {provider.services.length === 0 ? (
          <Muted>No services available.</Muted>
        ) : (
          <View style={styles.serviceList}>
            {provider.services.map((s) => {
              const active = service?.id === s.id;
              return (
                <Pressable
                  key={s.id}
                  style={[styles.serviceRow, active && styles.serviceRowActive]}
                  onPress={() => {
                    logger.debug("book", "select service", { id: s.id });
                    console.log("[book] select service", s.id, s.name);
                    setService(s);
                  }}
                >
                  <View style={styles.serviceBody}>
                    <Text style={styles.serviceName} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={styles.serviceDuration}>{s.durationMinutes} min</Text>
                  </View>
                  <Text style={styles.servicePrice}>{formatMoney(s.price)}</Text>
                  {active ? (
                    <View style={styles.checkCircle}>
                      <Check color={colors.bg} size={14} strokeWidth={3} />
                    </View>
                  ) : (
                    <View style={styles.checkEmpty} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <MonoLabel>When</MonoLabel>
        <View style={styles.whenList}>
          <Pressable style={styles.whenRow} onPress={openDateModal}>
            <Calendar color={colors.accent} size={18} strokeWidth={2} />
            <Text style={styles.whenText}>{formatDisplayDate(date)}</Text>
            <ChevronRight color={colors.textMuted} size={18} />
          </Pressable>
          <Pressable style={styles.whenRow} onPress={openTimeModal}>
            <Clock color={colors.accent} size={18} strokeWidth={2} />
            <Text style={[styles.whenText, !slot && styles.whenPlaceholder]}>
              {slot ?? (slotsLoading ? "Loading times…" : "Select a time")}
            </Text>
            <ChevronRight color={colors.textMuted} size={18} />
          </Pressable>
          <Pressable style={styles.whenRow} onPress={openNotesModal}>
            <Pencil color={colors.accent} size={18} strokeWidth={2} />
            <Text
              style={[styles.whenText, !notes.trim() && styles.whenPlaceholder]}
              numberOfLines={1}
            >
              {notes.trim() || "Add a note"}
            </Text>
            <ChevronRight color={colors.textMuted} size={18} />
          </Pressable>
        </View>

        <Muted style={styles.policy}>
          Request is confirmed by the artist. Cancel anytime before they accept.
        </Muted>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.stickyMeta}>
          <Text style={styles.stickyPrice}>
            {service ? formatMoney(previewTotal) : "—"}
          </Text>
          <Text style={styles.stickyDuration}>
            {service
              ? loyaltyDiscountPercent > 0
                ? `${service.durationMinutes} MIN · LOYALTY`
                : `${service.durationMinutes} MIN`
              : ""}
          </Text>
        </View>
        <Pressable
          style={[styles.stickyCta, (!canSubmit || submitting) && styles.stickyCtaDisabled]}
          disabled={!canSubmit || submitting}
          onPress={onConfirm}
        >
          <Text style={styles.stickyCtaText}>
            {submitting ? "Requesting…" : "Request booking"}
          </Text>
        </Pressable>
      </View>

      {showAndroidPicker ? (
        <DateTimePicker
          value={draftDateValue}
          mode="date"
          display="default"
          minimumDate={minDate}
          onChange={onAndroidDateChange}
        />
      ) : null}

      <Modal
        visible={showDateModal}
        transparent
        animationType="slide"
        onRequestClose={closeDateModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDateModal} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select date</Text>
            <DateTimePicker
              value={draftDateValue}
              mode="date"
              display="inline"
              minimumDate={minDate}
              onChange={onIosDateChange}
              themeVariant="light"
              accentColor={colors.accent}
              style={styles.iosPicker}
            />
            <View style={styles.sheetActions}>
              <View style={styles.sheetActionFlex}>
                <Button label="Cancel" variant="secondary" onPress={closeDateModal} />
              </View>
              <View style={styles.sheetActionFlex}>
                <Button label="Done" onPress={confirmDate} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTimeModal}
        transparent
        animationType="slide"
        onRequestClose={closeTimeModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeTimeModal} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Available times</Text>
            <Muted>
              {formatSheetDate(date)}
              {service ? ` · ${service.name}` : ""}
            </Muted>
            {slotsLoading ? <Muted>Loading slots…</Muted> : null}
            {!slotsLoading && times.length === 0 ? (
              <Muted>No slots for this date.</Muted>
            ) : null}
            <ScrollView
              style={styles.timesScroll}
              contentContainerStyle={styles.timesContent}
              showsVerticalScrollIndicator={false}
            >
              {timeBuckets.map((bucket) => (
                <View key={bucket.key} style={styles.timeBucket}>
                  <MonoLabel>{bucket.label}</MonoLabel>
                  <View style={styles.timeChips}>
                    {bucket.times.map((t) => {
                      const active = slot === t;
                      return (
                        <Pressable
                          key={t}
                          style={[styles.timeChip, active && styles.timeChipActive]}
                          onPress={() => selectSlot(t)}
                        >
                          <Text
                            style={[
                              styles.timeChipText,
                              active && styles.timeChipTextActive,
                            ]}
                          >
                            {t}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
            <Button label="Close" variant="secondary" onPress={closeTimeModal} />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showNotesModal}
        transparent
        animationType="slide"
        onRequestClose={closeNotesModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeNotesModal}
          />
          <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
            <View
              style={[
                styles.sheet,
                {
                  paddingBottom: Math.max(insets.bottom, 20),
                },
              ]}
            >
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Add a note</Text>
              <Muted>Optional — anything the artist should know.</Muted>
              <TextInput
                style={styles.notesInput}
                value={draftNotes}
                onChangeText={setDraftNotes}
                placeholder="e.g. prefer shorter on the sides"
                placeholderTextColor={colors.textMuted}
                multiline
                autoFocus
                maxLength={500}
                onFocus={() => {
                  logger.debug("book", "notes input focus");
                  console.log("[book] notes input focus");
                }}
              />
              <View style={styles.sheetActions}>
                <View style={styles.sheetActionFlex}>
                  <Button
                    label="Cancel"
                    variant="secondary"
                    onPress={closeNotesModal}
                  />
                </View>
                <View style={styles.sheetActionFlex}>
                  <Button label="Done" onPress={confirmNotes} />
                </View>
              </View>
            </View>
          </KeyboardStickyView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnPlaceholder: { width: 40, height: 40 },
  topTitle: {
    color: colors.text,
    fontSize: 13,
    letterSpacing: 1.4,
    fontFamily: fonts.monoMedium,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 14,
  },
  providerSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceAlt,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarLetter: {
    color: colors.text,
    fontSize: 20,
    fontFamily: fonts.serifMedium,
  },
  providerInfo: { flex: 1, gap: 4, minWidth: 0 },
  providerName: {
    color: colors.text,
    fontSize: 22,
    fontFamily: fonts.serifMedium,
  },
  providerMeta: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.6,
    fontFamily: fonts.mono,
  },
  serviceList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: -4,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  serviceRowActive: {
    backgroundColor: "rgba(201, 151, 58, 0.06)",
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  serviceBody: { flex: 1, gap: 3, minWidth: 0 },
  serviceName: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.serifMedium,
  },
  serviceDuration: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.mono,
  },
  servicePrice: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.monoMedium,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  checkEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  whenList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: -4,
  },
  whenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  whenText: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.serifMedium,
  },
  whenPlaceholder: {
    color: colors.textMuted,
  },
  policy: {
    fontSize: 12,
    lineHeight: 18,
  },
  stickyBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stickyMeta: { gap: 2, minWidth: 64 },
  stickyPrice: {
    color: colors.text,
    fontSize: 20,
    fontFamily: fonts.serifBold,
  },
  stickyDuration: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.8,
    fontFamily: fonts.mono,
  },
  stickyCta: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  stickyCtaDisabled: {
    opacity: 0.45,
  },
  stickyCtaText: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fonts.monoMedium,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    maxHeight: "88%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 26,
    fontFamily: fonts.serif,
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
  },
  sheetActionFlex: {
    flex: 1,
  },
  iosPicker: {
    alignSelf: "center",
  },
  timesScroll: {
    maxHeight: 340,
  },
  timesContent: {
    gap: 16,
    paddingBottom: 4,
  },
  timeBucket: {
    gap: 10,
  },
  timeChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  timeChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  timeChipText: {
    color: colors.text,
    fontSize: 13,
    fontFamily: fonts.monoMedium,
  },
  timeChipTextActive: {
    color: colors.text,
  },
  notesInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.serifMedium,
    textAlignVertical: "top",
  },
  error: { color: colors.danger, fontSize: 14 },
});
