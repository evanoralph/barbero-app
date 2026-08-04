import type { ProviderProfile } from "@/src/types/api";

export type CompletenessCheck = {
  id: string;
  label: string;
  weight: number;
  done: boolean;
};

/** Weighted profile completeness (matches web dashboard scoring). */
export function getProfileCompleteness(profile: ProviderProfile): {
  percent: number;
  checks: CompletenessCheck[];
  missing: CompletenessCheck[];
} {
  const checks: CompletenessCheck[] = [
    { id: "bio", label: "Bio", weight: 20, done: Boolean(profile.bio?.trim()) },
    { id: "avatar", label: "Avatar", weight: 15, done: Boolean(profile.avatar?.trim()) },
    {
      id: "cover",
      label: "Cover image",
      weight: 15,
      done: Boolean(profile.coverImage?.trim()),
    },
    {
      id: "city",
      label: "City",
      weight: 15,
      done: Boolean(profile.location?.city?.trim()),
    },
    {
      id: "services",
      label: "Services",
      weight: 20,
      done: (profile.services?.length ?? 0) > 0,
    },
    {
      id: "portfolio",
      label: "Portfolio",
      weight: 15,
      done: (profile.portfolio?.length ?? 0) > 0,
    },
  ];
  const percent = checks.reduce((sum, c) => sum + (c.done ? c.weight : 0), 0);
  return {
    percent,
    checks,
    missing: checks.filter((c) => !c.done),
  };
}
