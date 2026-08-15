/** Latest own message the peer has already opened (for a single Seen tag). */
export function lastSeenOwnMessageId(
  messages: { _id: string; senderId: string; createdAt: string }[],
  userId: string | undefined,
  peerLastReadAt: string | undefined,
): string | null {
  if (!userId || !peerLastReadAt) return null;
  let last: string | null = null;
  for (const message of messages) {
    if (message.senderId !== userId) continue;
    if (message._id.startsWith("tmp-")) continue;
    if (message.createdAt <= peerLastReadAt) last = message._id;
  }
  return last;
}

export function isOwnMessageSeen(
  message: { _id: string; senderId: string; createdAt: string },
  userId: string | undefined,
  peerLastReadAt: string | undefined,
): boolean {
  if (!userId || !peerLastReadAt) return false;
  if (message.senderId !== userId) return false;
  if (message._id.startsWith("tmp-")) return false;
  return message.createdAt <= peerLastReadAt;
}
