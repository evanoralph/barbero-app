import { Search, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConversationRow } from "@/src/components/ConversationRow";
import { EmptyMessagesIllustration } from "@/src/components/illustrations/EmptyMessagesIllustration";
import { EmptyState, Screen, SegmentedControl } from "@/src/components/ui";
import type { ConversationListItem } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import {
  filterConversations,
  isUpcomingConversation,
  splitConversations,
} from "@/src/utils/conversations";
import { logger } from "@/src/utils/logger";

type Props = {
  title: string;
  items: ConversationListItem[];
  logScope: string;
  refreshing: boolean;
  onRefresh: () => void;
  error?: string | null;
  emptyTitle: string;
  emptyBody: string;
  onOpenThread: (conversation: ConversationListItem) => void;
};

export function MessagesInbox({
  title,
  items,
  logScope,
  refreshing,
  onRefresh,
  error,
  emptyTitle,
  emptyBody,
  onOpenThread,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const [tab, setTab] = useState<"all" | "unread" | "upcoming">("all");

  const unreadThreads = useMemo(
    () => items.filter((c) => (c.unreadCount || 0) > 0).length,
    [items],
  );
  const filtered = useMemo(() => {
    const searched = filterConversations(items, query);
    if (tab === "unread") return searched.filter((c) => (c.unreadCount || 0) > 0);
    if (tab === "upcoming") return searched.filter((c) => isUpcomingConversation(c));
    return searched;
  }, [items, query, tab]);
  const { upcoming, earlier } = useMemo(
    () => splitConversations(filtered),
    [filtered],
  );

  useEffect(() => {
    console.log(`[${logScope}] inbox sections`, {
      total: items.length,
      filtered: filtered.length,
      upcoming: upcoming.length,
      earlier: earlier.length,
      query: query.trim() || null,
    });
    logger.debug(logScope, "inbox sections", {
      total: items.length,
      filtered: filtered.length,
      upcoming: upcoming.length,
      earlier: earlier.length,
      query: query.trim() || null,
    });
  }, [logScope, items.length, filtered.length, upcoming.length, earlier.length, query]);

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentStyle={{
        ...styles.content,
        paddingTop: Math.max(insets.top, 8),
      }}
    >
      <View style={styles.header}>
        {searchOpen ? (
          <View style={styles.searchBar}>
            <Search size={18} color={colors.textMuted} />
            <TextInput
              autoFocus
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                console.log(`[${logScope}] search query`, { len: t.length });
              }}
              placeholder="Search chats"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
            />
            <Pressable
              hitSlop={10}
              onPress={() => {
                setSearchOpen(false);
                setQuery("");
                console.log(`[${logScope}] search closed`);
                logger.debug(logScope, "search closed");
              }}
            >
              <X size={18} color={colors.text} />
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              hitSlop={12}
              onPress={() => {
                setSearchOpen(true);
                console.log(`[${logScope}] search opened`);
                logger.debug(logScope, "search opened");
              }}
            >
              <Search size={20} color={colors.text} />
            </Pressable>
          </>
        )}
      </View>

      {items.length > 0 ? (
        <View style={styles.segmentWrap}>
          <SegmentedControl
            options={[
              { id: "all", label: "All" },
              { id: "unread", label: unreadThreads > 0 ? `Unread · ${unreadThreads}` : "Unread" },
              { id: "upcoming", label: "Upcoming" },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {items.length === 0 ? (
        <EmptyState title={emptyTitle} body={emptyBody} illustration={<EmptyMessagesIllustration />} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={tab === "all" || query.trim() ? "No matches" : tab === "unread" ? "All caught up" : "Nothing upcoming"}
          body={
            query.trim()
              ? "Try a different name, service, or message snippet."
              : tab === "unread"
                ? "No unread messages."
                : "Chats for upcoming appointments show up here."
          }
        />
      ) : (
        <>
          {upcoming.length > 0 ? (
            <View>
              <Text style={styles.sectionLabel}>Upcoming appointments</Text>
              <View style={styles.sectionBorder}>
                {upcoming.map((c) => (
                  <ConversationRow
                    key={c.threadId}
                    conversation={c}
                    logScope={logScope}
                    variant="grouped"
                    emphasizeMeta
                    onPress={() => onOpenThread(c)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {earlier.length > 0 ? (
            <View>
              <Text style={[styles.sectionLabel, upcoming.length > 0 && styles.sectionLabelSpaced]}>
                Earlier
              </Text>
              <View style={styles.sectionBorder}>
                {earlier.map((c) => (
                  <ConversationRow
                    key={c.threadId}
                    conversation={c}
                    logScope={logScope}
                    variant="grouped"
                    onPress={() => onOpenThread(c)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <Text style={styles.footer}>
            Chats open from a booking, so every thread stays tied to an appointment.
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0,
    paddingTop: 0,
    gap: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 12,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 26,
    letterSpacing: -0.2,
    color: colors.text,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.bg,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  segmentWrap: { paddingHorizontal: 20, paddingBottom: 16 },
  sectionLabel: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  sectionLabelSpaced: {
    paddingTop: 24,
  },
  sectionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 30,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    color: colors.textMuted,
  },
  error: {
    color: colors.danger,
    paddingHorizontal: 20,
    marginBottom: 8,
    fontSize: 13,
  },
});
