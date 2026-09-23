import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/src/auth/session";
import { connectMobileDdp, meteorCallSafe } from "@/src/meteor/ddp";
import { logger } from "@/src/utils/logger";

const TYPING_IDLE_MS = 2_500;
/** Refresh server `updatedAt` before TYPING_TTL_MS (5s) sweeps the doc. */
const TYPING_HEARTBEAT_MS = 2_000;

type DdpTypingDoc = {
  id?: string;
  threadId?: string;
  userId?: string;
  updatedAt?: string;
};

export function useTypingIndicator(
  threadId: string | undefined,
  options?: { enabled?: boolean },
) {
  const { ddpAuthed } = useSession();
  const [peerTyping, setPeerTyping] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sentTyping = useRef(false);
  const pendingTyping = useRef(false);
  /** Bumped on clear so in-flight setTyping(true) does not re-arm after cancel. */
  const typingGeneration = useRef(0);
  const enabled = options?.enabled !== false && Boolean(threadId);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(
    (activeThreadId: string) => {
      stopHeartbeat();
      heartbeatTimer.current = setInterval(() => {
        if (!sentTyping.current) {
          stopHeartbeat();
          return;
        }
        console.log("[typing] heartbeat", { threadId: activeThreadId });
        logger.debug("ddp", "messages.setTyping heartbeat", { threadId: activeThreadId });
        void meteorCallSafe("messages.setTyping", {
          threadId: activeThreadId,
          isTyping: true,
        });
      }, TYPING_HEARTBEAT_MS);
    },
    [stopHeartbeat],
  );

  useEffect(() => {
    sentTyping.current = false;
    pendingTyping.current = false;
    typingGeneration.current += 1;
    stopHeartbeat();
    setPeerTyping(false);
    if (!threadId || !enabled) return;
    if (!ddpAuthed) {
      console.log("[typing] subscribe skipped — waiting for ddpAuthed", { threadId });
      logger.info("ddp", "messages.typing skipped; waiting for ddpAuthed", { threadId });
      return;
    }

    let stopped = false;
    let sub: { stop: () => void; ready: () => Promise<void> } | null = null;
    let changeListener: { stop: () => void } | null = null;

    const applyFromCollection = (
      ddp: Awaited<ReturnType<typeof connectMobileDdp>>,
    ) => {
      const docs = ddp
        .collection("typing_indicators")
        .filter((doc) => (doc as DdpTypingDoc).threadId === threadId)
        .fetch() as DdpTypingDoc[];
      const next = docs.length > 0;
      console.log("[typing] peer update", {
        threadId,
        peerTyping: next,
        count: docs.length,
      });
      logger.debug("ddp", "messages.typing update", {
        threadId,
        peerTyping: next,
        count: docs.length,
      });
      setPeerTyping(next);
    };

    void (async () => {
      try {
        const ddp = await connectMobileDdp();
        if (stopped) return;
        console.log("[typing] subscribe", { threadId, ddpAuthed: true });
        logger.info("ddp", "messages.typing subscribe", { threadId });
        sub = ddp.subscribe("messages.typing", threadId);
        await sub.ready();
        if (stopped) return;
        applyFromCollection(ddp);
        changeListener = ddp
          .collection("typing_indicators")
          .filter((doc) => (doc as DdpTypingDoc).threadId === threadId)
          .onChange(() => {
            if (!stopped) applyFromCollection(ddp);
          });
      } catch (error) {
        console.warn("[typing] subscribe failed", error);
        logger.warn("ddp", "messages.typing subscribe failed", error);
      }
    })();

    return () => {
      stopped = true;
      changeListener?.stop();
      sub?.stop();
      setPeerTyping(false);
    };
  }, [threadId, enabled, ddpAuthed, stopHeartbeat]);

  const clearLocalTyping = useCallback(() => {
    if (!threadId || (!sentTyping.current && !pendingTyping.current)) return;
    const wasSent = sentTyping.current;
    sentTyping.current = false;
    pendingTyping.current = false;
    typingGeneration.current += 1;
    stopHeartbeat();
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    // Only notify server if we had a successful setTyping(true).
    if (!wasSent) {
      console.log("[typing] clear while pending — skip server false", { threadId });
      logger.debug("ddp", "messages.setTyping clear while pending", { threadId });
      return;
    }
    console.log("[typing] setTyping false", { threadId });
    logger.debug("ddp", "messages.setTyping false", { threadId });
    void meteorCallSafe("messages.setTyping", { threadId, isTyping: false });
  }, [stopHeartbeat, threadId]);

  const reportLocalTyping = useCallback(
    (active: boolean) => {
      if (!threadId || !enabled) return;
      if (!ddpAuthed) {
        console.log("[typing] report skipped — ddp not authed", { threadId });
        logger.debug("ddp", "messages.setTyping skipped; ddp not authed", { threadId });
        return;
      }
      if (!active) {
        clearLocalTyping();
        return;
      }
      if (!sentTyping.current && !pendingTyping.current) {
        // Don't lock sentTyping until the call succeeds so keystrokes can retry.
        pendingTyping.current = true;
        const gen = typingGeneration.current;
        void (async () => {
          console.log("[typing] setTyping true", { threadId });
          logger.debug("ddp", "messages.setTyping true", { threadId });
          const result = await meteorCallSafe("messages.setTyping", {
            threadId,
            isTyping: true,
          });
          if (gen !== typingGeneration.current) {
            console.log("[typing] setTyping true ignored — cleared meanwhile", { threadId });
            logger.debug("ddp", "messages.setTyping true ignored; cleared", { threadId });
            if (result.ok) {
              void meteorCallSafe("messages.setTyping", { threadId, isTyping: false });
            }
            return;
          }
          pendingTyping.current = false;
          if (result.ok) {
            sentTyping.current = true;
            startHeartbeat(threadId);
          } else {
            console.warn("[typing] setTyping true failed — will retry on next keystroke", {
              threadId,
              error: result.error,
            });
            logger.warn("ddp", "messages.setTyping true failed", {
              threadId,
              error: result.error,
            });
          }
        })();
      }
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        clearLocalTyping();
      }, TYPING_IDLE_MS);
    },
    [clearLocalTyping, ddpAuthed, enabled, startHeartbeat, threadId],
  );

  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      stopHeartbeat();
      if (threadId && sentTyping.current) {
        console.log("[typing] setTyping false on unmount", { threadId });
        logger.debug("ddp", "messages.setTyping false on unmount", { threadId });
        void meteorCallSafe("messages.setTyping", { threadId, isTyping: false });
        sentTyping.current = false;
      }
    };
  }, [stopHeartbeat, threadId]);

  return { peerTyping, reportLocalTyping, clearLocalTyping };
}
