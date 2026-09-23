import { Star } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, Muted, Title } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { logger } from "@/src/utils/logger";

type Props = {
  visible: boolean;
  providerName?: string;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (input: { rating: number; comment: string }) => void;
};

export function LeaveBookingReviewModal({
  visible,
  providerName,
  submitting = false,
  error = null,
  onClose,
  onSubmit,
}: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!visible) return;
    setRating(5);
    setComment("");
    logger.info("leave-review", "modal open", { providerName });
    console.log("[leave-review] modal open", { providerName });
  }, [visible, providerName]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Title>{providerName ? `Review ${providerName}` : "Leave a review"}</Title>
          <Muted style={styles.desc}>
            Rate this completed booking. One review per visit.
          </Muted>

          <Text style={styles.label}>Rating</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => {
              const active = star <= rating;
              return (
                <Pressable
                  key={star}
                  hitSlop={8}
                  disabled={submitting}
                  onPress={() => {
                    setRating(star);
                    console.log("[leave-review] rating", star);
                  }}
                  accessibilityLabel={`Rate ${star} stars`}
                >
                  <Star
                    size={28}
                    color={active ? colors.text : colors.textMuted}
                    fill={active ? colors.text : "transparent"}
                  />
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Comment</Text>
          <TextInput
            style={styles.input}
            value={comment}
            onChangeText={setComment}
            placeholder="Share your experience…"
            placeholderTextColor={colors.textMuted}
            multiline
            editable={!submitting}
            textAlignVertical="top"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" onPress={onClose} disabled={submitting} />
            <Button
              label={submitting ? "Submitting…" : "Submit review"}
              onPress={() => {
                logger.info("leave-review", "submit", { rating, length: comment.trim().length });
                console.log("[leave-review] submit", { rating });
                onSubmit({ rating, comment: comment.trim() });
              }}
              disabled={submitting || !comment.trim()}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 10,
  },
  desc: { marginBottom: 4 },
  label: {
    color: colors.text,
    fontSize: 13,
    fontFamily: fonts.monoMedium,
    marginTop: 4,
  },
  stars: { flexDirection: "row", gap: 8, marginBottom: 4 },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.mono,
    backgroundColor: colors.bg,
  },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.mono },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
});
