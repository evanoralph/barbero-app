import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { setThreadViewing } from "@/src/api/conversations";
import { logger } from "@/src/utils/logger";
import { getActiveChatThreadId, setActiveChatThreadId } from "@/src/utils/push";

/** Keep server presence fresh while the screen stays focused + app is active. */
const VIEWING_HEARTBEAT_MS = 20_000;

/**
 * While this screen is focused:
 * 1) Suppress foreground push banners for this thread (client).
 * 2) Tell the API so chat push is not sent at all (server — reliable for FCM).
 *
 * Also clears viewing when the app backgrounds / is killed from a chat screen.
 * Force-quit does not run focus cleanup; without this the API keeps "viewing"
 * for ~45s and chat pushes are skipped while the app is closed.
 */
export function useSuppressChatPushWhileFocused(threadId: string | null | undefined): void {
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      const id = threadId?.trim() || null;
      if (!id) {
        logger.debug("push", "skip suppress hook — no threadId");
        return;
      }

      console.log("[push] suppress chat banners while focused", { threadId: id });
      logger.info("push", "suppress chat banners while focused", { threadId: id });
      setActiveChatThreadId(id);

      const reportViewing = (next: string | null, reason: string) => {
        void setThreadViewing(next)
          .then(() => {
            logger.info("push", "viewing reported to API", { threadId: next, reason });
          })
          .catch((error) => {
            // Don't break chat UX if presence update fails — local suppress still helps.
            logger.warn("push", "viewing report failed — local suppress only", {
              threadId: next,
              reason,
              error,
            });
          });
      };

      const stopHeartbeat = () => {
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
      };

      const startHeartbeat = () => {
        stopHeartbeat();
        heartbeatRef.current = setInterval(() => {
          reportViewing(id, "heartbeat");
        }, VIEWING_HEARTBEAT_MS);
      };

      const claimViewing = (reason: string) => {
        setActiveChatThreadId(id);
        reportViewing(id, reason);
        startHeartbeat();
      };

      const clearViewing = (reason: string) => {
        stopHeartbeat();
        if (getActiveChatThreadId() === id) {
          setActiveChatThreadId(null);
        }
        reportViewing(null, reason);
      };

      claimViewing("focus");

      const onAppStateChange = (next: AppStateStatus) => {
        if (next === "background") {
          // App closed / home / switcher — allow push immediately (incl. force-quit path).
          console.log("[push] app backgrounded — clear viewing for closed-app push", {
            threadId: id,
          });
          logger.info("push", "app backgrounded — clear viewing for closed-app push", {
            threadId: id,
          });
          clearViewing("app-background");
          return;
        }
        if (next === "active") {
          // Returned to this still-focused chat screen.
          console.log("[push] app active — reclaim viewing", { threadId: id });
          logger.info("push", "app active — reclaim viewing", { threadId: id });
          claimViewing("app-active");
        }
      };

      const appStateSub = AppState.addEventListener("change", onAppStateChange);

      return () => {
        appStateSub.remove();
        stopHeartbeat();

        // Only clear if we still own the active id (another screen may have
        // already claimed a different thread during a quick navigate).
        if (getActiveChatThreadId() === id) {
          console.log("[push] clear suppress — leaving thread", { threadId: id });
          logger.info("push", "clear suppress — leaving thread", { threadId: id });
          setActiveChatThreadId(null);
          reportViewing(null, "blur");
        } else {
          logger.debug("push", "skip clear suppress — active thread already changed", {
            left: id,
            active: getActiveChatThreadId(),
          });
        }
      };
    }, [threadId]),
  );
}
