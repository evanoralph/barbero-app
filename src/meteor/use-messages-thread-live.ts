import { useEffect, useState } from "react";
import { connectMobileDdp } from "@/src/meteor/ddp";
import { logger } from "@/src/utils/logger";
import type { Message } from "@/src/types/api";

type DdpMessageDoc = {
  id?: string;
  threadId?: string;
  senderId?: string;
  body?: string;
  createdAt?: string;
};

function mapDoc(doc: DdpMessageDoc): Message | null {
  if (!doc.id || !doc.threadId || !doc.senderId || !doc.body || !doc.createdAt) {
    return null;
  }
  return {
    _id: doc.id,
    threadId: doc.threadId,
    senderId: doc.senderId,
    body: doc.body,
    createdAt: doc.createdAt,
  };
}

export function useMessagesThreadLive(
  threadId: string | undefined,
  options?: { enabled?: boolean },
) {
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const [liveReady, setLiveReady] = useState(false);
  const enabled = options?.enabled !== false && Boolean(threadId);

  useEffect(() => {
    if (!threadId || !enabled) {
      setLiveMessages([]);
      setLiveReady(false);
      return;
    }

    let stopped = false;
    let sub: { stop: () => void; ready: () => Promise<void> } | null = null;
    let changeListener: { stop: () => void } | null = null;

    const applyFromCollection = (
      ddp: Awaited<ReturnType<typeof connectMobileDdp>>,
    ) => {
      const docs = ddp
        .collection("messages")
        .filter((doc) => (doc as DdpMessageDoc).threadId === threadId)
        .fetch() as DdpMessageDoc[];
      const mapped = docs
        .map(mapDoc)
        .filter((message): message is Message => message !== null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      logger.debug("ddp", "messages.thread update", {
        threadId,
        count: mapped.length,
      });
      setLiveMessages(mapped);
    };

    void (async () => {
      try {
        const ddp = await connectMobileDdp();
        if (stopped) return;
        logger.info("ddp", "messages.thread subscribe", { threadId });
        sub = ddp.subscribe("messages.thread", threadId);
        await sub.ready();
        if (stopped) return;
        applyFromCollection(ddp);
        setLiveReady(true);
        changeListener = ddp
          .collection("messages")
          .filter((doc) => (doc as DdpMessageDoc).threadId === threadId)
          .onChange(() => {
            if (!stopped) applyFromCollection(ddp);
          });
      } catch (error) {
        logger.warn("ddp", "messages.thread subscribe failed", error);
        setLiveReady(false);
      }
    })();

    return () => {
      stopped = true;
      changeListener?.stop();
      sub?.stop();
      setLiveReady(false);
    };
  }, [threadId, enabled]);

  return { liveMessages, liveReady };
}
