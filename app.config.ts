import type { ConfigContext, ExpoConfig } from "expo/config";

type BuildProfile = "development" | "preview" | "production" | string;

function resolveBuildProfile(): BuildProfile {
  return process.env.EAS_BUILD_PROFILE ?? process.env.APP_VARIANT ?? "development";
}

function isProductionBuild(profile: BuildProfile): boolean {
  return profile === "production";
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = resolveBuildProfile();
  const production = isProductionBuild(profile);
  const iosMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY?.trim() ?? "";
  const androidMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY?.trim() ?? "";

  // Expo/Apple reject underscores in ios.bundleIdentifier (despite the error message).
  const iosBundleId = "com.beruapp.ai";
  const androidPackage = "com.beruapp.ai";

  // With eas.json cli.appVersionSource=remote + production.autoIncrement,
  // EAS owns ios.buildNumber / android.versionCode; local values are fallbacks only.
  // Dev/preview: allow HTTP API hosts (Android cleartext + iOS ATS). Production stays HTTPS-only.
  const allowCleartext = !production;

  console.log("[app.config] building expo config", {
    profile,
    production,
    iosBundleId,
    androidPackage,
    mapsKeysConfigured: Boolean(iosMapsKey && androidMapsKey),
    cleartextAndroid: allowCleartext,
    cleartextIosAts: allowCleartext,
    versionSource: "eas-remote (autoIncrement on production)",
  });

  const plugins: ExpoConfig["plugins"] = [
    ...(production ? [] : (["expo-dev-client"] as const)),
    "expo-router",
    "expo-secure-store",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Beru uses your location to show nearby artists on the map.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Beru needs photo library access so you can upload profile and portfolio images.",
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#000000",
        imageWidth: 240,
      },
    ],
    [
      "react-native-maps",
      {
        iosGoogleMapsApiKey: iosMapsKey,
        androidGoogleMapsApiKey: androidMapsKey,
      },
    ],
    "@react-native-community/datetimepicker",
    [
      "expo-build-properties",
      {
        android: {
          usesCleartextTraffic: allowCleartext,
        },
      },
    ],
    // Xcode 27 / iOS 27 requires UIScene; Expo SDK 57.0.x template still uses AppDelegate window.
    // Remove once Expo prebuild ships SceneDelegate by default.
    "./plugins/withIosSceneLifecycle",
  ];

  console.log("[app.config] UIScene lifecycle plugin enabled (Xcode 27 backport)");

  if (production) {
    plugins.push([
      "expo-notifications",
      {
        icon: "./assets/images/icon.png",
        color: "#000000",
      },
    ]);
  }

  return {
    ...config,
    name: "Beru",
    slug: "barbero-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "barbero",
    userInterfaceStyle: "light",
    ios: {
      supportsTablet: true,
      bundleIdentifier: iosBundleId,
      buildNumber: "1",
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "Beru uses your location to show nearby artists on the map.",
        // Standard HTTPS-only networking — skips App Store Connect encryption prompt.
        ITSAppUsesNonExemptEncryption: false,
        // iOS ATS blocks cleartext HTTP by default (Android usesCleartextTraffic above).
        // Only for non-production so local / remote IP HTTP APIs work in dev clients.
        // IMPORTANT: do NOT set NSAllowsLocalNetworking here — on iOS 10+ that key
        // makes NSAllowsArbitraryLoads ignored, so only LAN hosts work and public
        // HTTP IPs (e.g. VPS) still fail with ATS.
        ...(allowCleartext
          ? {
              NSAppTransportSecurity: {
                NSAllowsArbitraryLoads: true,
              },
            }
          : {}),
      },
    },
    android: {
      icon: "./assets/images/icon.png",
      adaptiveIcon: {
        backgroundColor: "#000000",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      package: androidPackage,
      predictiveBackGestureEnabled: false,
      softwareKeyboardLayoutMode: "pan",
      versionCode: 2,
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins,
    experiments: {
      typedRoutes: true,
    },
    extra: {
      ...config.extra,
      buildProfile: profile,
      router: {},
      eas: {
        projectId: "65e454c9-b1f2-4def-9413-5fd16d3a6591",
      },
    },
    owner: "evanoralph",
  };
};
