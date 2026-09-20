import { formatMoney } from '@/src/utils/format';
import * as ImagePicker from "expo-image-picker";
import { CheckCheck, ChevronLeft, ChevronRight, ImagePlus, Phone, Send, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Muted } from "@/src/components/ui";
import type { Message } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { compressImageForUpload } from "@/src/utils/compressImage";
import { isBookingChatOpen } from "@/src/utils/bookingDisplay";
import { logger } from "@/src/utils/logger";
import { isOwnMessageSeen, lastSeenOwnMessageId } from "@/src/utils/messagesSeen";

export type ThreadBookingCard = {
  bookingId: string;
  serviceName: string;
  startsAt: string;
  status: string;
  price?: number | null;
};

type Props = {
  threadId: string;
  messages: Message[];
  userId?: string;
  body: string;
  onChangeBody: (text: string) => void;
  /** Send current body, or an explicit quick-reply string. */
  onSend: (text?: string) => void;
  /** Pick → compress already done; parent uploads + creates message. */
  onSendImage?: (input: {
    uri: string;
    mimeType: string;
    caption?: string;
    byteSize?: number;
  }) => void | Promise<void>;
  sending: boolean;
  error?: string | null;
  emptyLabel?: string;
  participantName?: string;
  participantAvatar?: string;
  booking?: ThreadBookingCard | null;
  onBack?: () => void;
  onOpenBooking?: () => void;
  onPhonePress?: () => void;
  peerTyping?: boolean;
  peerLastReadAt?: string;
};

const QUICK_CHIPS = ["On my way", "Running late", "Reschedule"] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "TODAY";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return "YESTERDAY";
  return d
    .toLocaleDateString(undefined, { month: "short", day: "numeric" })
    .toUpperCase();
}

type ListRow =
  | { kind: "sep"; id: string; label: string }
  | { kind: "msg"; id: string; message: Message };

