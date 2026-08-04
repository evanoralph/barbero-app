import { apiRequest } from "@/src/api/client";
import type { ConversationListItem } from "@/src/types/api";

export function listConversations() {
  return apiRequest<ConversationListItem[]>("/conversations");
}
