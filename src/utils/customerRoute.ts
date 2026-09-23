import {
  hasDiscoveryLocation,
} from "@/src/utils/discoveryLocation";
import { logger } from "@/src/utils/logger";

/**
 * After customer auth: send to location gate until discovery location is saved.
 */
export async function resolveCustomerEntryHref(): Promise<
  "/(auth)/location-permission" | "/(customer)"
> {
  const has = await hasDiscoveryLocation();
  const href = has ? "/(customer)" : "/(auth)/location-permission";
  logger.debug("customerRoute", "resolveCustomerEntryHref", { has, href });
  console.log("[customerRoute] resolve", has ? "home" : "location-permission");
  return href;
}
