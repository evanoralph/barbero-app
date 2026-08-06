import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { listConversations } from "@/src/api/conversations";
import { MessagesInbox } from "@/src/components/MessagesInbox";
import { ErrorState, LoadingState } from "@/src/components/ui";
import type { ConversationListItem } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export default function CustomerMessagesScreen() {
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    console.log("[messages] list conversations");
    logger.debug("messages", "list conversations");
    try {
      const list = await listConversations();
      setItems(list);
      const unreadTotal = list.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      console.log("[messages] list ok", { count: list.length, unreadTotal });
      logger.debug("messages", "list ok", { count: list.length, unreadTotal });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages");
      logger.error("messages", "list failed", e);
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

  if (loading && items.length === 0) return <LoadingState />;
  if (error && items.length === 0) return <ErrorState message={error} onRetry={load} />;

  return (
    <MessagesInbox
      title="Messages"
      items={items}
      logScope="messages"
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      error={error}
      emptyTitle="No conversations"
      emptyBody="Open a booking and tap Message to chat about that appointment."
      onOpenThread={(c) =>
        router.push(`/(customer)/messages/${encodeURIComponent(c.threadId)}`)
      }
    />
  );
}
