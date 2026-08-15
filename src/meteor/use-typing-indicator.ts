import { useCallback, useEffect, useRef, useState } from "react";
import { connectMobileDdp, meteorCallSafe } from "@/src/meteor/ddp";
import { logger } from "@/src/utils/logger";

const TYPING_IDLE_MS = 2_500;

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
  const [peerTyping, setPeerTyping] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentTyping = useRef(false);
  const enabled = options?.enabled !== false && Boolean(threadId);

  useEffect(() => {
    sentTyping.current = false;
    setPeerTyping(false);
    if (!threadId || !enabled) return;

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
        logger.warn("ddp", "messages.typing subscribe failed", error);
      }
    })();

    return () => {
      stopped = true;
      changeListener?.stop();
      sub?.stop();
      setPeerTyping(false);
    };
  }, [threadId, enabled]);

  const clearLocalTyping = useCallback(() => {
    if (!threadId || !sentTyping.current) return;
    sentTyping.current = false;
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    logger.debug("ddp", "messages.setTyping false", { threadId });
    void meteorCallSafe("messages.setTyping", { threadId, isTyping: false });
  }, [threadId]);

  const reportLocalTyping = useCallback(
    (active: boolean) => {
      if (!threadId || !enabled) return;
      if (!active) {
        clearLocalTyping();
        return;
      }
      if (!sentTyping.current) {
        sentTyping.current = true;
        logger.debug("ddp", "messages.setTyping true", { threadId });
        void meteorCallSafe("messages.setTyping", { threadId, isTyping: true });
      }
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        clearLocalTyping();
      }, TYPING_IDLE_MS);
    },
    [clearLocalTyping, enabled, threadId],
  );

  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (threadId && sentTyping.current) {
        logger.debug("ddp", "messages.setTyping false on unmount", { threadId });
        void meteorCallSafe("messages.setTyping", { threadId, isTyping: false });
        sentTyping.current = false;
      }
    };
  }, [threadId]);

  return { peerTyping, reportLocalTyping, clearLocalTyping };
}
