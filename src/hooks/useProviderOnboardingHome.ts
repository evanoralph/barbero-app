import { useEffect, useState } from "react";
import { fetchPublicAppConfig } from "@/src/api/public-config";
import { logger } from "@/src/utils/logger";

/**
 * Admin "provider onboarding home" toggle.
 * Defaults to false (show plans) until config loads — fail open.
 */
export function useProviderOnboardingHome(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const config = await fetchPublicAppConfig();
        if (cancelled) return;
        const on = config?.providerOnboardingHome === true;
        setEnabled(on);
        logger.info("plans", "providerOnboardingHome resolved", { hidePlans: on });
        console.log("[plans] providerOnboardingHome resolved", { hidePlans: on });
      } catch (err) {
        if (cancelled) return;
        logger.warn("plans", "public config failed; keeping plans links", err);
        console.log("[plans] public config failed; keeping plans links", err);
        setEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}
