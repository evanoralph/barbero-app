import type { LucideIcon } from "lucide-react-native";
import type { ColorValue } from "react-native";
import { logger } from "@/src/utils/logger";

type TabIconProps = {
  icon: LucideIcon;
  color: ColorValue;
  size?: number;
  focused?: boolean;
  /** Dev-only label for debugging which tab icon rendered. */
  name?: string;
};

export function TabIcon({ icon: Icon, color, size = 22, focused, name }: TabIconProps) {
  if (__DEV__ && name && focused) {
    // Log only when a tab becomes focused to avoid render spam.
    logger.debug("TabIcon", "focused", { name });
  }

  const iconColor = typeof color === "string" ? color : String(color);

  return <Icon color={iconColor} size={size} strokeWidth={focused ? 2.4 : 2} />;
}
