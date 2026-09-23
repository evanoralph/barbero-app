import { apiRequest } from "@/src/api/client";
import type { ConversationListItem } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export function listConversations() {
  return apiRequest<ConversationListItem[]>("/conversations");
}

export function markThreadRead(threadId: string) {
  logger.debug("conversations-api", "markThreadRead", { threadId });
  console.log("[conversations-api] markThreadRead", threadId);
  return apiRequest<{ threadId: string; lastReadAt: string }>("/conversations/read", {
    method: "POST",
    body: { threadId },
  });
}

/**
 * Tell the API which chat is open so it can skip push for that thread.
 * Pass null when leaving the thread.
 */
export function setThreadViewing(threadId: string | null) {
  logger.info("conversations-api", "setThreadViewing", { threadId });
  console.log("[conversations-api] setThreadViewing", threadId);
  return apiRequest<{ threadId: string | null }>("/conversations/viewing", {
    method: "POST",
    body: { threadId },
  });
}
