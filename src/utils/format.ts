/** Coerce unknown API numerics to a finite number; missing/NaN → 0. */
export function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Format a rating for display (e.g. "4.5"); never throws on undefined. */
export function formatRating(value: unknown, digits = 1): string {
  return safeNumber(value).toFixed(digits);
}

export const DEFAULT_CURRENCY = "PHP";

export function formatMoney(amount: number, currency = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
