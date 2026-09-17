import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Image, StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/src/api/client";
import { submitProviderApply } from "@/src/api/providerApply";
import { uploadImageUriToS3 } from "@/src/api/uploads";
import { Button, Muted, Screen, Title } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import type { ProofDocument } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

const MAX_PROOFS = 3;

export default function ApplyProofsScreen() {
  const [proofs, setProofs] = useState<ProofDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAddProof = async () => {
    if (proofs.length >= MAX_PROOFS) return;
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Allow photo library access to upload documents.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setUploading(true);
      const url = await uploadImageUriToS3(asset.uri, "provider-proof", {
        mimeType: asset.mimeType,
      });
      setProofs((prev) => [
        ...prev,
        {
          url,
          fileName: asset.fileName ?? `proof-${Date.now()}.jpg`,
          contentType: asset.mimeType ?? "image/jpeg",
          uploadedAt: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Upload failed";
      setError(msg);
      logger.warn("apply-proofs", "upload failed", e);
    } finally {
      setUploading(false);
    }
  };

  const onRemoveProof = (url: string) => {
    setProofs((prev) => prev.filter((p) => p.url !== url));
  };

  const onSubmit = async () => {
    setError(null);
    if (proofs.length < 1) {
      setError("Add at least one proof document");
      return;
    }
    setSubmitting(true);
    try {
      await submitProviderApply({ proofDocuments: proofs });
      router.replace("/(auth)/apply/done");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to submit application");
      logger.warn("apply-proofs", "submit failed", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll>
      <Title>Proof documents</Title>
      <Muted>Upload 1-3 documents (business permit, ID, portfolio) so we can verify your application.</Muted>

      <View style={{ gap: 10 }}>
        {proofs.map((proof) => (
          <View key={proof.url} style={styles.proofRow}>
            <Image source={{ uri: proof.url }} style={styles.thumb} resizeMode="cover" />
            <Muted style={{ flex: 1 }}>{proof.fileName}</Muted>
            <Button label="Remove" variant="ghost" onPress={() => onRemoveProof(proof.url)} />
          </View>
        ))}
      </View>

      {proofs.length < MAX_PROOFS ? (
        <Button
          label={uploading ? "Uploading…" : "Add document"}
          variant="secondary"
          onPress={onAddProof}
          loading={uploading}
        />
      ) : null}

      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button
        label="Submit application"
        onPress={onSubmit}
        loading={submitting}
        disabled={proofs.length < 1}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  proofRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: colors.border },
});
