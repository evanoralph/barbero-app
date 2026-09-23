import type { Message } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

/** Overlay DDP docs onto REST/optimistic local messages without dropping in-flight tmp ids. */
export function mergeMessages(local: Message[], live: Message[]): Message[] {
  const byId = new Map<string, Message>();
  let preservedImageUrl = 0;
  const ingest = (message: Message) => {
    const existing = byId.get(message._id);
    if (existing) {
      // Prefer the richer doc: never let a partial live payload wipe imageUrl.
      const imageUrl = message.imageUrl ?? existing.imageUrl;
      if (imageUrl && !message.imageUrl && existing.imageUrl) {
        preservedImageUrl += 1;
      }
      byId.set(message._id, {
        ...existing,
        ...message,
        ...(imageUrl ? { imageUrl } : {}),
      });
      return;
    }
    byId.set(message._id, message);
  };
  for (const message of local) ingest(message);
  for (const message of live) ingest(message);
  if (preservedImageUrl > 0) {
    logger.debug("messages", "merge preserved imageUrl", {
      count: preservedImageUrl,
    });
  }

  const merged = [...byId.values()].filter((message) => {
    if (!message._id.startsWith("tmp-")) return true;
    return !live.some(
      (liveMessage) =>
        liveMessage.senderId === message.senderId &&
        liveMessage.body === message.body &&
        liveMessage.threadId === message.threadId,
    );
  });

  merged.sort((a, b) => {
    const byTime = a.createdAt.localeCompare(b.createdAt);
    return byTime !== 0 ? byTime : a._id.localeCompare(b._id);
  });
  return merged;
}
