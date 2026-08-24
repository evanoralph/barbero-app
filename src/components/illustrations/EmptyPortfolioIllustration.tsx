import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "@/src/theme/colors";

/** Minimal line-art stacked photo frames, used for portfolio-empty states. */
export function EmptyPortfolioIllustration({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" fill="none">
      <Rect x="20" y="24" width="34" height="26" rx="2" stroke={colors.text} strokeWidth={1.5} />
      <Rect x="14" y="18" width="34" height="26" rx="2" stroke={colors.text} strokeWidth={2} fill={colors.bg} />
      <Path d="M14 36L23 27L31 35L40 26" stroke={colors.text} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="21.5" cy="24.5" r="2.5" fill={colors.accent} />
    </Svg>
  );
}
