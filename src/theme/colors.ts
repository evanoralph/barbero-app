/** White / black / gold light palette. */
export const colors = {
  bg: "#FFFFFF",
  bgDeep: "#FAFAFA",
  surface: "#FAFAFA",
  surfaceAlt: "#F3F3F3",
  surfaceRaised: "#FFFFFF",
  border: "#E5E5E5",
  borderStrong: "#11111122",
  text: "#0A0A0A",
  textMuted: "#6B6B6B",
  accent: "#C9973A",
  accentDark: "#A67B2E",
  /** Kept for API compat; maps into gold/black family only. */
  accentTerracotta: "#8A6A28",
  accentLavender: "#0A0A0A",
  danger: "#D4183D",
  success: "#16A34A",
  warning: "#D97706",
  white: "#FFFFFF",
  inputBg: "#FFFFFF",
  overlay: "rgba(10, 10, 10, 0.55)",
  /** Text over photo overlays (hero/cards). */
  onImage: "#FFFFFF",
};

export function categoryAccent(slug?: string): string {
  const key = (slug ?? "").toLowerCase();
  if (key.includes("tattoo")) return colors.accentDark;
  if (key.includes("nail")) return colors.text;
  if (key.includes("hair") || key.includes("barber") || key.includes("salon")) {
    return colors.accent;
  }
  return colors.accent;
}
