import Svg, { Circle, Line } from "react-native-svg";
import { colors } from "@/src/theme/colors";

/** Minimal line-art scissors, used for services-empty states. */
export function EmptyServicesIllustration({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" fill="none">
      <Circle cx="22" cy="48" r="7" stroke={colors.text} strokeWidth={2} />
      <Circle cx="22" cy="24" r="7" stroke={colors.text} strokeWidth={2} />
      <Line x1="27" y1="43" x2="54" y2="16" stroke={colors.text} strokeWidth={2} strokeLinecap="round" />
      <Line x1="27" y1="29" x2="54" y2="56" stroke={colors.text} strokeWidth={2} strokeLinecap="round" />
      <Circle cx="27" cy="36" r="3" fill={colors.accent} />
    </Svg>
  );
}
