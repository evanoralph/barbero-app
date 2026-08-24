import { useEffect } from "react";
import { Image, type ImageStyle, type StyleProp, StyleSheet } from "react-native";

const LOGO_SRC = {
  /** Gold mark on light background — default for light UI chrome */
  light: require("../../assets/logo/beru-logo-white-bg.png"),
  /** Gold mark on black — dark sections / premium */
  gold: require("../../assets/logo/beru-logo-gold.png"),
  /** White mark on black — dark sections */
  white: require("../../assets/logo/beru-logo-white.png"),
  /** Subtle dark mark on black */
  dark: require("../../assets/logo/beru-logo.png"),
} as const;

export type BrandLogoVariant = keyof typeof LOGO_SRC;

/** Wordmark is ~1.5:1 — sizes keep readable chrome without crushing the mark. */
const SIZE = {
  sm: { height: 28, width: 56 },
  md: { height: 36, width: 72 },
  lg: { height: 48, width: 96 },
  xl: { height: 64, width: 128 },
  hero: { height: 46, width: 100 },
} as const;

export type BrandLogoSize = keyof typeof SIZE;

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  size?: BrandLogoSize;
  style?: StyleProp<ImageStyle>;
};

export function BrandLogo({
  variant = "light",
  size = "md",
  style,
}: BrandLogoProps) {
  const source = LOGO_SRC[variant];
  const dims = SIZE[size];

  useEffect(() => {
    console.log("[brand-logo] render", {
      variant,
      size,
      height: dims.height,
      width: dims.width,
    });
  }, [variant, size, dims.height, dims.width]);

  return (
    <Image
      source={source}
      accessibilityLabel="Beru"
      resizeMode="contain"
      style={[styles.base, { height: dims.height, width: dims.width }, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    // Intrinsic aspect is ~1.5:1; width/height set per size.
  },
});
