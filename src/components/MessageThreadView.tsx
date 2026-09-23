import { formatMoney } from '@/src/utils/format';
import * as ImagePicker from "expo-image-picker";
import { CheckCheck, ChevronLeft, ChevronRight, ImagePlus, Send, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
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

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  /** Older history available above the loaded window. */
  hasMore?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void | Promise<void>;
  participantName?: string;
  participantAvatar?: string;
  booking?: ThreadBookingCard | null;
  onBack?: () => void;
  onOpenBooking?: () => void;
  peerTyping?: boolean;
  peerLastReadAt?: string;
};

const QUICK_CHIPS = ["On my way", "Running late", "Reschedule"] as const;
const NEAR_BOTTOM_PX = 96;

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
  hasMore = false,
  loadingOlder = false,
  onLoadOlder,
  participantName = "Chat",
  participantAvatar,
  booking,
  onBack,
  onOpenBooking,
  peerTyping = false,
  peerLastReadAt,
}: Props) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ListRow>>(null);
  const inputRef = useRef<TextInput>(null);
  const nearBottomRef = useRef(true);
  const initialScrolledRef = useRef(false);
  const prevRowCountRef = useRef(0);
  const skipAutoScrollRef = useRef(false);
  const scrollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** Enable after first scroll-to-latest so MVCP does not block the open jump. */
  const [historyAnchoring, setHistoryAnchoring] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  /**
   * Lift list + composer with real keyboard height (RN events).
   * KeyboardStickyView/reanimated height was not moving the composer on device.
   */
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const busy = sending || pickingImage;
  const chatOpen = isBookingChatOpen(booking?.status);
  const keyboardOpen = keyboardHeight > 0;
  const composerPadBottom = keyboardOpen ? 10 : Math.max(insets.bottom, 12);
  const closedReason =
    (booking?.status || "").toLowerCase() === "cancelled" ? "cancelled" : "completed";

  /** Keep keyboard open after send — never disable TextInput for `sending`. */
  const keepComposerFocused = useCallback(
    (reason: string) => {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        console.log("[MessageThreadView] keep keyboard — refocus", { threadId, reason });
        logger.debug("MessageThreadView", "keep keyboard — refocus", { threadId, reason });
      });
    },
    [threadId],
  );

  const handleSend = useCallback(
    (text?: string) => {
      onSend(text);
      keepComposerFocused(text ? "quick-chip" : "send");
    },
    [onSend, keepComposerFocused],
  );

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

  // Reset scroll gates when switching threads.
  useEffect(() => {
    nearBottomRef.current = true;
    initialScrolledRef.current = false;
    prevRowCountRef.current = 0;
    skipAutoScrollRef.current = false;
    setHistoryAnchoring(false);
    for (const t of scrollTimersRef.current) clearTimeout(t);
    scrollTimersRef.current = [];
    console.log("[MessageThreadView] scroll gates reset", { threadId });
    logger.debug("MessageThreadView", "scroll gates reset", { threadId });
  }, [threadId]);

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

  const clearScrollTimers = () => {
    for (const t of scrollTimersRef.current) clearTimeout(t);
    scrollTimersRef.current = [];
  };

  const scrollToLatest = (animated: boolean, reason: string, retries = false) => {
    const lastIndex = rows.length - 1;
    if (lastIndex < 0) return;

    const run = (pass: number) => {
      const list = listRef.current;
      if (!list) return;
      // scrollToIndex is more reliable than scrollToEnd on iOS when list is long.
      try {
        list.scrollToIndex({
          index: lastIndex,
          animated: animated && pass === 0,
          viewPosition: 1,
        });
      } catch (error) {
        logger.debug("MessageThreadView", "scrollToIndex threw — fallback scrollToEnd", {
          threadId,
          error,
        });
      }
      list.scrollToEnd({ animated: animated && pass === 0 });
      console.log("[MessageThreadView] scrollToLatest", {
        threadId,
        reason,
        pass,
        lastIndex,
        animated: animated && pass === 0,
      });
      logger.info("MessageThreadView", "scrollToLatest", {
        threadId,
        reason,
        pass,
        lastIndex,
        animated: animated && pass === 0,
      });
    };

    requestAnimationFrame(() => {
      run(0);
      if (!retries) return;
      // Layout settles in waves (booking card, images, keyboard). Re-pin to latest.
      for (const [pass, delay] of [
        [1, 50],
        [2, 150],
        [3, 350],
      ] as const) {
        const timer = setTimeout(() => run(pass), delay);
        scrollTimersRef.current.push(timer);
      }
    });
  };

  const markInitialScrolled = () => {
    if (initialScrolledRef.current) return;
    initialScrolledRef.current = true;
    // Defer MVCP so it cannot cancel the open jump to latest.
    const timer = setTimeout(() => {
      setHistoryAnchoring(true);
      logger.debug("MessageThreadView", "history anchoring enabled", { threadId });
    }, 400);
    scrollTimersRef.current.push(timer);
  };

  const handleContentSizeChange = () => {
    if (rows.length === 0) return;

    // Prepending older history must not yank the viewport to the latest.
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      prevRowCountRef.current = rows.length;
      logger.debug("MessageThreadView", "skip auto-scroll — load older", {
        threadId,
        rowCount: rows.length,
      });
      return;
    }

    if (!initialScrolledRef.current) {
      scrollToLatest(false, "initial", true);
      markInitialScrolled();
      prevRowCountRef.current = rows.length;
      return;
    }

    if (rows.length > prevRowCountRef.current) {
      const newest = messages[messages.length - 1];
      const ownSend = Boolean(newest && userId && newest.senderId === userId);
      if (nearBottomRef.current || ownSend) {
        scrollToLatest(true, ownSend ? "own-send" : "near-bottom", false);
      } else {
        logger.debug("MessageThreadView", "skip auto-scroll — user reading history", {
          threadId,
          rowCount: rows.length,
        });
      }
    }
    prevRowCountRef.current = rows.length;
  };

  // If data arrives before FlatList mounts content, still pin to latest once rows exist.
  useEffect(() => {
    if (rows.length === 0 || initialScrolledRef.current) return;
    console.log("[MessageThreadView] rows ready — force scroll to latest", {
      threadId,
      rowCount: rows.length,
    });
    scrollToLatest(false, "rows-ready", true);
    markInitialScrolled();
    prevRowCountRef.current = rows.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when rows first populate / grow from empty
  }, [rows.length, threadId]);

  // Booking card above the list shrinks viewport — re-pin if we were following latest.
  useEffect(() => {
    if (!booking || !initialScrolledRef.current || rows.length === 0) return;
    if (!nearBottomRef.current) return;
    console.log("[MessageThreadView] booking card layout — re-pin latest", { threadId });
    scrollToLatest(false, "booking-card", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.bookingId, threadId]);

  const handleScroll = (event: {
    nativeEvent: {
      contentOffset: { y: number };
      contentSize: { height: number };
      layoutMeasurement: { height: number };
    };
  }) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromEnd =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    nearBottomRef.current = distanceFromEnd <= NEAR_BOTTOM_PX;
  };

  const handleLoadOlder = () => {
    if (!hasMore || loadingOlder || !onLoadOlder) return;
    skipAutoScrollRef.current = true;
    console.log("[MessageThreadView] load earlier pressed", { threadId });
    logger.info("MessageThreadView", "load earlier pressed", { threadId });
    void onLoadOlder();
  };

  useEffect(() => {
    console.log("[MessageThreadView] mount", {
      threadId,
      platform: Platform.OS,
      hasBooking: Boolean(booking),
      messageCount: messages.length,
      keyboard: "paddingBottom-from-Keyboard-events",
      safeBottom: insets.bottom,
    });
    logger.debug("MessageThreadView", "mount", {
      threadId,
      platform: Platform.OS,
      keyboard: "paddingBottom-from-Keyboard-events",
      hasBooking: Boolean(booking),
      safeBottom: insets.bottom,
    });

    const animateKeyboard = (duration?: number) => {
      const ms = typeof duration === "number" && duration > 0 ? duration : 250;
      LayoutAnimation.configureNext({
        duration: ms,
        update: {
          type:
            Platform.OS === "ios"
              ? LayoutAnimation.Types.keyboard
              : LayoutAnimation.Types.easeInEaseOut,
        },
      });
    };

    // iOS: will* so padding lifts with the keyboard animation.
    const willShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        const height = e.endCoordinates?.height ?? 0;
        animateKeyboard(e.duration);
        setKeyboardHeight(height);
        console.log("[MessageThreadView] keyboard show — pad chat body", {
          threadId,
          height,
          platform: Platform.OS,
          duration: e.duration,
        });
        logger.debug("MessageThreadView", "keyboard show — pad chat body", {
          height,
          threadId,
          platform: Platform.OS,
        });
        if (nearBottomRef.current) {
          requestAnimationFrame(() => {
            listRef.current?.scrollToEnd({ animated: false });
          });
        }
      },
    );
    const willHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      (e) => {
        animateKeyboard(e.duration);
        setKeyboardHeight(0);
        console.log("[MessageThreadView] keyboard hide", { threadId });
        logger.debug("MessageThreadView", "keyboard hide", { threadId });
      },
    );

    return () => {
      willShow.remove();
      willHide.remove();
      clearScrollTimers();
      logger.debug("MessageThreadView", "unmount", { threadId });
    };
  }, [threadId, insets.bottom]);

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
    <View style={styles.root}>
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

      <View
        style={[
          styles.chatBody,
          keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : null,
        ]}
      >
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          // Only after open jump — MVCP on iOS often cancels scrollToEnd/scrollToIndex.
          maintainVisibleContentPosition={
            historyAnchoring ? { minIndexForVisible: 0 } : undefined
          }
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={handleContentSizeChange}
          onScrollToIndexFailed={(info) => {
            console.log("[MessageThreadView] scrollToIndexFailed — retry", {
              threadId,
              index: info.index,
              averageLength: info.averageItemLength,
            });
            logger.warn("MessageThreadView", "scrollToIndexFailed — retry", {
              threadId,
              index: info.index,
            });
            const timer = setTimeout(() => {
              listRef.current?.scrollToEnd({ animated: false });
              try {
                listRef.current?.scrollToIndex({
                  index: info.index,
                  animated: false,
                  viewPosition: 1,
                });
              } catch {
                // ignore
              }
            }, 80);
            scrollTimersRef.current.push(timer);
          }}
          ListHeaderComponent={
            hasMore ? (
              <Pressable
                onPress={handleLoadOlder}
                disabled={loadingOlder}
                style={({ pressed }) => [
                  styles.loadEarlier,
                  pressed && styles.loadEarlierPressed,
                ]}
              >
                {loadingOlder ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={styles.loadEarlierText}>Load earlier messages</Text>
                )}
              </Pressable>
            ) : null
          }
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
          <View>
            <View style={styles.chips}>
              {QUICK_CHIPS.map((chip) => (
                <Pressable
                  key={chip}
                  disabled={busy}
                  onPress={() => {
                    console.log("[MessageThreadView] quick chip", { threadId, chip });
                    logger.debug("MessageThreadView", "quick chip", { threadId, chip });
                    handleSend(chip);
                  }}
                  style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                >
                  <Text style={styles.chipText}>{chip}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.composer, { paddingBottom: composerPadBottom }]}>
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
                ref={inputRef}
                nativeID="chat-input"
                value={body}
                onChangeText={onChangeBody}
                placeholder="Message"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                editable={!pickingImage}
                blurOnSubmit={false}
                onSubmitEditing={() => {
                  if (!body.trim()) return;
                  console.log("[MessageThreadView] send submit", { threadId, len: body.trim().length });
                  logger.debug("MessageThreadView", "send submit", { threadId });
                  handleSend();
                }}
                returnKeyType="send"
              />
              <Pressable
                disabled={busy || !body.trim()}
                onPress={() => {
                  console.log("[MessageThreadView] send", { threadId, len: body.trim().length });
                  logger.debug("MessageThreadView", "send press", { threadId });
                  handleSend();
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
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  chatBody: { flex: 1 },
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
  loadEarlier: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginBottom: 4,
  },
  loadEarlierPressed: {
    opacity: 0.7,
  },
  loadEarlierText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 0.3,
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
