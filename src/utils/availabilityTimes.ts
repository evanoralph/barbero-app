/** 30-minute labels matching Meteor `parseTimeLabel` (e.g. "09:00 AM"). */
export const AVAILABILITY_TIME_OPTIONS: string[] = (() => {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      const period = h < 12 ? "AM" : "PM";
      options.push(`${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`);
    }
  }
  return options;
})();

export const DEFAULT_RANGE_START = "09:00 AM";
export const DEFAULT_RANGE_END = "05:00 PM";

const TIME_RE = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

export function isValidAvailabilityTime(label: string): boolean {
  return TIME_RE.test(label.trim());
}

export function newAvailabilityRange(
  start = DEFAULT_RANGE_START,
  end = DEFAULT_RANGE_END,
): { id: string; start: string; end: string } {
  return {
    id: `range-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    start,
    end,
  };
}
