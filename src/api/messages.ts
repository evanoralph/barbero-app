import { apiRequest } from "@/src/api/client";
import type { Message } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export function listMessages(threadId: string) {
  return apiRequest<Message[]>("/messages", { query: { threadId } });
}

export function sendMessage(input: {
  threadId: string;
  senderId: string;
  body: string;
}) {
  logger.info("messages-api", "sendMessage", { threadId: input.threadId });
  return apiRequest<Message>("/messages", { method: "POST", body: input });
}
