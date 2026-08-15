import {
  DMMono_400Regular,
  DMMono_500Medium,
} from "@expo-google-fonts/dm-mono";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_700Bold,
} from "@expo-google-fonts/playfair-display";
import Constants from "expo-constants";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "@/src/auth/session";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync().catch((error) => {
  logger.warn("root", "SplashScreen.preventAutoHideAsync failed", error);
});

// Fade out the BERU gold-on-black opening screen once fonts are ready.
try {
  SplashScreen.setOptions({ duration: 800, fade: true });
  logger.info("root", "splash opening screen configured", {
    image: "splash-icon.png",
    backgroundColor: "#000000",
    fadeMs: 800,
  });
  logger.info("root", "app icon assets configured", {
    icon: "icon.png",
    androidForeground: "android-icon-foreground.png",
    androidBackground: "#000000",
    favicon: "favicon.png",
  });
} catch (error) {
  logger.warn("root", "SplashScreen.setOptions failed", error);
}

const navTheme = {
  ...(DefaultTheme ?? {}),
  colors: {
    ...(DefaultTheme?.colors ?? {}),
    background: colors.bg,
    card: colors.surface,
    primary: colors.accent,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  useEffect(() => {
    logger.info("root", "RootLayout mount", {
      platform: Platform.OS,
      executionEnvironment: Constants.executionEnvironment,
      appOwnership: Constants.appOwnership,
      isDevice: Constants.isDevice,
    });
  }, []);

  useEffect(() => {
    if (fontError) {
      logger.warn("root", "font load failed — falling back to system fonts", fontError);
      logger.debug("theme", "light gold palette active");
      SplashScreen.hideAsync().catch(() => undefined);
      return;
    }
    if (fontsLoaded) {
      logger.debug("root", "fonts loaded", {
        serif: "PlayfairDisplay",
        mono: "DMMono",
      });
      logger.debug("theme", "light gold palette active");
      logger.info("root", "hiding BERU splash opening screen");
      SplashScreen.hideAsync().catch((error) => {
        logger.warn("root", "SplashScreen.hideAsync failed", error);
      });
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
      <ThemeProvider value={navTheme}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(customer)" />
          <Stack.Screen name="(provider)" />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}
