import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/src/theme/colors";

const STRENGTH_LEVELS = [
  { label: "Weak", color: colors.danger },
  { label: "Fair", color: colors.warning },
  { label: "Good", color: colors.accent },
  { label: "Strong", color: colors.success },
] as const;

/** Score is 1-4 (weak..strong), or 0 for an empty password. */
export function getPasswordStrengthScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.max(1, Math.min(score, 4));
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const score = getPasswordStrengthScore(password);
  const level = STRENGTH_LEVELS[score - 1];

  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
        {STRENGTH_LEVELS.map((_, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              { backgroundColor: index < score ? level.color : colors.border },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: level.color }]}>Password strength: {level.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  bars: { flexDirection: "row", gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  label: { fontSize: 12, fontWeight: "600" },
});
