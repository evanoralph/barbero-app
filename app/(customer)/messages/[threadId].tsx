import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBooking } from "@/src/api/bookings";
import { listConversations } from "@/src/api/conversations";
import { listMessages, sendMessage } from "@/src/api/messages";
import { useSession } from "@/src/auth/session";
import {
  MessageThreadView,
  type ThreadBookingCard,
} from "@/src/components/MessageThreadView";
import { ErrorState, LoadingState } from "@/src/components/ui";
import type { ConversationListItem, Message } from "@/src/types/api";
import { bookingIdFromThreadId } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

const POLL_MS = 12_000;

const TAB_BAR_HIDDEN = { display: "none" as const };
const TAB_BAR_VISIBLE = {
  backgroundColor: colors.bgDeep,
  borderTopColor: colors.border,
  borderTopWidth: 1,
  height: 64,
  paddingTop: 6,
  paddingBottom: 8,
};

export default function CustomerThreadScreen() {
  const { threadId: raw } = useLocalSearchParams<{ threadId: string }>();
  const threadId = decodeURIComponent(raw ?? "");
  const { user } = useSession();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState<ConversationListItem | null>(null);
  const [bookingCard, setBookingCard] = useState<ThreadBookingCard | null>(null);
  const pollBusy = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent();
      console.log("[messages] hide tab bar on thread", { threadId });
      logger.debug("messages", "hide tab bar on thread", { threadId });
      parent?.setOptions({ tabBarStyle: TAB_BAR_HIDDEN });
      return () => {
        console.log("[messages] restore tab bar", { threadId });
        logger.debug("messages", "restore tab bar", { threadId });
        parent?.setOptions({ tabBarStyle: TAB_BAR_VISIBLE });
      };
    }, [navigation, threadId]),
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!threadId) return;
      if (!opts?.silent) setError(null);
      try {
        const next = await listMessages(threadId);
        setMessages(next);
        if (!opts?.silent) {
          console.log("[messages] thread loaded", { threadId, count: next.length });
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
        console.log("[messages] thread conversation", {
          threadId,
          found: Boolean(match),
        });
        logger.debug("messages", "thread conversation", {
          threadId,
          found: Boolean(match),
        });
      } catch (e) {
        console.log("[messages] conversation lookup soft-fail", {
          threadId,
          message: e instanceof Error ? e.message : String(e),
        });
        logger.warn("messages", "conversation lookup soft-fail", e);
      }

      const resolveId = bookingId || match?.bookingId;
      if (!resolveId) {
        console.log("[messages] no bookingId on thread", { threadId });
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
        console.log("[messages] booking card loaded", {
          bookingId: booking._id,
          status: booking.status,
        });
        logger.debug("messages", "booking card loaded", {
          bookingId: booking._id,
          status: booking.status,
        });
      } catch (e) {
        console.log("[messages] booking fetch soft-fail", {
          bookingId: resolveId,
          message: e instanceof Error ? e.message : String(e),
        });
        logger.warn("messages", "booking fetch soft-fail", e);
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

  const onSend = async (text?: string) => {
    if (!user) return;
    const content = (text ?? body).trim();
    if (!content) return;
    setSending(true);
    try {
      const msg = await sendMessage({
        threadId,
        senderId: user.userId,
        body: content,
      });
      setMessages((prev) => [...prev, msg]);
      if (!text) setBody("");
      console.log("[messages] sent", { threadId, quick: Boolean(text) });
      logger.info("messages", "sent", { threadId, quick: Boolean(text) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && messages.length === 0) return <ErrorState message={error} onRetry={load} />;

  const bookingId = bookingCard?.bookingId || bookingIdFromThreadId(threadId);

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
      participantName={conversation?.participantName}
      participantAvatar={conversation?.participantAvatar}
      booking={bookingCard}
      onBack={() => router.back()}
      onOpenBooking={() => {
        if (!bookingId) return;
        router.push(`/(customer)/bookings/${encodeURIComponent(bookingId)}`);
      }}
    />
  );
}
