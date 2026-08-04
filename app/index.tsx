import { Redirect } from "expo-router";
import { LoadingState } from "@/src/components/ui";
import { useSession } from "@/src/auth/session";
import { logger } from "@/src/utils/logger";

export default function Index() {
  const { ready, user, role } = useSession();

  if (!ready) return <LoadingState label="Starting Barbero…" />;

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
