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
  // Local copies live under service-account/ (gitignored). EAS Build must use
  // file env vars (GOOGLE_SERVICES_JSON / GOOGLE_SERVICES_PLIST) because those
  // files are not uploaded from git.
  const androidGoogleServicesRel = "./service-account/google-services.json";
  const iosGoogleServicesRel = "./service-account/GoogleService-Info.plist";
  const androidGoogleServicesLocal = path.join(
    projectRoot,
    "service-account",
    "google-services.json",
  );
  const iosGoogleServicesLocal = path.join(
    projectRoot,
    "service-account",
    "GoogleService-Info.plist",
  );

  const androidGoogleServicesFromEnv = process.env.GOOGLE_SERVICES_JSON?.trim() ?? "";
  const iosGoogleServicesFromEnv = process.env.GOOGLE_SERVICES_PLIST?.trim() ?? "";
  const hasAndroidFirebaseLocal = fs.existsSync(androidGoogleServicesLocal);
  const hasIosFirebaseLocal = fs.existsSync(iosGoogleServicesLocal);
  const hasAndroidFirebaseEnv =
    Boolean(androidGoogleServicesFromEnv) && fs.existsSync(androidGoogleServicesFromEnv);
  const hasIosFirebaseEnv =
    Boolean(iosGoogleServicesFromEnv) && fs.existsSync(iosGoogleServicesFromEnv);

  // Prefer EAS file-env paths (absolute) when present; otherwise local relative paths.
  const androidGoogleServicesFile = hasAndroidFirebaseEnv
    ? androidGoogleServicesFromEnv
    : hasAndroidFirebaseLocal
      ? androidGoogleServicesRel
      : undefined;
  const iosGoogleServicesFile = hasIosFirebaseEnv
    ? iosGoogleServicesFromEnv
    : hasIosFirebaseLocal
      ? iosGoogleServicesRel
      : undefined;

  const hasAndroidFirebase = Boolean(androidGoogleServicesFile);
  const hasIosFirebase = Boolean(iosGoogleServicesFile);
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
    androidGoogleServicesSource: hasAndroidFirebaseEnv
      ? "env:GOOGLE_SERVICES_JSON"
      : hasAndroidFirebaseLocal
        ? "local:service-account"
        : "missing",
    iosGoogleServicesSource: hasIosFirebaseEnv
      ? "env:GOOGLE_SERVICES_PLIST"
      : hasIosFirebaseLocal
        ? "local:service-account"
        : "missing",
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
      "[app.config] Firebase FCM credentials missing. Locally: put google-services.json + " +
        "GoogleService-Info.plist under service-account/. For EAS Build: create file env vars " +
        "GOOGLE_SERVICES_JSON and GOOGLE_SERVICES_PLIST (secret) — gitignored files are not uploaded. " +
        `(package/bundle ${androidPackage}).`,
    );
  }

  // RNFB is always a dependency. Always use CocoaPods + static frameworks so EAS
  // prebuild never hits "SPM + static linkage is not supported" when credentials
  // are missing from the upload (gitignored service-account/).
  console.log(
    "[app.config] iOS RNFB: always disableSPM + useFrameworks static (Expo precompiled modules)",
  );

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
        ios: {
          useFrameworks: "static",
          forceStaticLinking: ["RNFBApp", "RNFBMessaging"],
        },
      },
    ],
    // Survives missing GoogleService files on EAS (unlike gating @react-native-firebase/app).
    "./plugins/withRnfirebaseDisableSpm",
    // Xcode 27 / iOS 27 requires UIScene; Expo SDK 57.0.x template still uses AppDelegate window.
    // Remove once Expo prebuild ships SceneDelegate by default.
    "./plugins/withIosSceneLifecycle",
  ];

  if (firebaseReady) {
    // Also set disableSPM on the official plugin (belt + suspenders with our local plugin).
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
      "[app.config] React Native Firebase plugins enabled (FCM + googleServicesFile present)",
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

  // Must run AFTER expo-notifications + RNFB messaging: both declare the same
  // FCM default_notification_* meta-data and Android Manifest merger fails
  // without tools:replace (processDebugMainManifest).
  plugins.push("./plugins/withAndroidFirebaseMessagingManifestFix");
  console.log(
    "[app.config] Android FCM notification Manifest merger fix plugin enabled",
  );

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
      ...(iosGoogleServicesFile ? { googleServicesFile: iosGoogleServicesFile } : {}),
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
      ...(androidGoogleServicesFile ? { googleServicesFile: androidGoogleServicesFile } : {}),
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
