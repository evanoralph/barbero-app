import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ConversationListItem } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
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
}: {
  conversation: ConversationListItem;
  onPress: () => void;
  logScope?: string;
}) {
  const unread = Math.max(0, conversation.unreadCount || 0);
  const avatar = (conversation.participantAvatar || "").trim();
  const subtitle = conversation.serviceName
    ? `${conversation.serviceName}${
        conversation.startsAt
          ? ` · ${new Date(conversation.startsAt).toLocaleDateString()}`
          : ""
      }`
    : "Booking chat";
  const relative = formatRelativeTime(conversation.lastMessageAt);

  return (
    <Pressable
      onPress={() => {
        logger.debug(logScope, "open booking thread", {
          threadId: conversation.threadId,
          bookingId: conversation.bookingId,
          unread,
        });
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.avatarWrap}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.initials}>{initials(conversation.participantName)}</Text>
          </View>
        )}
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? "99+" : String(unread)}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text
            style={[styles.name, unread > 0 && styles.nameUnread]}
            numberOfLines={1}
          >
            {conversation.participantName}
          </Text>
          {relative ? <Text style={styles.time}>{relative}</Text> : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {subtitle}
        </Text>
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
  row: {
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgDeep,
  },
  initials: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 13,
    fontFamily: fonts.monoMedium,
  },
  badge: {
    position: "absolute",
    right: -2,
    top: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "800",
  },
  body: { flex: 1, gap: 2 },
  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  name: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 15,
    flex: 1,
  },
  nameUnread: { fontWeight: "800" },
  time: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: fonts.mono,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  preview: {
    color: colors.textMuted,
    fontSize: 13,
  },
  previewUnread: {
    color: colors.text,
    fontWeight: "600",
  },
});
