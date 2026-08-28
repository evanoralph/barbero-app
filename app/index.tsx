import { Redirect } from "expo-router";
import { LoadingState } from "@/src/components/ui";
import { useSession } from "@/src/auth/session";
import { useServerStatus } from "@/src/server/server-status";
import { logger } from "@/src/utils/logger";

export default function Index() {
  const { ready, user, role } = useSession();
  const { serverAvailable, checking } = useServerStatus();

  if (!ready || checking) {
    console.log("[nav] boot loading", { brand: "Beru" });
    return <LoadingState label="Starting Beru…" />;
  }

  if (serverAvailable === false) {
    logger.info("nav", "server down at boot → server-down");
    return <Redirect href="/server-down" />;
  }

  if (!user) {
    logger.debug("nav", "no session → auth");
    return <Redirect href="/(auth)/login" />;
  }

  if (role === "provider") {
    logger.debug("nav", "provider → provider stack");
    return <Redirect href="/(provider)" />;
  }

  if (role === "customer") {
    logger.debug("nav", "customer → customer stack");
    return <Redirect href="/(customer)" />;
  }

  // Admin and unknown: mobile v1 unsupported — send to login with message via auth
  logger.warn("nav", "unsupported role for mobile v1", { role, roles: user.roles });
  return <Redirect href="/(auth)/login" />;
}
