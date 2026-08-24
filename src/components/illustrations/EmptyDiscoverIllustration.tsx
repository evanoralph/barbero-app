import Svg, { Circle, Line } from "react-native-svg";
import { colors } from "@/src/theme/colors";

/** Minimal line-art magnifying glass, used for the "no artists yet" discovery empty state. */
export function EmptyDiscoverIllustration({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" fill="none">
      <Circle cx="31" cy="31" r="17" stroke={colors.text} strokeWidth={2} />
      <Line x1="43.5" y1="43.5" x2="59" y2="59" stroke={colors.text} strokeWidth={2} strokeLinecap="round" />
      <Circle cx="31" cy="31" r="3.5" fill={colors.accent} />
    </Svg>
  );
}
