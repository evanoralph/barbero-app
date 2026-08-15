import { useEffect, useRef } from "react";
import { connectMobileDdp } from "@/src/meteor/ddp";
import type { ConversationLivePatch } from "@/src/meteor/apply-conversation-patches";
import { logger } from "@/src/utils/logger";

type DdpConversationDoc = {
  id?: string;
  bookingId?: string;
  lastMessageBody?: string;
  lastMessageAt?: string;
  lastReadAtBy?: Record<string, string>;
};

function mapDoc(doc: DdpConversationDoc): ConversationLivePatch | null {
  if (!doc.id || typeof doc.lastMessageBody !== "string" || !doc.lastMessageAt) {
    return null;
  }
  return {
    threadId: doc.id,
    bookingId: doc.bookingId,
    lastMessageBody: doc.lastMessageBody,
    lastMessageAt: doc.lastMessageAt,
    lastReadAtBy: doc.lastReadAtBy,
  };
}

export function useConversationsLive(
  onPatch: (rows: ConversationLivePatch[]) => void,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled !== false;
  const onPatchRef = useRef(onPatch);
  onPatchRef.current = onPatch;

  useEffect(() => {
    if (!enabled) return;

    let stopped = false;
    let sub: { stop: () => void; ready: () => Promise<void> } | null = null;
    let changeListener: { stop: () => void } | null = null;

    const applyFromCollection = (
      ddp: Awaited<ReturnType<typeof connectMobileDdp>>,
    ) => {
      const docs = ddp
        .collection("conversations")
        .filter(() => true)
        .fetch() as DdpConversationDoc[];
      const mapped = docs
        .map(mapDoc)
        .filter((row): row is ConversationLivePatch => row !== null);
      logger.debug("ddp", "conversations.mine update", { count: mapped.length });
      onPatchRef.current(mapped);
    };

    void (async () => {
      try {
        const ddp = await connectMobileDdp();
        if (stopped) return;
        logger.info("ddp", "conversations.mine subscribe");
        sub = ddp.subscribe("conversations.mine");
        await sub.ready();
        if (stopped) return;
        applyFromCollection(ddp);
        changeListener = ddp
          .collection("conversations")
          .filter(() => true)
          .onChange(() => {
            if (!stopped) applyFromCollection(ddp);
          });
      } catch (error) {
        logger.warn("ddp", "conversations.mine subscribe failed", error);
      }
    })();

    return () => {
      stopped = true;
      changeListener?.stop();
      sub?.stop();
    };
  }, [enabled]);
}
