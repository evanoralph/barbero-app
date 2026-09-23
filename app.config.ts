import type { ConfigContext, ExpoConfig } from "expo/config";
import fs from "fs";
import path from "path";

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
  const mapsKeysConfigured = Boolean(iosMapsKey && androidMapsKey);

  // Expo/Apple reject underscores in ios.bundleIdentifier (despite the error message).
  const iosBundleId = "com.beruapp.ai";
  const androidPackage = "com.beruapp.ai";

  // With eas.json cli.appVersionSource=remote + production.autoIncrement,
  // EAS owns ios.buildNumber / android.versionCode; local values are fallbacks only.
  // Dev/preview: allow HTTP API hosts (Android cleartext + iOS ATS). Production stays HTTPS-only.
  const allowCleartext = !production;

  const projectRoot = process.cwd();
  // Keep config files under service-account/ (gitignored); googleServicesFile paths must match.
  const androidGoogleServicesRel = "./service-account/google-services.json";
  const iosGoogleServicesRel = "./service-account/GoogleService-Info.plist";
  const androidGoogleServices = path.join(projectRoot, "service-account", "google-services.json");
  const iosGoogleServices = path.join(projectRoot, "service-account", "GoogleService-Info.plist");
  const hasAndroidFirebase = fs.existsSync(androidGoogleServices);
  const hasIosFirebase = fs.existsSync(iosGoogleServices);
  const firebaseReady = hasAndroidFirebase && hasIosFirebase;

  console.log("[app.config] building expo config", {
    profile,
    production,
    iosBundleId,
    androidPackage,
    mapsKeysConfigured,
    firebaseReady,
    hasAndroidFirebase,
    hasIosFirebase,
    androidGoogleServicesRel,
    iosGoogleServicesRel,
    node: process.version,
    cleartextAndroid: allowCleartext,
    cleartextIosAts: allowCleartext,
    versionSource: "eas-remote (autoIncrement on production)",
  });

  // Android Google Maps crashes at MapView mount if this meta-data key is missing.
  // Common cause: Node <20.12 / 21.x without util.parseEnv → @expo/env fails to load .env.
  if (!mapsKeysConfigured) {
    console.warn(
      "[app.config] Google Maps API keys missing from process.env. " +
        "Check .env (EXPO_PUBLIC_GOOGLE_MAPS_*_API_KEY) and use Node from .nvmrc " +
        `(need util.parseEnv; current ${process.version}). ` +
        "Then rebuild native: npx expo prebuild --platform android --clean && npm run android",
    );
  }

  if (!firebaseReady) {
    console.warn(
      "[app.config] Firebase FCM not fully configured. Add google-services.json (Android) and " +
        "GoogleService-Info.plist (iOS) under service-account/ from Firebase Console " +
        `(package/bundle ${androidPackage}). Then rebuild native.`,
    );
  }

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
        // RNFB v26 defaults to SPM, which cannot combine with static frameworks.
        // Opt out of SPM (via @react-native-firebase/app plugin) and keep static
        // linkage for Expo precompiled modules (RN 0.84+ / Expo 54+).
        ios: firebaseReady
          ? {
              useFrameworks: "static",
              forceStaticLinking: ["RNFBApp", "RNFBMessaging"],
            }
          : {},
      },
    ],
    // Xcode 27 / iOS 27 requires UIScene; Expo SDK 57.0.x template still uses AppDelegate window.
    // Remove once Expo prebuild ships SceneDelegate by default.
    "./plugins/withIosSceneLifecycle",
  ];

  if (firebaseReady) {
    // disableSPM: true → $RNFirebaseDisableSPM in Podfile (required with useFrameworks: static).
    plugins.push(
      [
        "@react-native-firebase/app",
        {
          ios: {
            disableSPM: true,
          },
        },
      ],
      "@react-native-firebase/messaging",
    );
    console.log(
      "[app.config] React Native Firebase plugins enabled (FCM, disableSPM + static frameworks)",
    );
  }

  console.log("[app.config] UIScene lifecycle plugin enabled (Xcode 27 backport)");

  // Always include expo-notifications for foreground display + permission UX.
  plugins.push([
    "expo-notifications",
    {
      icon: "./assets/images/icon.png",
      color: "#000000",
      defaultChannel: "default",
    },
  ]);

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
      ...(hasIosFirebase ? { googleServicesFile: iosGoogleServicesRel } : {}),
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "Beru uses your location to show nearby artists on the map.",
        // Standard HTTPS-only networking — skips App Store Connect encryption prompt.
        ITSAppUsesNonExemptEncryption: false,
        // Background remote notifications for FCM/APNs.
        UIBackgroundModes: ["remote-notification"],
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
      ...(hasAndroidFirebase ? { googleServicesFile: androidGoogleServicesRel } : {}),
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
      firebaseMessagingEnabled: firebaseReady,
      router: {},
      eas: {
        projectId: "65e454c9-b1f2-4def-9413-5fd16d3a6591",
      },
    },
    owner: "evanoralph",
  };
};
