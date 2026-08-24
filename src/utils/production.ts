import Constants from "expo-constants";

type BuildProfile = "development" | "preview" | "production" | string;

export function getBuildProfile(): BuildProfile {
  const extra = Constants.expoConfig?.extra as { buildProfile?: string } | undefined;
  return (
    extra?.buildProfile ??
    process.env.EAS_BUILD_PROFILE ??
    process.env.APP_VARIANT ??
    (__DEV__ ? "development" : "production")
  );
}

export function isProductionBuild(): boolean {
  return getBuildProfile() === "production";
}

/** Throws in production builds when API URL is missing or insecure. */
export function assertProductionApiUrl(raw: string): void {
  if (!isProductionBuild()) return;

  if (!raw || raw.includes("localhost") || raw.includes("127.0.0.1")) {
    throw new Error(
      "Production build requires EXPO_PUBLIC_API_URL set to an HTTPS API (no localhost).",
    );
  }

  if (!raw.startsWith("https://")) {
    throw new Error("Production build requires EXPO_PUBLIC_API_URL to use https://");
  }
}
