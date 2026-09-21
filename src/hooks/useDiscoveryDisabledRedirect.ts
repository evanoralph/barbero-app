import { router } from "expo-router";
import { useEffect } from "react";
import { useProviderOnboardingHome } from "@/src/hooks/useProviderOnboardingHome";
import { logger } from "@/src/utils/logger";

/**
 * When admin "provider onboarding home" is on, customer discovery
 * (search / map / provider / book) is disabled — bounce to customer home.
 * Fail-open: until config loads, discovery stays available.
 */
export function useDiscoveryDisabledRedirect(source: string): boolean {
  const disabled = useProviderOnboardingHome();

  useEffect(() => {
    if (!disabled) return;
    logger.info(source, "providerOnboardingHome on — discovery disabled, redirecting home");
    console.log(`[${source}] providerOnboardingHome on — discovery disabled, redirect home`);
    router.replace("/(customer)");
  }, [disabled, source]);

  return disabled;
}
