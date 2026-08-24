import NativeLottieView, { type AnimationObject } from "lottie-react-native";
import type { StyleProp, ViewStyle } from "react-native";

type Props = {
  source: AnimationObject | { uri: string };
  autoPlay?: boolean;
  loop?: boolean;
  style?: StyleProp<ViewStyle>;
  onAnimationFinish?: (isCancelled: boolean) => void;
};

export function LottieView({ source, autoPlay = true, loop = true, style, onAnimationFinish }: Props) {
  return (
    <NativeLottieView
      source={source}
      autoPlay={autoPlay}
      loop={loop}
      style={style}
      onAnimationFinish={onAnimationFinish}
    />
  );
}
