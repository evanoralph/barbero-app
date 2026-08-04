import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text } from "react-native";
import { listConversations } from "@/src/api/conversations";
import { ConversationRow } from "@/src/components/ConversationRow";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import type { ConversationListItem } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

export default function ProviderMessagesScreen() {
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    logger.debug("provider-messages", "list conversations");
    try {
      const list = await listConversations();
      setItems(list);
      const unreadTotal = list.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
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

  if (loading && items.length === 0) return <LoadingState />;
  if (error && items.length === 0) return <ErrorState message={error} onRetry={load} />;

  const unreadTotal = items.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <Title>Inbox</Title>
      <Muted>
        {items.length} conversation{items.length === 1 ? "" : "s"}
        {unreadTotal > 0 ? ` · ${unreadTotal} unread` : ""}
      </Muted>
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {items.length === 0 ? (
        <EmptyState
          title="No conversations"
          body="Chats open when a customer books you — one thread per booking."
        />
      ) : (
        items.map((c) => (
          <ConversationRow
            key={c.threadId}
            conversation={c}
            logScope="provider-messages"
            onPress={() =>
              router.push(`/(provider)/messages/${encodeURIComponent(c.threadId)}`)
            }
          />
        ))
      )}
    </Screen>
  );
}
