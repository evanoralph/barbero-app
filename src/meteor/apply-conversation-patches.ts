import type { ConversationListItem } from "@/src/types/api";

export type ConversationLivePatch = {
  threadId: string;
  bookingId?: string;
  lastMessageBody: string;
  lastMessageAt: string;
  lastReadAtBy?: Record<string, string>;
};

export function applyConversationPatches(
  prev: ConversationListItem[],
  rows: ConversationLivePatch[],
): ConversationListItem[] {
  const byId = new Map(prev.map((c) => [c.threadId, c]));
  for (const row of rows) {
    const existing = byId.get(row.threadId);
    if (existing) {
      const peerLastReadAt =
        row.lastReadAtBy && existing.participantUserId
          ? row.lastReadAtBy[existing.participantUserId] ?? existing.peerLastReadAt
          : existing.peerLastReadAt;
      byId.set(row.threadId, {
        ...existing,
        lastMessage: row.lastMessageBody,
        lastMessageAt: row.lastMessageAt,
        peerLastReadAt,
      });
    } else if (row.bookingId) {
      byId.set(row.threadId, {
        threadId: row.threadId,
        bookingId: row.bookingId,
        participantUserId: "",
        participantName: "Conversation",
        lastMessage: row.lastMessageBody,
        lastMessageAt: row.lastMessageAt,
        unreadCount: 0,
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}
