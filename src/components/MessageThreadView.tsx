import { useEffect } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Field, Muted } from "@/src/components/ui";
import type { Message } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

type Props = {
  threadId: string;
  messages: Message[];
  userId?: string;
  body: string;
  onChangeBody: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  error?: string | null;
  emptyLabel?: string;
};

export function MessageThreadView({
  threadId,
  messages,
  userId,
  body,
  onChangeBody,
  onSend,
  sending,
  error,
  emptyLabel = "No messages yet — say hello.",
}: Props) {
  const insets = useSafeAreaInsets();
  const keyboardVerticalOffset = Platform.OS === "ios" ? insets.top + 56 : 0;

  useEffect(() => {
    logger.debug("MessageThreadView", "mount", {
      threadId,
      platform: Platform.OS,
      keyboardVerticalOffset,
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
  }, [threadId, keyboardVerticalOffset]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <Muted>Thread {threadId}</Muted>
        <FlatList
          data={messages}
          keyExtractor={(m) => m._id}
          contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListEmptyComponent={<Muted>{emptyLabel}</Muted>}
          renderItem={({ item }) => (
            <View
              style={{
                alignSelf: item.senderId === userId ? "flex-end" : "flex-start",
                backgroundColor:
                  item.senderId === userId ? colors.accent : colors.surface,
                padding: 10,
                borderRadius: 12,
                maxWidth: "80%",
              }}
            >
              <Text
                style={{
                  color: item.senderId === userId ? colors.bg : colors.text,
                }}
              >
                {item.body}
              </Text>
              <Text
                style={{
                  color:
                    item.senderId === userId
                      ? "rgba(10,10,10,0.55)"
                      : colors.textMuted,
                  fontSize: 11,
                  marginTop: 4,
                }}
              >
                {new Date(item.createdAt).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          )}
        />
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        <Field label="Message" value={body} onChangeText={onChangeBody} />
        <Button
          label="Send"
          onPress={onSend}
          loading={sending}
          disabled={!body.trim()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
