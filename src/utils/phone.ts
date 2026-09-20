/** Philippine mobile: 09XXXXXXXXX / +639XXXXXXXXX / 639XXXXXXXXX. */

export const PH_MOBILE_HINT = "e.g. 0917 123 4567 or +63 917 123 4567";
export const PH_MOBILE_ERROR = `Enter a valid PH mobile number (${PH_MOBILE_HINT})`;

/** Strip to digits only. */
export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Normalize a PH mobile to E.164 (+639XXXXXXXXX).
 * Returns null when empty or invalid.
 */
export function normalizePhMobile(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const digits = digitsOnly(trimmed);
  let subscriber: string | null = null;

  if (digits.length === 11 && digits.startsWith("09")) {
    subscriber = digits.slice(1); // 9XXXXXXXXX
  } else if (digits.length === 12 && digits.startsWith("639")) {
    subscriber = digits.slice(2);
  } else if (digits.length === 10 && digits.startsWith("9")) {
    subscriber = digits;
  } else if (digits.length === 13 && digits.startsWith("0639")) {
    subscriber = digits.slice(3);
  }

  if (!subscriber || !/^9\d{9}$/.test(subscriber)) {
    return null;
  }
  return `+63${subscriber}`;
}

export function isValidPhMobile(raw: string | null | undefined): boolean {
  return normalizePhMobile(raw) != null;
}

/** Empty → undefined; invalid → null; valid → +639… */
export function parseOptionalPhMobile(
  raw: string | null | undefined,
): string | undefined | null {
  if (raw == null || !String(raw).trim()) return undefined;
  return normalizePhMobile(raw);
}
