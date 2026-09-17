import type { ReactNode } from "react";
import {
  Pressable,
  type AccessibilityRole,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type TabBarButtonProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: ((e: GestureResponderEvent) => void) | null;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/** Tab bar button wrapper that adds a stable Maestro testID without ref typing issues. */
export function e2eTabBarButton(testID: string) {
  function E2eTabBarButton(props: TabBarButtonProps) {
    return (
      <Pressable
        accessibilityState={props.accessibilityState}
        accessibilityLabel={props.accessibilityLabel}
        accessibilityRole={props.accessibilityRole}
        accessibilityHint={props.accessibilityHint}
        onPress={props.onPress}
        onLongPress={props.onLongPress ?? undefined}
        style={props.style}
        testID={testID}
      >
        {props.children}
      </Pressable>
    );
  }

  // Expo Router tabBarButton expects React Navigation's BottomTabBarButtonProps (incl. ref).
  // We only forward the press/a11y props Maestro needs; cast keeps layouts type-clean.
  return E2eTabBarButton as (props: TabBarButtonProps) => ReactNode;
}
