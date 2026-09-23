import { apiRequest } from "@/src/api/client";
import type { Message } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export const MESSAGES_PAGE_SIZE = 40;

export type ListMessagesPage = {
  items: Message[];
  hasMore: boolean;
};

export function listMessages(
  threadId: string,
  opts?: { limit?: number; beforeCreatedAt?: string },
) {
  const limit = opts?.limit ?? MESSAGES_PAGE_SIZE;
  const beforeCreatedAt = opts?.beforeCreatedAt;
  logger.info("messages-api", "listMessages", {
    threadId,
    limit,
    beforeCreatedAt: beforeCreatedAt ?? null,
  });
  console.log("[messages-api] listMessages", {
    threadId,
    limit,
    beforeCreatedAt: beforeCreatedAt ?? null,
  });
  return apiRequest<ListMessagesPage>("/messages", {
    query: {
      threadId,
      limit,
      ...(beforeCreatedAt ? { beforeCreatedAt } : {}),
    },
  });
}

export function sendMessage(input: {
  threadId: string;
  senderId: string;
  body: string;
  imageUrl?: string;
}) {
  logger.info("messages-api", "sendMessage", {
    threadId: input.threadId,
    hasImage: Boolean(input.imageUrl),
    bodyLen: input.body.length,
  });
  console.log("[messages-api] sendMessage", {
    threadId: input.threadId,
    hasImage: Boolean(input.imageUrl),
  });
  return apiRequest<Message>("/messages", { method: "POST", body: input });
}
