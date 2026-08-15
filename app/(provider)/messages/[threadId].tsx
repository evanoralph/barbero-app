import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBooking } from "@/src/api/bookings";
import { ApiError } from "@/src/api/client";
import { listConversations, markThreadRead } from "@/src/api/conversations";
import { listMessages, sendMessage } from "@/src/api/messages";
import { useSession } from "@/src/auth/session";
import {
  MessageThreadView,
  type ThreadBookingCard,
} from "@/src/components/MessageThreadView";
import { ErrorState, LoadingState } from "@/src/components/ui";
import { mergeMessages } from "@/src/meteor/merge-messages";
import { applyConversationPatches } from "@/src/meteor/apply-conversation-patches";
import { useConversationsLive } from "@/src/meteor/use-conversations-live";
import { useMessagesThreadLive } from "@/src/meteor/use-messages-thread-live";
import { useTypingIndicator } from "@/src/meteor/use-typing-indicator";
import type { ConversationListItem, Message } from "@/src/types/api";
import { bookingIdFromThreadId, normalizeThreadIdParam } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

const POLL_MS = 12_000;

const TAB_BAR_HIDDEN = { display: "none" as const };
const TAB_BAR_VISIBLE = {
  backgroundColor: colors.bgDeep,
  borderTopColor: colors.border,
  borderTopWidth: 1,
};

