import { router, usePathname } from "expo-router";
import { useEffect } from "react";
import { useServerStatus } from "@/src/server/server-status";
import { logger } from "@/src/utils/logger";

const SERVER_DOWN_PATH = "/server-down";

export function ServerStatusGate() {
  const { serverAvailable } = useServerStatus();
  const pathname = usePathname();

  useEffect(() => {
    if (serverAvailable === false && pathname !== SERVER_DOWN_PATH) {
      logger.info("nav", "redirect → server-down", { from: pathname });
      router.replace(SERVER_DOWN_PATH);
      return;
    }
    if (serverAvailable === true && pathname === SERVER_DOWN_PATH) {
      logger.info("nav", "server recovered → home", { from: pathname });
      router.replace("/");
    }
  }, [serverAvailable, pathname]);

  return null;
}
