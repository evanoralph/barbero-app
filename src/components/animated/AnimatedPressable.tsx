import React from "react";
import { Pressable, type PressableProps, type ViewStyle } from "react-native";
import Animated, {
  type AnimatedStyle,
  type EntryOrExitLayoutType,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

type StyleEntry = AnimatedStyle<ViewStyle> | ViewStyle | false | null | undefined;

type Props = Omit<PressableProps, "style"> & {
  style?: StyleEntry | StyleEntry[];
  scaleTo?: number;
  children?: React.ReactNode;
  entering?: EntryOrExitLayoutType;
  exiting?: EntryOrExitLayoutType;
};

const SPRING_CONFIG = { damping: 15, stiffness: 300 };

/** Pressable with a spring scale-down on press, used as the base for Button/Chip/list rows. */
export function AnimatedPressable({
  style,
  scaleTo = 0.96,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <ReanimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, SPRING_CONFIG);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING_CONFIG);
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </ReanimatedPressable>
  );
}