export default function ProviderThreadScreen() {
  const { threadId: raw } = useLocalSearchParams<{ threadId: string | string[] }>();
  const threadId = normalizeThreadIdParam(raw);
  const { user } = useSession();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState<ConversationListItem | null>(null);
  const [bookingCard, setBookingCard] = useState<ThreadBookingCard | null>(null);
  const pollBusy = useRef(false);

  useEffect(() => {
    console.log("[provider-messages] threadId param", { raw, threadId });
    logger.debug("provider-messages", "threadId param", { raw, threadId });
  }, [raw, threadId]);

  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent();
      console.log("[provider-messages] hide tab bar on thread", { threadId });
      logger.debug("provider-messages", "hide tab bar on thread", { threadId });
      parent?.setOptions({ tabBarStyle: TAB_BAR_HIDDEN });
      return () => {
        console.log("[provider-messages] restore tab bar", { threadId });
        logger.debug("provider-messages", "restore tab bar", { threadId });
        parent?.setOptions({ tabBarStyle: TAB_BAR_VISIBLE });
      };
    }, [navigation, threadId]),
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!threadId) return;
      if (!opts?.silent) {
        setLoadError(null);
        setError(null);
      }
      try {
        const next = await listMessages(threadId);
        setMessages((prev) => mergeMessages(next, prev));
        setLoadError(null);
        if (!opts?.silent) {
          console.log("[provider-messages] thread loaded", {
            threadId,
            count: next.length,
          });
          logger.debug("provider-messages", "thread loaded", {
            threadId,
            count: next.length,
          });
        }
      } catch (e) {
        if (!opts?.silent) {
          setLoadError(e instanceof Error ? e.message : "Failed to load thread");
          logger.error("provider-messages", "thread load failed", e);
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

  useConversationsLive(
    (rows) => {
      setConversation((prev) => {
        const next = applyConversationPatches(prev ? [prev] : [], rows);
        return next.find((c) => c.threadId === threadId) ?? prev;
      });
    },
    { enabled: Boolean(user && threadId) },
  );

  const lastIncomingId = [...messages]
    .reverse()
    .find((m) => m.senderId !== user?.userId)?._id;
  useEffect(() => {
    if (!threadId) return;
    console.log("[provider-messages] mark thread read", { threadId, lastIncomingId });
    logger.debug("provider-messages", "mark thread read", { threadId, lastIncomingId });
    void markThreadRead(threadId).catch((e) => {
      console.log("[provider-messages] mark thread read soft-fail", e);
      logger.warn("provider-messages", "mark thread read soft-fail", e);
    });
  }, [threadId, lastIncomingId]);

  const { liveMessages, liveReady } = useMessagesThreadLive(threadId, {
    enabled: Boolean(threadId && user),
  });
  const { peerTyping, reportLocalTyping, clearLocalTyping } = useTypingIndicator(threadId, {
    enabled: Boolean(threadId && user),
  });

  useEffect(() => {
    if (!liveReady) return;
    console.log("[provider-messages] merging live thread", {
      threadId,
      liveCount: liveMessages.length,
    });
    logger.debug("provider-messages", "merging live thread", {
      threadId,
      liveCount: liveMessages.length,
    });
    setMessages((prev) => mergeMessages(prev, liveMessages));
  }, [liveReady, liveMessages, threadId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!threadId) return;
      const bookingId = bookingIdFromThreadId(threadId);
      let match: ConversationListItem | null = null;
      try {
        const list = await listConversations();
        if (cancelled) return;
        match = list.find((c) => c.threadId === threadId) ?? null;
        setConversation(match);
        console.log("[provider-messages] thread conversation", {
          threadId,
          found: Boolean(match),
        });
        logger.debug("provider-messages", "thread conversation", {
          threadId,
          found: Boolean(match),
        });
      } catch (e) {
        console.log("[provider-messages] conversation lookup soft-fail", {
          threadId,
          message: e instanceof Error ? e.message : String(e),
        });
        logger.warn("provider-messages", "conversation lookup soft-fail", e);
      }

      const resolveId = bookingId || match?.bookingId;
      if (!resolveId) {
        console.log("[provider-messages] no bookingId on thread", { threadId });
        return;
      }
      try {
        const booking = await getBooking(resolveId);
        if (cancelled) return;
        setBookingCard({
          bookingId: booking._id,
          serviceName: booking.serviceName,
          startsAt: booking.startsAt,
          status: booking.status,
          price: null,
        });
        console.log("[provider-messages] booking card loaded", {
          bookingId: booking._id,
          status: booking.status,
        });
        logger.debug("provider-messages", "booking card loaded", {
          bookingId: booking._id,
          status: booking.status,
        });
      } catch (e) {
        console.log("[provider-messages] booking fetch soft-fail", {
          bookingId: resolveId,
          message: e instanceof Error ? e.message : String(e),
        });
        logger.warn("provider-messages", "booking fetch soft-fail", e);
        if (match?.startsAt || match?.serviceName) {
          setBookingCard({
            bookingId: match.bookingId || resolveId,
            serviceName: match.serviceName || "Booking",
            startsAt: match.startsAt || new Date().toISOString(),
            status: match.bookingStatus || "",
            price: null,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  useEffect(() => {
    if (!threadId || liveReady) {
      if (liveReady) {
        console.log("[provider-messages] poll skipped — live DDP ready", { threadId });
        logger.debug("provider-messages", "poll skipped — live DDP ready", { threadId });
      }
      return;
    }
    const id = setInterval(async () => {
      if (pollBusy.current || sending) return;
      pollBusy.current = true;
      try {
        await load({ silent: true });
      } finally {
        pollBusy.current = false;
      }
    }, POLL_MS);
    logger.debug("provider-messages", "poll start", { threadId, POLL_MS });
    return () => {
      clearInterval(id);
      logger.debug("provider-messages", "poll stop", { threadId });
    };
  }, [threadId, load, sending, liveReady]);

  const onSend = async (text?: string) => {
    if (!user) {
      console.log("[provider-messages] send skipped — no session user", { threadId });
      logger.warn("provider-messages", "send skipped — no session user", { threadId });
      return;
    }
    const content = (text ?? body).trim();
    if (!content) return;
    clearLocalTyping();
    setSending(true);
    setError(null);
    try {
      const msg = await sendMessage({
        threadId,
        senderId: user.userId,
        body: content,
      });
      setMessages((prev) => mergeMessages(prev, [msg]));
      if (!text) setBody("");
      console.log("[provider-messages] sent", { threadId, quick: Boolean(text) });
      logger.info("provider-messages", "sent", { threadId, quick: Boolean(text) });
    } catch (e) {
      const extra =
        e instanceof ApiError
          ? { threadId, status: e.status, code: e.code, message: e.message, details: e.details }
          : { threadId, message: e instanceof Error ? e.message : String(e) };
      console.log("[provider-messages] send failed", extra);
      logger.error("provider-messages", "send failed", extra);
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingState />;
  if (loadError && messages.length === 0) {
    return <ErrorState message={loadError} onRetry={load} />;
  }

  const bookingId = bookingCard?.bookingId || bookingIdFromThreadId(threadId);

  return (
    <MessageThreadView
      threadId={threadId}
      messages={messages}
      userId={user?.userId}
      body={body}
      onChangeBody={(text) => {
        setBody(text);
        reportLocalTyping(text.trim().length > 0);
      }}
      onSend={onSend}
      sending={sending}
      error={error}
      emptyLabel="No messages yet."
      participantName={conversation?.participantName}
      participantAvatar={conversation?.participantAvatar}
      booking={bookingCard}
      peerTyping={peerTyping}
      peerLastReadAt={conversation?.peerLastReadAt}
      onBack={() => router.back()}
      onOpenBooking={() => {
        if (!bookingId) return;
        router.push(`/(provider)/bookings/${encodeURIComponent(bookingId)}`);
      }}
    />
  );
}
