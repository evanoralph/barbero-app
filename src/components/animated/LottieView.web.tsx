import type { AnimationObject } from "lottie-react-native";
import { Check } from "lucide-react-native";
import { useEffect } from "react";
import { ActivityIndicator, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors } from "@/src/theme/colors";

type Props = {
  source: AnimationObject | { uri: string };
  autoPlay?: boolean;
  loop?: boolean;
  style?: StyleProp<ViewStyle>;
  onAnimationFinish?: (isCancelled: boolean) => void;
};

/**
 * lottie-react-native's web path requires @lottiefiles/dotlottie-react, an optional
 * peer we don't install — so web gets a lightweight native fallback instead: a looping
 * source renders as a plain spinner, a one-shot source pops in a static check icon.
 */
export function LottieView({ loop = true, style, onAnimationFinish }: Props) {
  if (loop) {
    return <ActivityIndicator color={colors.accent} size="large" style={style} />;
  }
  return <CheckPopIn style={style} onFinish={onAnimationFinish} />;
}

function CheckPopIn({
  style,
  onFinish,
}: {
  style?: StyleProp<ViewStyle>;
  onFinish?: (isCancelled: boolean) => void;
}) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 320 });
    const timer = setTimeout(() => onFinish?.(false), 320);
    return () => clearTimeout(timer);
  }, [onFinish, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[style, animatedStyle, { alignItems: "center", justifyContent: "center" }]}>
      <Check color={colors.accent} size={48} strokeWidth={2.5} />
    </Animated.View>
  );
}
