import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { getMyAvailability, saveMyAvailability } from "@/src/api/availability";
import {
  Button,
  Card,
  Chip,
  ErrorState,
  Field,
  LoadingState,
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import type {
  AvailabilityOverrideStatus,
  AvailabilityTimeRange,
  ProviderAvailability,
} from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import {
  AVAILABILITY_TIME_OPTIONS,
  DEFAULT_RANGE_END,
  DEFAULT_RANGE_START,
  isValidAvailabilityTime,
  newAvailabilityRange,
} from "@/src/utils/availabilityTimes";
import { formatDateKeyLabel, isDateKeyPast, toDateKey } from "@/src/utils/dateKeys";
import { logger } from "@/src/utils/logger";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const DAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

type Section = "weekly" | "overrides";

export default function AvailabilityScreen() {
  const [availability, setAvailability] = useState<ProviderAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("weekly");
  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getMyAvailability();
      logger.debug("availability", "loaded", {
        enabledDays: WEEKDAYS.filter((d) => data.weekly[d]?.enabled).length,
        overrideCount: Object.keys(data.overrides || {}).length,
      });
      setAvailability(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load availability");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateDay = (
    day: string,
    patch: Partial<{ enabled: boolean; ranges: AvailabilityTimeRange[] }>,
  ) => {
    if (!availability) return;
    const current = availability.weekly[day] ?? { enabled: false, ranges: [] };
    setAvailability({
      ...availability,
      weekly: {
        ...availability.weekly,
        [day]: { ...current, ...patch },
      },
    });
  };

  const toggleDay = (day: string) => {
    if (!availability) return;
    const current = availability.weekly[day] ?? { enabled: false, ranges: [] };
    const enabling = !current.enabled;
    updateDay(day, {
      enabled: enabling,
      ranges:
        enabling && current.ranges.length === 0
          ? [newAvailabilityRange(DEFAULT_RANGE_START, DEFAULT_RANGE_END)]
          : current.ranges,
    });
    logger.debug("availability", "toggle day", { day, enabled: enabling });
  };

  const updateRange = (
    day: string,
    rangeId: string,
    field: "start" | "end",
    value: string,
  ) => {
    if (!availability) return;
    const current = availability.weekly[day] ?? { enabled: false, ranges: [] };
    updateDay(day, {
      ranges: current.ranges.map((r) => (r.id === rangeId ? { ...r, [field]: value } : r)),
    });
  };

  const addRange = (day: string) => {
    if (!availability) return;
    const current = availability.weekly[day] ?? { enabled: true, ranges: [] };
    updateDay(day, {
      enabled: true,
      ranges: [...current.ranges, newAvailabilityRange()],
    });
    logger.debug("availability", "add range", { day });
  };

  const removeRange = (day: string, rangeId: string) => {
    if (!availability) return;
    const current = availability.weekly[day] ?? { enabled: false, ranges: [] };
    const next = current.ranges.filter((r) => r.id !== rangeId);
    updateDay(day, {
      ranges: next,
      enabled: next.length > 0 ? current.enabled : false,
    });
    logger.debug("availability", "remove range", { day, rangeId });
  };

  const setOverrideStatus = (key: string, status: AvailabilityOverrideStatus | "weekly") => {
    if (!availability) return;
    const overrides = { ...(availability.overrides || {}) };
    if (status === "weekly") {
      delete overrides[key];
      logger.debug("availability", "clear override", { key });
    } else {
      const existing = overrides[key];
      overrides[key] = {
        status,
        ranges:
          status === "unavailable"
            ? []
            : existing?.ranges?.length
              ? existing.ranges
              : [newAvailabilityRange()],
      };
      logger.debug("availability", "set override status", { key, status });
    }
    setAvailability({ ...availability, overrides });
  };

  const updateOverrideRange = (
    key: string,
    rangeId: string,
    field: "start" | "end",
    value: string,
  ) => {
    if (!availability) return;
    const current = availability.overrides[key];
    if (!current) return;
    setAvailability({
      ...availability,
      overrides: {
        ...availability.overrides,
        [key]: {
          ...current,
          ranges: current.ranges.map((r) => (r.id === rangeId ? { ...r, [field]: value } : r)),
        },
      },
    });
  };

  const addOverrideRange = (key: string) => {
    if (!availability) return;
    const current = availability.overrides[key];
    if (!current || current.status !== "custom") return;
    setAvailability({
      ...availability,
      overrides: {
        ...availability.overrides,
        [key]: {
          ...current,
          ranges: [...current.ranges, newAvailabilityRange()],
        },
      },
    });
    logger.debug("availability", "add override range", { key });
  };

  const removeOverrideRange = (key: string, rangeId: string) => {
    if (!availability) return;
    const current = availability.overrides[key];
    if (!current) return;
    setAvailability({
      ...availability,
      overrides: {
        ...availability.overrides,
        [key]: {
          ...current,
          ranges: current.ranges.filter((r) => r.id !== rangeId),
        },
      },
    });
  };

  const validate = (): string | null => {
    if (!availability) return "No availability";
    for (const day of WEEKDAYS) {
      const sched = availability.weekly[day];
      if (!sched?.enabled) continue;
      if (sched.ranges.length === 0) {
        return `${day} is enabled but has no time ranges`;
      }
      for (const r of sched.ranges) {
        if (!isValidAvailabilityTime(r.start) || !isValidAvailabilityTime(r.end)) {
          return `${day}: use times like "09:00 AM" / "05:00 PM"`;
        }
      }
    }
    for (const [key, ov] of Object.entries(availability.overrides || {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
        return `Invalid override date key: ${key}`;
      }
      if (ov.status === "custom") {
        if (ov.ranges.length === 0) {
          return `${formatDateKeyLabel(key)}: custom hours need at least one range`;
        }
        for (const r of ov.ranges) {
          if (!isValidAvailabilityTime(r.start) || !isValidAvailabilityTime(r.end)) {
            return `${formatDateKeyLabel(key)}: use times like "09:00 AM" / "05:00 PM"`;
          }
        }
      }
    }
    return null;
  };

  const save = async () => {
    if (!availability) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setOk(null);
      logger.warn("availability", "validation failed", { validationError });
      return;
    }
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const payload = {
        weekly: availability.weekly,
        overrides: availability.overrides ?? {},
      };
      const rangeSummary = WEEKDAYS.flatMap((day) => {
        const sched = payload.weekly[day];
        if (!sched?.enabled) return [];
        return sched.ranges.map((r) => `${day}: ${r.start}–${r.end}`);
      });
      const overrideKeys = Object.keys(payload.overrides);
      logger.info("availability", "saving", {
        ranges: rangeSummary,
        overrides: overrideKeys,
      });
      const saved = await saveMyAvailability(payload);
      setAvailability(saved);
      setOk("Availability saved");
      logger.info("availability", "saved", {
        rangeCount: rangeSummary.length,
        overrideCount: overrideKeys.length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      logger.error("availability", "save failed", e);
    } finally {
      setSaving(false);
    }
  };

  const calendarCells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = (firstDay + 6) % 7; // Monday = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<number | null> = [
      ...Array(startOffset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    return { year, month, cells };
  }, [viewMonth]);

  const todayKey = toDateKey(new Date());
  const selectedOverride = selectedKey ? availability?.overrides?.[selectedKey] : null;
  const selectedStatus: AvailabilityOverrideStatus | "weekly" = selectedOverride
    ? selectedOverride.status
    : "weekly";

  if (loading) return <LoadingState />;
  if (error && !availability) return <ErrorState message={error} onRetry={load} />;
  if (!availability) return <ErrorState message="No availability" />;

  return (
    <Screen scroll>
      <Title>Availability</Title>
      <Muted>Weekly hours and one-off date overrides (AM/PM times).</Muted>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Chip
          label="Weekly"
          active={section === "weekly"}
          onPress={() => setSection("weekly")}
        />
        <Chip
          label={`Overrides (${Object.keys(availability.overrides || {}).length})`}
          active={section === "overrides"}
          onPress={() => setSection("overrides")}
        />
      </View>

      {section === "weekly" ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {WEEKDAYS.map((day) => {
              const enabled = Boolean(availability.weekly[day]?.enabled);
              return (
                <Chip
                  key={day}
                  label={day.slice(0, 3)}
                  active={enabled}
                  onPress={() => toggleDay(day)}
                />
              );
            })}
          </View>
          {WEEKDAYS.map((day) => {
            const sched = availability.weekly[day];
            if (!sched?.enabled) return null;
            return (
              <Card key={day}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{day}</Text>
                {sched.ranges.map((r) => (
                  <View key={r.id} style={{ gap: 8, marginTop: 4 }}>
                    <Muted>Range</Muted>
                    <TimePickerRow
                      label="Start"
                      value={r.start}
                      onChange={(v) => updateRange(day, r.id, "start", v)}
                    />
                    <TimePickerRow
                      label="End"
                      value={r.end}
                      onChange={(v) => updateRange(day, r.id, "end", v)}
                    />
                    {sched.ranges.length > 1 ? (
                      <Button
                        label="Remove range"
                        variant="ghost"
                        onPress={() => removeRange(day, r.id)}
                      />
                    ) : null}
                  </View>
                ))}
                <Button label="Add range" variant="secondary" onPress={() => addRange(day)} />
              </Card>
            );
          })}
        </>
      ) : (
        <>
          <Muted>
            Tap a day to mark unavailable or set custom hours. Past days cannot be edited.
          </Muted>
          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Button
                label="Prev"
                variant="ghost"
                onPress={() => {
                  setViewMonth(
                    new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
                  );
                  setSelectedKey(null);
                  logger.debug("availability", "prev month");
                }}
              />
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {viewMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
              </Text>
              <Button
                label="Next"
                variant="ghost"
                onPress={() => {
                  setViewMonth(
                    new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
                  );
                  setSelectedKey(null);
                  logger.debug("availability", "next month");
                }}
              />
            </View>
            <View style={{ flexDirection: "row", marginTop: 8 }}>
              {DAY_HEADERS.map((d) => (
                <Text
                  key={d}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    color: colors.textMuted,
                    fontSize: 11,
                    fontWeight: "600",
                  }}
                >
                  {d}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {calendarCells.cells.map((day, idx) => {
                if (day == null) {
                  return <View key={`e-${idx}`} style={{ width: `${100 / 7}%`, height: 40 }} />;
                }
                const key = `${calendarCells.year}-${String(calendarCells.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const ov = availability.overrides[key];
                const past = isDateKeyPast(key);
                const selected = key === selectedKey;
                const isToday = key === todayKey;
                return (
                  <Pressable
                    key={key}
                    disabled={past}
                    onPress={() => {
                      setSelectedKey(key === selectedKey ? null : key);
                      logger.debug("availability", "select day", { key });
                    }}
                    style={{
                      width: `${100 / 7}%`,
                      height: 40,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: selected ? colors.accent : "transparent",
                        borderWidth: isToday && !selected ? 1 : 0,
                        borderColor: colors.border,
                        opacity: past ? 0.35 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? colors.text : colors.text,
                          fontWeight: selected || isToday ? "700" : "500",
                          fontSize: 13,
                        }}
                      >
                        {day}
                      </Text>
                    </View>
                    {ov ? (
                      <View
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 3,
                          marginTop: -4,
                          backgroundColor:
                            ov.status === "unavailable" ? colors.danger : colors.text,
                        }}
                      />
                    ) : (
                      <View style={{ height: 5, marginTop: -4 }} />
                    )}
                  </Pressable>
                );
              })}
            </View>
            <Muted>Dot: custom hours · Red dot: unavailable</Muted>
          </Card>

          {selectedKey ? (
            <Card>
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {formatDateKeyLabel(selectedKey)}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(
                  [
                    ["weekly", "Use weekly"],
                    ["unavailable", "Unavailable"],
                    ["custom", "Custom hours"],
                  ] as const
                ).map(([status, label]) => (
                  <Chip
                    key={status}
                    label={label}
                    active={selectedStatus === status}
                    onPress={() => setOverrideStatus(selectedKey, status)}
                  />
                ))}
              </View>
              {selectedStatus === "custom" && selectedOverride
                ? selectedOverride.ranges.map((r) => (
                    <View key={r.id} style={{ gap: 8, marginTop: 4 }}>
                      <TimePickerRow
                        label="Start"
                        value={r.start}
                        onChange={(v) => updateOverrideRange(selectedKey, r.id, "start", v)}
                      />
                      <TimePickerRow
                        label="End"
                        value={r.end}
                        onChange={(v) => updateOverrideRange(selectedKey, r.id, "end", v)}
                      />
                      {selectedOverride.ranges.length > 1 ? (
                        <Button
                          label="Remove range"
                          variant="ghost"
                          onPress={() => removeOverrideRange(selectedKey, r.id)}
                        />
                      ) : null}
                    </View>
                  ))
                : null}
              {selectedStatus === "custom" ? (
                <Button
                  label="Add range"
                  variant="secondary"
                  onPress={() => addOverrideRange(selectedKey)}
                />
              ) : null}
              {selectedStatus !== "weekly" ? (
                <Button
                  label="Clear override"
                  variant="danger"
                  onPress={() => setOverrideStatus(selectedKey, "weekly")}
                />
              ) : null}
            </Card>
          ) : (
            <Muted>Select a day to edit an override.</Muted>
          )}

          {Object.keys(availability.overrides || {}).length > 0 ? (
            <Card>
              <Muted>Saved overrides</Muted>
              {Object.entries(availability.overrides)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, ov]) => (
                  <Pressable
                    key={key}
                    onPress={() => {
                      const d = key.split("-").map(Number);
                      if (d.length === 3) {
                        setViewMonth(new Date(d[0], d[1] - 1, 1));
                      }
                      setSelectedKey(key);
                      logger.debug("availability", "jump to override", { key });
                    }}
                  >
                    <Text style={{ color: colors.text }}>
                      {formatDateKeyLabel(key)} · {ov.status}
                      {ov.status === "custom"
                        ? ` · ${ov.ranges.map((r) => `${r.start}–${r.end}`).join(", ")}`
                        : ""}
                    </Text>
                  </Pressable>
                ))}
            </Card>
          ) : null}
        </>
      )}

      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {ok ? <Text style={{ color: colors.success }}>{ok}</Text> : null}
      <Button label="Save availability" onPress={save} loading={saving} />
    </Screen>
  );
}

const QUICK_TIMES = AVAILABILITY_TIME_OPTIONS.filter((t) => {
  const match = t.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return false;
  let h = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") h += 12;
  if (match[3].toUpperCase() === "AM" && Number(match[1]) === 12) h = 0;
  return h >= 7 && h <= 21 && match[2] === "00";
});

function TimePickerRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Field
        label={label}
        value={value}
        onChangeText={onChange}
        autoCapitalize="characters"
        placeholder="09:00 AM"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {QUICK_TIMES.map((t) => (
            <Chip key={`${label}-${t}`} label={t} active={t === value} onPress={() => onChange(t)} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
