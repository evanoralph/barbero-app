import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMyAvailability, saveMyAvailability } from "@/src/api/availability";
import {
  Button,
  Chip,
  ErrorState,
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
import { fonts } from "@/src/theme/fonts";
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

type TimePickerTarget = {
  scope: "weekly" | "override";
  dayOrKey: string;
  rangeId: string;
  field: "start" | "end";
  value: string;
};

function summarizeRanges(ranges: AvailabilityTimeRange[]): string {
  if (ranges.length === 0) return "No hours";
  return ranges.map((r) => `${r.start}–${r.end}`).join(", ");
}

export default function AvailabilityScreen() {
  const insets = useSafeAreaInsets();
  const [availability, setAvailability] = useState<ProviderAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("weekly");
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [timePicker, setTimePicker] = useState<TimePickerTarget | null>(null);
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
    if (!enabling && expandedDay === day) {
      setExpandedDay(null);
      logger.debug("availability", "collapse day (disabled)", { day });
    } else if (enabling) {
      setExpandedDay(day);
      logger.debug("availability", "expand day (enabled)", { day });
    }
    logger.debug("availability", "toggle day", { day, enabled: enabling });
  };

  const toggleExpandDay = (day: string) => {
    const next = expandedDay === day ? null : day;
    setExpandedDay(next);
    logger.debug("availability", "accordion", { day, expanded: Boolean(next) });
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
    if (next.length === 0 && expandedDay === day) {
      setExpandedDay(null);
    }
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
    logger.debug("availability", "remove override range", { key, rangeId });
  };

  const openTimePicker = (target: TimePickerTarget) => {
    setTimePicker(target);
    logger.debug("availability", "time sheet open", {
      scope: target.scope,
      dayOrKey: target.dayOrKey,
      field: target.field,
      value: target.value,
    });
  };

  const closeTimePicker = () => {
    logger.debug("availability", "time sheet close");
    setTimePicker(null);
  };

  const selectTime = (value: string) => {
    if (!timePicker) return;
    logger.debug("availability", "time select", {
      scope: timePicker.scope,
      dayOrKey: timePicker.dayOrKey,
      field: timePicker.field,
      value,
    });
    if (timePicker.scope === "weekly") {
      updateRange(timePicker.dayOrKey, timePicker.rangeId, timePicker.field, value);
    } else {
      updateOverrideRange(timePicker.dayOrKey, timePicker.rangeId, timePicker.field, value);
    }
    setTimePicker(null);
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
  const overrideEntries = useMemo(
    () =>
      Object.entries(availability?.overrides || {}).sort(([a], [b]) => a.localeCompare(b)),
    [availability?.overrides],
  );

  if (loading) return <LoadingState />;
  if (error && !availability) return <ErrorState message={error} onRetry={load} />;
  if (!availability) return <ErrorState message="No availability" />;

  return (
    <>
      <Screen scroll>
        <Title>Availability</Title>
        <Muted>Weekly hours and date overrides.</Muted>
        <View style={styles.chipRow}>
          <Chip
            label="Weekly"
            active={section === "weekly"}
            onPress={() => {
              setSection("weekly");
              logger.debug("availability", "section", { section: "weekly" });
            }}
          />
          <Chip
            label={`Overrides (${Object.keys(availability.overrides || {}).length})`}
            active={section === "overrides"}
            onPress={() => {
              setSection("overrides");
              logger.debug("availability", "section", { section: "overrides" });
            }}
          />
        </View>

        {section === "weekly" ? (
          <View style={styles.list}>
            {WEEKDAYS.map((day, index) => {
              const sched = availability.weekly[day] ?? { enabled: false, ranges: [] };
              const enabled = Boolean(sched.enabled);
              const expanded = expandedDay === day && enabled;
              return (
                <View
                  key={day}
                  style={[index < WEEKDAYS.length - 1 && styles.rowBorder]}
                >
                  <View style={styles.dayRow}>
                    <Pressable
                      onPress={() => toggleDay(day)}
                      style={[styles.onOff, enabled && styles.onOffActive]}
                      hitSlop={6}
                    >
                      <Text style={[styles.onOffText, enabled && styles.onOffTextActive]}>
                        {enabled ? "On" : "Off"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.dayMain}
                      onPress={() => {
                        if (!enabled) {
                          toggleDay(day);
                          return;
                        }
                        toggleExpandDay(day);
                      }}
                    >
                      <Text style={styles.dayTitle}>{day.slice(0, 3)}</Text>
                      <Text style={styles.daySummary} numberOfLines={1}>
                        {enabled ? summarizeRanges(sched.ranges) : "Off"}
                      </Text>
                    </Pressable>
                    <Text style={styles.chevron}>{expanded ? "▾" : "▸"}</Text>
                  </View>
                  {expanded ? (
                    <View style={styles.expandBody}>
                      {sched.ranges.map((r) => (
                        <CompactRangeRow
                          key={r.id}
                          start={r.start}
                          end={r.end}
                          canRemove={sched.ranges.length > 1}
                          onPressStart={() =>
                            openTimePicker({
                              scope: "weekly",
                              dayOrKey: day,
                              rangeId: r.id,
                              field: "start",
                              value: r.start,
                            })
                          }
                          onPressEnd={() =>
                            openTimePicker({
                              scope: "weekly",
                              dayOrKey: day,
                              rangeId: r.id,
                              field: "end",
                              value: r.end,
                            })
                          }
                          onRemove={() => removeRange(day, r.id)}
                        />
                      ))}
                      <Pressable
                        onPress={() => addRange(day)}
                        style={styles.linkBtn}
                        hitSlop={8}
                      >
                        <Text style={styles.linkBtnText}>+ Add range</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : (
          <>
            <Muted>Tap a future day for unavailable or custom hours.</Muted>
            <View style={styles.list}>
              <View style={styles.monthNav}>
                <Pressable
                  onPress={() => {
                    setViewMonth(
                      new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
                    );
                    setSelectedKey(null);
                    logger.debug("availability", "prev month");
                  }}
                  hitSlop={8}
                  style={styles.monthNavBtn}
                >
                  <Text style={styles.monthNavText}>Prev</Text>
                </Pressable>
                <Text style={styles.monthTitle}>
                  {viewMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
                </Text>
                <Pressable
                  onPress={() => {
                    setViewMonth(
                      new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
                    );
                    setSelectedKey(null);
                    logger.debug("availability", "next month");
                  }}
                  hitSlop={8}
                  style={styles.monthNavBtn}
                >
                  <Text style={styles.monthNavText}>Next</Text>
                </Pressable>
              </View>
              <View style={styles.calHeader}>
                {DAY_HEADERS.map((d) => (
                  <Text key={d} style={styles.calHeaderText}>
                    {d}
                  </Text>
                ))}
              </View>
              <View style={styles.calGrid}>
                {calendarCells.cells.map((day, idx) => {
                  if (day == null) {
                    return <View key={`e-${idx}`} style={[styles.calCell, styles.calCellWidth]} />;
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
                      style={[styles.calCell, styles.calCellWidth]}
                    >
                      <View
                        style={[
                          styles.calDay,
                          selected && styles.calDaySelected,
                          isToday && !selected && styles.calDayToday,
                          past && styles.calDayPast,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calDayText,
                            (selected || isToday) && styles.calDayTextStrong,
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                      {ov ? (
                        <View
                          style={[
                            styles.calDot,
                            ov.status === "unavailable" && styles.calDotDanger,
                          ]}
                        />
                      ) : (
                        <View style={styles.calDotSpacer} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <Muted style={styles.calLegend}>Dot: custom · Red: unavailable</Muted>
            </View>

            {selectedKey ? (
              <View style={styles.list}>
                <View style={styles.overrideHeader}>
                  <Text style={styles.dayTitle}>{formatDateKeyLabel(selectedKey)}</Text>
                </View>
                <View style={[styles.chipRow, styles.overrideChips]}>
                  {(
                    [
                      ["weekly", "Weekly"],
                      ["unavailable", "Off"],
                      ["custom", "Custom"],
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
                {selectedStatus === "custom" && selectedOverride ? (
                  <View style={styles.expandBody}>
                    {selectedOverride.ranges.map((r) => (
                      <CompactRangeRow
                        key={r.id}
                        start={r.start}
                        end={r.end}
                        canRemove={selectedOverride.ranges.length > 1}
                        onPressStart={() =>
                          openTimePicker({
                            scope: "override",
                            dayOrKey: selectedKey,
                            rangeId: r.id,
                            field: "start",
                            value: r.start,
                          })
                        }
                        onPressEnd={() =>
                          openTimePicker({
                            scope: "override",
                            dayOrKey: selectedKey,
                            rangeId: r.id,
                            field: "end",
                            value: r.end,
                          })
                        }
                        onRemove={() => removeOverrideRange(selectedKey, r.id)}
                      />
                    ))}
                    <Pressable
                      onPress={() => addOverrideRange(selectedKey)}
                      style={styles.linkBtn}
                      hitSlop={8}
                    >
                      <Text style={styles.linkBtnText}>+ Add range</Text>
                    </Pressable>
                  </View>
                ) : null}
                {selectedStatus !== "weekly" ? (
                  <Pressable
                    onPress={() => setOverrideStatus(selectedKey, "weekly")}
                    style={styles.clearOverride}
                    hitSlop={8}
                  >
                    <Text style={styles.clearOverrideText}>Clear override</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Muted>Select a day to edit.</Muted>
            )}

            {overrideEntries.length > 0 ? (
              <View style={styles.list}>
                <View style={styles.overrideHeader}>
                  <Muted>Saved overrides</Muted>
                </View>
                {overrideEntries.map(([key, ov], index) => (
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
                    style={[
                      styles.savedRow,
                      index < overrideEntries.length - 1 && styles.rowBorder,
                    ]}
                  >
                    <Text style={styles.savedRowText} numberOfLines={2}>
                      {formatDateKeyLabel(key)} · {ov.status}
                      {ov.status === "custom"
                        ? ` · ${summarizeRanges(ov.ranges)}`
                        : ""}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        )}

        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        {ok ? <Text style={{ color: colors.success }}>{ok}</Text> : null}
        <Button label="Save availability" onPress={save} loading={saving} />
      </Screen>

      <Modal
        visible={Boolean(timePicker)}
        animationType="slide"
        transparent
        onRequestClose={closeTimePicker}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeTimePicker} />
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {timePicker?.field === "start" ? "Start time" : "End time"}
            </Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.timeList}
            >
              {AVAILABILITY_TIME_OPTIONS.map((t) => {
                const active = t === timePicker?.value;
                return (
                  <Pressable
                    key={t}
                    onPress={() => selectTime(t)}
                    style={[styles.timeOption, active && styles.timeOptionActive]}
                  >
                    <Text
                      style={[styles.timeOptionText, active && styles.timeOptionTextActive]}
                    >
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function CompactRangeRow({
  start,
  end,
  canRemove,
  onPressStart,
  onPressEnd,
  onRemove,
}: {
  start: string;
  end: string;
  canRemove: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.rangeRow}>
      <Pressable onPress={onPressStart} style={styles.timeChip}>
        <Text style={styles.timeChipLabel}>Start</Text>
        <Text style={styles.timeChipValue}>{start}</Text>
      </Pressable>
      <Text style={styles.rangeDash}>–</Text>
      <Pressable onPress={onPressEnd} style={styles.timeChip}>
        <Text style={styles.timeChipLabel}>End</Text>
        <Text style={styles.timeChipValue}>{end}</Text>
      </Pressable>
      {canRemove ? (
        <Pressable onPress={onRemove} hitSlop={8} style={styles.removeBtn}>
          <Text style={styles.removeBtnText}>×</Text>
        </Pressable>
      ) : (
        <View style={styles.removeBtnSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  onOff: {
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
  },
  onOffActive: {
    borderColor: colors.accent,
    backgroundColor: colors.white,
  },
  onOffText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: fonts.mono,
  },
  onOffTextActive: {
    color: colors.accentDark,
  },
  dayMain: {
    flex: 1,
    gap: 2,
  },
  dayTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
  },
  daySummary: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.mono,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 14,
    width: 16,
    textAlign: "center",
  },
  expandBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  timeChipLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  timeChipValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: fonts.mono,
  },
  rangeDash: {
    color: colors.textMuted,
    fontSize: 14,
  },
  removeBtn: {
    width: 28,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnSpacer: {
    width: 28,
  },
  removeBtnText: {
    color: colors.danger,
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 24,
  },
  linkBtn: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  linkBtnText: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 13,
    fontFamily: fonts.monoMedium,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  monthNavBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    minWidth: 44,
  },
  monthNavText: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 13,
    fontFamily: fonts.monoMedium,
  },
  monthTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
  },
  calHeader: {
    flexDirection: "row",
    paddingHorizontal: 8,
    marginTop: 4,
  },
  calHeaderText: {
    flex: 1,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  calCell: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  calCellWidth: {
    width: "14.2857%",
  },
  calDay: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  calDaySelected: {
    backgroundColor: colors.accent,
  },
  calDayToday: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  calDayPast: {
    opacity: 0.35,
  },
  calDayText: {
    color: colors.text,
    fontWeight: "500",
    fontSize: 13,
  },
  calDayTextStrong: {
    fontWeight: "700",
  },
  calDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: -2,
    backgroundColor: colors.text,
  },
  calDotDanger: {
    backgroundColor: colors.danger,
  },
  calDotSpacer: {
    height: 5,
    marginTop: -2,
  },
  calLegend: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    fontSize: 11,
  },
  overrideHeader: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  overrideChips: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  clearOverride: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  clearOverrideText: {
    color: colors.danger,
    fontWeight: "600",
    fontSize: 13,
    fontFamily: fonts.mono,
  },
  savedRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  savedRowText: {
    color: colors.text,
    fontSize: 13,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "70%",
    gap: 8,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontFamily: fonts.serif,
    marginBottom: 4,
  },
  timeList: {
    paddingBottom: 8,
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  timeOptionActive: {
    backgroundColor: colors.surfaceAlt,
  },
  timeOptionText: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.mono,
  },
  timeOptionTextActive: {
    color: colors.accentDark,
    fontWeight: "700",
  },
});
