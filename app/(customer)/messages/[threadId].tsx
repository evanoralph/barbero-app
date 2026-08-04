import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { listMessages, sendMessage } from "@/src/api/messages";
import { useSession } from "@/src/auth/session";
import { MessageThreadView } from "@/src/components/MessageThreadView";
import { ErrorState, LoadingState } from "@/src/components/ui";
import type { Message } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

const POLL_MS = 12_000;

export default function CustomerThreadScreen() {
  const { threadId: raw } = useLocalSearchParams<{ threadId: string }>();
  const threadId = decodeURIComponent(raw ?? "");
  const { user } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const pollBusy = useRef(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!threadId) return;
      if (!opts?.silent) setError(null);
      try {
        const next = await listMessages(threadId);
        setMessages(next);
        if (!opts?.silent) {
          logger.debug("messages", "thread loaded", { threadId, count: next.length });
        }
      } catch (e) {
        if (!opts?.silent) {
          setError(e instanceof Error ? e.message : "Failed to load thread");
          logger.error("messages", "thread load failed", e);
        }
      } finally {
        setLoading(false);
      }
    },
    [threadId],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!threadId) return;
    const id = setInterval(async () => {
      if (pollBusy.current || sending) return;
      pollBusy.current = true;
      try {
        await load({ silent: true });
      } finally {
        pollBusy.current = false;
      }
    }, POLL_MS);
    logger.debug("messages", "poll start", { threadId, POLL_MS });
    return () => {
      clearInterval(id);
      logger.debug("messages", "poll stop", { threadId });
    };
  }, [threadId, load, sending]);

  const onSend = async () => {
    if (!user || !body.trim()) return;
    setSending(true);
    try {
      const msg = await sendMessage({
        threadId,
        senderId: user.userId,
        body: body.trim(),
      });
      setMessages((prev) => [...prev, msg]);
      setBody("");
      logger.info("messages", "sent", { threadId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && messages.length === 0) return <ErrorState message={error} onRetry={load} />;

  return (
    <MessageThreadView
      threadId={threadId}
      messages={messages}
      userId={user?.userId}
      body={body}
      onChangeBody={setBody}
      onSend={onSend}
      sending={sending}
      error={error}
    />
  );
}
