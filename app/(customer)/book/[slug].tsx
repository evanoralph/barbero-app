import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Calendar, Clock } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createBooking } from "@/src/api/bookings";
import { ApiError } from "@/src/api/client";
import { getProvider, getProviderSlots } from "@/src/api/providers";
import { useSession } from "@/src/auth/session";
import {
  Button,
  Card,
  Chip,
  ErrorState,
  Field,
  LoadingState,
  MonoLabel,
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import type { ProviderProfile, ProviderService } from "@/src/types/api";
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

export default function BookScreen() {
  const { slug, serviceId } = useLocalSearchParams<{ slug: string; serviceId?: string }>();
  const { user } = useSession();
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [service, setService] = useState<ProviderService | null>(null);
  const [date, setDate] = useState(todayISODate());
  const [draftDate, setDraftDate] = useState(todayISODate());
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [times, setTimes] = useState<string[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const draftDateValue = useMemo(() => parseISODate(draftDate), [draftDate]);
  const minDate = useMemo(() => parseISODate(todayISODate()), []);

  const loadProvider = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    const preferredId = typeof serviceId === "string" ? serviceId : undefined;
    logger.debug("book", "load provider", { slug, serviceId: preferredId });
    try {
      const p = await getProvider(slug);
      setProvider(p);
      const preselected = preferredId
        ? p.services.find((s) => s.id === preferredId)
        : undefined;
      setService(preselected ?? p.services[0] ?? null);
      logger.debug("book", "provider loaded", {
        services: p.services.length,
        preselected: preselected?.id ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      logger.warn("book", "load failed", e);
    } finally {
      setLoading(false);
    }
  }, [slug, serviceId]);

  useEffect(() => {
    loadProvider();
  }, [loadProvider]);

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
        }
      } catch (e) {
        logger.warn("book", "slots failed", e);
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
    setShowTimeModal(true);
  };

  const closeTimeModal = () => {
    logger.debug("book", "close time modal");
    setShowTimeModal(false);
  };

  const selectSlot = (t: string) => {
    logger.debug("book", "select slot", { t });
    setSlot(t);
    setShowTimeModal(false);
  };

  const onConfirm = async () => {
    if (!user || !provider || !service || !slot) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    logger.debug("book", "confirm", {
      providerId: provider._id,
      service: service.name,
      date,
      slot,
      notes: notes.trim() || undefined,
    });
    try {
      const starts = combineLocal(date, slot);
      const ends = new Date(starts.getTime() + service.durationMinutes * 60_000);
      const booking = await createBooking({
        customerId: user.userId,
        providerId: provider._id,
        serviceName: service.name,
        startsAt: starts.toISOString(),
        endsAt: ends.toISOString(),
      });
      logger.info("book", "created", { id: booking._id });
      setSuccess(`Booked ${service.name}. Status: ${booking.status}`);
      router.replace(`/(customer)/bookings/${booking._id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Booking failed");
      logger.warn("book", "create failed", e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !provider) return <ErrorState message={error} onRetry={loadProvider} />;
  if (!provider) return <ErrorState message="Provider not found" />;

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable
        style={styles.backBtn}
        onPress={() => {
          logger.debug("book", "back");
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace(`/(customer)/provider/${slug}`);
          }
        }}
        hitSlop={10}
        accessibilityLabel="Go back"
      >
        <ArrowLeft color={colors.text} size={20} strokeWidth={2} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>

      <MonoLabel>Booking</MonoLabel>
      <Title>Book {provider.name}</Title>
      <Muted>Select a service to get started, then pick a date and time.</Muted>

      <Title style={styles.section}>Services</Title>
      {provider.services.length === 0 ? (
        <Muted>No services available.</Muted>
      ) : (
        provider.services.map((s) => {
          const active = service?.id === s.id;
          return (
            <Card key={s.id} style={active ? styles.serviceActive : undefined}>
              <Text style={styles.serviceName}>{s.name}</Text>
              <MonoLabel>
                ${s.price} · {s.durationMinutes} min
              </MonoLabel>
              {s.description ? <Muted>{s.description}</Muted> : null}
              <Button
                label={active ? "Selected" : "Select"}
                variant={active ? "primary" : "secondary"}
                onPress={() => {
                  logger.debug("book", "select service", { id: s.id });
                  setService(s);
                }}
              />
            </Card>
          );
        })
      )}

      <Title style={styles.section}>Date & time</Title>
      {Platform.OS === "web" ? (
        <Field
          label="Date (YYYY-MM-DD)"
          value={date}
          onChangeText={(value) => {
            logger.debug("book", "date typed (web)", { date: value });
            setDate(value);
          }}
          autoCapitalize="none"
        />
      ) : (
        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>Appointment date</Text>
          <Pressable
            style={styles.selectBtn}
            onPress={openDateModal}
            accessibilityLabel="Select appointment date"
          >
            <Calendar color={colors.accent} size={18} strokeWidth={2} />
            <Text style={styles.selectBtnText}>{formatDisplayDate(date)}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.fieldWrap}>
        <Text style={styles.fieldLabel}>Available time</Text>
        <Pressable
          style={styles.selectBtn}
          onPress={openTimeModal}
          accessibilityLabel="Select available time"
        >
          <Clock color={colors.accent} size={18} strokeWidth={2} />
          <Text style={[styles.selectBtnText, !slot && styles.selectBtnPlaceholder]}>
            {slot ?? (slotsLoading ? "Loading times…" : "Select a time")}
          </Text>
        </Pressable>
      </View>

      <Field
        label="Notes (optional)"
        placeholder="Anything we should know?"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <Button
        label="Confirm Booking"
        onPress={onConfirm}
        loading={submitting}
        disabled={!canSubmit}
      />

      {/* Android system date dialog */}
      {showAndroidPicker ? (
        <DateTimePicker
          value={draftDateValue}
          mode="date"
          display="default"
          minimumDate={minDate}
          onChange={onAndroidDateChange}
        />
      ) : null}

      {/* iOS / web date modal */}
      <Modal
        visible={showDateModal}
        transparent
        animationType="slide"
        onRequestClose={closeDateModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDateModal} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select date</Text>
            <Muted>Choose a day for your appointment.</Muted>
            <DateTimePicker
              value={draftDateValue}
              mode="date"
              display="inline"
              minimumDate={minDate}
              onChange={onIosDateChange}
              themeVariant="light"
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

      {/* Available times modal */}
      <Modal
        visible={showTimeModal}
        transparent
        animationType="slide"
        onRequestClose={closeTimeModal}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeTimeModal} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Available times</Text>
            <Muted>{formatDisplayDate(date)}</Muted>
            {slotsLoading ? <Muted>Loading slots…</Muted> : null}
            {!slotsLoading && times.length === 0 ? (
              <Muted>No slots for this date.</Muted>
            ) : null}
            <ScrollView
              style={styles.timesScroll}
              contentContainerStyle={styles.chips}
              showsVerticalScrollIndicator={false}
            >
              {times.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  active={slot === t}
                  onPress={() => selectSlot(t)}
                />
              ))}
            </ScrollView>
            <Button label="Close" variant="secondary" onPress={closeTimeModal} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 4,
    marginBottom: 2,
  },
  backLabel: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.monoMedium,
  },
  section: { fontSize: 20, marginTop: 4 },
  serviceName: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.serifMedium,
  },
  serviceActive: {
    borderColor: colors.accent,
  },
  fieldWrap: { gap: 6 },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: fonts.mono,
  },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectBtnText: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.serifMedium,
  },
  selectBtnPlaceholder: {
    color: colors.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
    maxHeight: "85%",
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
    fontSize: 22,
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
    maxHeight: 280,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 4,
  },
  error: { color: colors.danger, fontSize: 14 },
  success: { color: colors.success, fontSize: 14 },
});
