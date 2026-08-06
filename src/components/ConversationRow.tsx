import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ConversationListItem } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { formatConversationBookingLine } from "@/src/utils/conversations";
import { formatRelativeTime } from "@/src/utils/relativeTime";
import { logger } from "@/src/utils/logger";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function ConversationRow({
  conversation,
  onPress,
  logScope = "messages",
  variant = "grouped",
  emphasizeMeta = false,
}: {
  conversation: ConversationListItem;
  onPress: () => void;
  logScope?: string;
  /** Flat hairline rows (6d). */
  variant?: "grouped" | "card";
  /** Gold booking meta (upcoming section). */
  emphasizeMeta?: boolean;
}) {
  const unread = Math.max(0, conversation.unreadCount || 0);
  const avatar = (conversation.participantAvatar || "").trim();
  const bookingLine = formatConversationBookingLine(conversation);
  const relative = formatRelativeTime(conversation.lastMessageAt);

  return (
    <Pressable
      onPress={() => {
        console.log(`[${logScope}] open booking thread`, {
          threadId: conversation.threadId,
          bookingId: conversation.bookingId,
          unread,
        });
        logger.debug(logScope, "open booking thread", {
          threadId: conversation.threadId,
          bookingId: conversation.bookingId,
          unread,
        });
        onPress();
      }}
      style={({ pressed }) => [
        variant === "grouped" ? styles.rowGrouped : styles.rowCard,
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={styles.avatarWrap}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.initials}>{initials(conversation.participantName)}</Text>
          </View>
        )}
        {unread > 0 ? <View style={styles.unreadDot} /> : null}
      </View>
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={styles.name} numberOfLines={1}>
            {conversation.participantName}
          </Text>
          {relative ? (
            <Text style={[styles.time, emphasizeMeta && styles.timeAccent]}>{relative}</Text>
          ) : null}
        </View>
        {bookingLine ? (
          <Text
            style={[styles.meta, emphasizeMeta ? styles.metaAccent : styles.metaMuted]}
            numberOfLines={1}
          >
            {bookingLine}
          </Text>
        ) : null}
        <Text
          style={[styles.preview, unread > 0 && styles.previewUnread]}
          numberOfLines={1}
        >
          {conversation.lastMessage || "No messages yet"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowGrouped: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  rowCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgDeep,
  },
  initials: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 12,
    fontFamily: fonts.monoMedium,
  },
  unreadDot: {
    position: "absolute",
    right: -1,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  body: { flex: 1, minWidth: 0 },
  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.serifMedium,
    fontSize: 16,
    flex: 1,
  },
  time: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: fonts.mono,
  },
  timeAccent: {
    color: colors.accentDark,
  },
  meta: {
    fontSize: 9,
    fontFamily: fonts.mono,
    letterSpacing: 1,
    marginTop: 3,
    marginBottom: 2,
  },
  metaAccent: {
    color: colors.accentDark,
  },
  metaMuted: {
    color: colors.textMuted,
  },
  preview: {
    color: colors.textMuted,
    fontSize: 13,
  },
  previewUnread: {
    color: colors.text,
    fontWeight: "500",
  },
});
