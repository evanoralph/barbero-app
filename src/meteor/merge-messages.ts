import type { Message } from "@/src/types/api";

/** Overlay DDP docs onto REST/optimistic local messages without dropping in-flight tmp ids. */
export function mergeMessages(local: Message[], live: Message[]): Message[] {
  const byId = new Map<string, Message>();
  for (const message of local) {
    byId.set(message._id, message);
  }
  for (const message of live) {
    byId.set(message._id, message);
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
