import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/src/theme/colors";

/** Minimal line-art chat bubble, used for messages-empty states. */
export function EmptyMessagesIllustration({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" fill="none">
      <Path
        d="M16 22C16 19.79 17.79 18 20 18H52C54.21 18 56 19.79 56 22V42C56 44.21 54.21 46 52 46H30L20 54V46C17.79 46 16 44.21 16 42V22Z"
        stroke={colors.text}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx="27" cy="32" r="2" fill={colors.accent} />
      <Circle cx="36" cy="32" r="2" fill={colors.text} />
      <Circle cx="45" cy="32" r="2" fill={colors.text} />
    </Svg>
  );
}
