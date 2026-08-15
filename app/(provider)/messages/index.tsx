import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { listConversations } from "@/src/api/conversations";
import { useSession } from "@/src/auth/session";
import { MessagesInbox } from "@/src/components/MessagesInbox";
import { ErrorState, LoadingState } from "@/src/components/ui";
import { applyConversationPatches } from "@/src/meteor/apply-conversation-patches";
import { useConversationsLive } from "@/src/meteor/use-conversations-live";
import type { ConversationListItem } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export default function ProviderMessagesScreen() {
  const { user } = useSession();
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    console.log("[provider-messages] list conversations");
    logger.debug("provider-messages", "list conversations");
    try {
      const list = await listConversations();
      setItems(list);
      const unreadTotal = list.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      console.log("[provider-messages] list ok", { count: list.length, unreadTotal });
      logger.debug("provider-messages", "list ok", {
        count: list.length,
        unreadTotal,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inbox");
      logger.error("provider-messages", "list failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useConversationsLive(
    (rows) => {
      setItems((prev) => applyConversationPatches(prev, rows));
    },
    { enabled: Boolean(user) },
  );

  if (loading && items.length === 0) return <LoadingState />;
  if (error && items.length === 0) return <ErrorState message={error} onRetry={load} />;

  return (
    <MessagesInbox
      title="Inbox"
      items={items}
      logScope="provider-messages"
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      error={error}
      emptyTitle="No conversations"
      emptyBody="Chats open when a customer books you — one thread per booking."
      onOpenThread={(c) => {
        console.log("[provider-messages] open thread via params", {
          threadId: c.threadId,
        });
        logger.debug("provider-messages", "open thread via params", {
          threadId: c.threadId,
        });
        router.push({
          pathname: "/(provider)/messages/[threadId]",
          params: { threadId: c.threadId },
        });
      }}
    />
  );
}