export function MessageThreadView({
  threadId,
  messages,
  userId,
  body,
  onChangeBody,
  onSend,
  onSendImage,
  sending,
  error,
  emptyLabel = "No messages yet — say hello.",
  participantName = "Chat",
  participantAvatar,
  booking,
  onBack,
  onOpenBooking,
  onPhonePress,
  peerTyping = false,
  peerLastReadAt,
}: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ListRow>>(null);
  const keyboardVerticalOffset = Platform.OS === "ios" ? insets.top : 0;
  const [pickingImage, setPickingImage] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const busy = sending || pickingImage;
  const chatOpen = isBookingChatOpen(booking?.status);
  const closedReason =
    (booking?.status || "").toLowerCase() === "cancelled" ? "cancelled" : "completed";

  useEffect(() => {
    if (!chatOpen && booking?.status) {
      console.log("[MessageThreadView] chat closed", {
        threadId,
        status: booking.status,
      });
      logger.info("MessageThreadView", "chat closed", {
        threadId,
        status: booking.status,
      });
    }
  }, [chatOpen, booking?.status, threadId]);

  const seenOwnId = useMemo(
    () => lastSeenOwnMessageId(messages, userId, peerLastReadAt),
    [messages, userId, peerLastReadAt],
  );

  const rows = useMemo(() => {
    const out: ListRow[] = [];
    let lastDay: string | null = null;
    for (const m of messages) {
      const key = dayKey(m.createdAt);
      if (key !== lastDay) {
        lastDay = key;
        out.push({ kind: "sep", id: `sep-${key}-${m._id}`, label: dayLabel(m.createdAt) });
      }
      out.push({ kind: "msg", id: m._id, message: m });
    }
    return out;
  }, [messages]);

  useEffect(() => {
    if (peerTyping) {
      console.log("[MessageThreadView] peer typing", { threadId, participantName });
      logger.debug("MessageThreadView", "peer typing", { threadId, participantName });
    }
  }, [peerTyping, threadId, participantName]);

  useEffect(() => {
    if (rows.length === 0) return;
    const id = requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
      logger.debug("MessageThreadView", "scrollToEnd", {
        threadId,
        rowCount: rows.length,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [rows.length, threadId]);

  useEffect(() => {
    console.log("[MessageThreadView] mount", {
      threadId,
      platform: Platform.OS,
      hasBooking: Boolean(booking),
      messageCount: messages.length,
    });
    logger.debug("MessageThreadView", "mount", {
      threadId,
      platform: Platform.OS,
      keyboardVerticalOffset,
      hasBooking: Boolean(booking),
    });

    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      logger.debug("MessageThreadView", "keyboardDidShow", {
        height: e.endCoordinates?.height,
        threadId,
      });
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      logger.debug("MessageThreadView", "keyboardDidHide", { threadId });
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      logger.debug("MessageThreadView", "unmount", { threadId });
    };
  }, [threadId, keyboardVerticalOffset, booking, messages.length]);

  const avatar = (participantAvatar || "").trim();
  const month = booking?.startsAt
    ? new Date(booking.startsAt)
        .toLocaleString(undefined, { month: "short" })
        .toUpperCase()
    : "";
  const day = booking?.startsAt ? String(new Date(booking.startsAt).getDate()).padStart(2, "0") : "";
  const timeLabel = booking?.startsAt
    ? new Date(booking.startsAt).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  const statusUp = (booking?.status || "").toUpperCase();
  const priceLabel =
    typeof booking?.price === "number" && booking.price > 0 ? ` · ${formatMoney(booking.price)}` : "";

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <Pressable
          hitSlop={10}
          onPress={() => {
            console.log("[MessageThreadView] back", { threadId });
            logger.debug("MessageThreadView", "back", { threadId });
            onBack?.();
          }}
          style={styles.iconBtn}
        >
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
            <Text style={styles.headerInitials}>{initials(participantName)}</Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.headerName} numberOfLines={1}>
            {participantName}
          </Text>
          <Text style={styles.headerSub}>USUALLY REPLIES IN AN HOUR</Text>
        </View>
        <Pressable
          hitSlop={10}
          onPress={() => {
            console.log("[MessageThreadView] phone tap (noop)", { threadId });
            logger.debug("MessageThreadView", "phone tap", { threadId });
            onPhonePress?.();
          }}
          style={styles.iconBtn}
        >
          <Phone size={19} color={colors.text} />
        </Pressable>
      </View>

      {booking ? (
        <Pressable
          onPress={() => {
            console.log("[MessageThreadView] booking card tap", {
              threadId,
              bookingId: booking.bookingId,
            });
            logger.debug("MessageThreadView", "booking card tap", {
              threadId,
              bookingId: booking.bookingId,
            });
            onOpenBooking?.();
          }}
          style={({ pressed }) => [styles.bookingCard, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.bookingDate}>
            <Text style={styles.bookingMonth}>{month}</Text>
            <Text style={styles.bookingDay}>{day}</Text>
          </View>
          <View style={styles.bookingBody}>
            <Text style={styles.bookingTitle} numberOfLines={1}>
              {booking.serviceName}
              {timeLabel ? ` · ${timeLabel}` : ""}
            </Text>
            <Text style={styles.bookingStatus}>
              {statusUp || "BOOKING"}
              {priceLabel}
            </Text>
          </View>
          <ChevronRight size={15} color={colors.textMuted} />
        </Pressable>
      ) : null}

      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListEmptyComponent={
          <Muted style={styles.empty}>{emptyLabel}</Muted>
        }
        renderItem={({ item }) => {
          if (item.kind === "sep") {
            return <Text style={styles.daySep}>{item.label}</Text>;
          }
          const mine = item.message.senderId === userId;
          const seen = isOwnMessageSeen(item.message, userId, peerLastReadAt);
          const showSeenTag = mine && item.message._id === seenOwnId;
          const time = new Date(item.message.createdAt).toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          });
          const imageUrl = (item.message.imageUrl || "").trim();
          const textBody = (item.message.body || "").trim();
          return (
            <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapOther]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther, imageUrl ? styles.bubbleImagePad : null]}>
                {imageUrl ? (
                  <Pressable
                    onPress={() => {
                      console.log("[MessageThreadView] open lightbox", { threadId, messageId: item.message._id });
                      logger.debug("MessageThreadView", "open lightbox", { threadId });
                      setLightboxUrl(imageUrl);
                    }}
                  >
                    <Image source={{ uri: imageUrl }} style={styles.bubbleImage} />
                  </Pressable>
                ) : null}
                {textBody ? (
                  <Text
                    style={[
                      styles.bubbleText,
                      mine && styles.bubbleTextMine,
                      imageUrl ? styles.bubbleCaption : null,
                    ]}
                  >
                    {textBody}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.metaRow, mine && styles.metaRowMine]}>
                <Text style={styles.metaTime}>{time}</Text>
                {mine ? (
                  <CheckCheck
                    size={12}
                    color={seen ? colors.accent : colors.textMuted}
                  />
                ) : null}
              </View>
              {showSeenTag ? <Text style={styles.seenTag}>Seen</Text> : null}
            </View>
          );
        }}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {peerTyping && chatOpen ? (
        <Text style={styles.typing}>
          {participantName ? `${participantName} is typing…` : "Typing…"}
        </Text>
      ) : null}

      {chatOpen ? (
        <View style={styles.chips}>
          {QUICK_CHIPS.map((chip) => (
            <Pressable
              key={chip}
              disabled={busy}
              onPress={() => {
                console.log("[MessageThreadView] quick chip", { threadId, chip });
                logger.debug("MessageThreadView", "quick chip", { threadId, chip });
                onSend(chip);
              }}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            >
              <Text style={styles.chipText}>{chip}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {chatOpen ? (
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          hitSlop={8}
          disabled={busy || !onSendImage}
          onPress={async () => {
            if (!onSendImage || busy) return;
            try {
              setPickingImage(true);
              console.log("[MessageThreadView] image pick start", { threadId });
              logger.debug("MessageThreadView", "image pick start", { threadId });
              const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!permission.granted) {
                Alert.alert("Permission needed", "Allow photo library access to send images.");
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                quality: 1,
              });
              if (result.canceled || !result.assets?.[0]) {
                console.log("[MessageThreadView] image pick cancelled", { threadId });
                logger.debug("MessageThreadView", "image pick cancelled", { threadId });
                return;
              }
              const asset = result.assets[0];
              console.log("[MessageThreadView] image picked", {
                threadId,
                width: asset.width,
                height: asset.height,
              });
              const compressed = await compressImageForUpload(asset.uri);
              const caption = body.trim() || undefined;
              await onSendImage({
                uri: compressed.uri,
                mimeType: compressed.mimeType,
                caption,
                byteSize: compressed.afterBytes,
              });
              if (caption) onChangeBody("");
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Could not send image";
              console.log("[MessageThreadView] image pick/send failed", { threadId, msg });
              logger.error("MessageThreadView", "image pick/send failed", { threadId, msg, e });
              Alert.alert("Image failed", msg);
            } finally {
              setPickingImage(false);
            }
          }}
        >
          {pickingImage ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <ImagePlus size={22} color={busy ? colors.border : colors.textMuted} />
          )}
        </Pressable>
        <TextInput
          value={body}
          onChangeText={onChangeBody}
          placeholder="Message"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          editable={!busy}
          onSubmitEditing={() => {
            if (body.trim()) onSend();
          }}
          returnKeyType="send"
        />
        <Pressable
          disabled={busy || !body.trim()}
          onPress={() => {
            console.log("[MessageThreadView] send", { threadId, len: body.trim().length });
            logger.debug("MessageThreadView", "send press", { threadId });
            onSend();
          }}
          style={({ pressed }) => [
            styles.sendBtn,
            (!body.trim() || busy) && styles.sendBtnDisabled,
            pressed && { opacity: 0.9 },
          ]}
        >
          {sending ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Send size={16} color={colors.text} />
          )}
        </Pressable>
      </View>
      ) : (
        <View style={[styles.closedBanner, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Muted style={styles.closedText}>
            {closedReason === "cancelled"
              ? "Chat closed — this booking was cancelled."
              : "Chat closed — this booking is completed."}
          </Muted>
        </View>
      )}

      <Modal
        visible={Boolean(lightboxUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxUrl(null)}
      >
        <View style={styles.lightbox}>
          <Pressable
            style={[styles.lightboxClose, { top: Math.max(insets.top, 12) }]}
            onPress={() => setLightboxUrl(null)}
            hitSlop={12}
          >
            <X size={24} color={colors.white} />
          </Pressable>
          {lightboxUrl ? (
            <Image source={{ uri: lightboxUrl }} style={styles.lightboxImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.border,
  },
  headerAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgDeep,
  },
  headerInitials: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.text,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerName: {
    fontFamily: fonts.serifMedium,
    fontSize: 16,
    color: colors.text,
  },
  headerSub: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.success,
    marginTop: 1,
  },
  bookingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.bg,
  },
  bookingDate: {
    width: 34,
    alignItems: "center",
  },
  bookingMonth: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 1.2,
    color: colors.accentDark,
  },
  bookingDay: {
    fontFamily: fonts.serifMedium,
    fontSize: 17,
    color: colors.text,
    lineHeight: 20,
  },
  bookingBody: { flex: 1, minWidth: 0 },
  bookingTitle: {
    fontFamily: fonts.serifMedium,
    fontSize: 14,
    color: colors.text,
  },
  bookingStatus: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.success,
    marginTop: 2,
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
    gap: 10,
    flexGrow: 1,
  },
  empty: { textAlign: "center", marginTop: 24 },
  daySep: {
    textAlign: "center",
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.textMuted,
    marginVertical: 4,
  },
  bubbleWrap: { maxWidth: "78%" },
  bubbleWrapMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubbleWrapOther: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: {
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  bubbleOther: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
  },
  bubbleMine: {
    backgroundColor: colors.text,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 16,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  bubbleTextMine: {
    color: colors.white,
  },
  bubbleImagePad: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  bubbleImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  bubbleCaption: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  lightbox: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxClose: {
    position: "absolute",
    right: 16,
    zIndex: 2,
    padding: 8,
  },
  lightboxImage: {
    width: "100%",
    height: "80%",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    marginLeft: 4,
  },
  metaRowMine: {
    marginLeft: 0,
    marginRight: 4,
  },
  metaTime: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
  },
  seenTag: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
    marginRight: 4,
  },
  error: {
    color: colors.danger,
    paddingHorizontal: 16,
    marginBottom: 4,
    fontSize: 13,
  },
  typing: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  chips: {
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  closedBanner: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  closedText: {
    textAlign: "center",
    fontSize: 13,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipPressed: {
    borderColor: colors.accent,
  },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
});
