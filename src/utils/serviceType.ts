export type ServiceType = "Haircut" | "Beard" | "Color" | "Other";

export const SERVICE_TYPES: ServiceType[] = ["Haircut", "Beard", "Color", "Other"];

/** Bucket a free-text service name into the few types the filter rails offer. */
export function serviceType(name: string): ServiceType {
  const n = name.toLowerCase();
  if (/(beard|shave|moustache|mustache)/.test(n)) return "Beard";
  if (/(color|colour|dye|bleach|highlight)/.test(n)) return "Color";
  if (/(cut|fade|trim|hair|taper|buzz)/.test(n)) return "Haircut";
  return "Other";
}
