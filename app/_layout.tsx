import {
  DMMono_400Regular,
  DMMono_500Medium,
} from "@expo-google-fonts/dm-mono";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_700Bold,
} from "@expo-google-fonts/playfair-display";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "@/src/auth/session";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync().catch((error) => {
  logger.warn("root", "SplashScreen.preventAutoHideAsync failed", error);
});

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
    logger.info("root", "RootLayout mount");
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
