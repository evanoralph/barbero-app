import { logger } from "@/src/utils/logger";
import { connectMobileDdp, logoutMobileDdpSafe } from "@/src/meteor/ddp";

type DdpWithLogin = Awaited<ReturnType<typeof connectMobileDdp>> & {
  userId?: string;
  _loggedIn?: boolean;
};

export async function resumeMobileDdp(resumeToken: string): Promise<boolean> {
  try {
    const ddp = (await connectMobileDdp()) as DdpWithLogin;
    if (ddp._loggedIn && ddp.userId) {
      logger.info("ddp", "already logged in", { userId: ddp.userId });
      return true;
    }
    await ddp.login({ resume: resumeToken });
    logger.info("ddp", "resume ok", { userId: ddp.userId });
    return true;
  } catch (error) {
    logger.warn("ddp", "resume failed — chat stays on REST", error);
    return false;
  }
}

export async function signOutMobileDdp(): Promise<void> {
  await logoutMobileDdpSafe();
}
