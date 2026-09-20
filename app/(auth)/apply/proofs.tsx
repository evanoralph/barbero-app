import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Image, StyleSheet, Text, View } from "react-native";
import { ApiError } from "@/src/api/client";
import { submitProviderApply } from "@/src/api/providerApply";
import { uploadImageUriToS3, type UploadKind } from "@/src/api/uploads";
import { Button, Muted, Screen, Title } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import type { ProofDocument } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

const MAX_PROOFS = 3;

type SlotKind = "gov-id" | "selfie" | "proof";

export default function ApplyProofsScreen() {
  const [governmentIdDocument, setGovernmentIdDocument] = useState<ProofDocument | null>(null);
  const [selfieWithId, setSelfieWithId] = useState<ProofDocument | null>(null);
  const [proofs, setProofs] = useState<ProofDocument[]>([]);
  const [uploadingSlot, setUploadingSlot] = useState<SlotKind | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    Boolean(governmentIdDocument) && Boolean(selfieWithId) && proofs.length >= 1;
  const uploading = uploadingSlot !== null;

  const pickAndUpload = async (opts: {
    slot: SlotKind;
    kind: UploadKind;
    source: "library" | "camera";
  }): Promise<ProofDocument | null> => {
    setError(null);
    try {
      if (opts.source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Permission needed", "Allow camera access to take a selfie with your ID.");
          return null;
        }
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Permission needed", "Allow photo library access to upload documents.");
          return null;
        }
      }

      const result =
        opts.source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              quality: 0.85,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.85,
            });

      if (result.canceled || !result.assets?.[0]) return null;

      const asset = result.assets[0];
      setUploadingSlot(opts.slot);
      logger.info("apply-proofs", "upload start", { slot: opts.slot, kind: opts.kind });
      const url = await uploadImageUriToS3(asset.uri, opts.kind, {
        mimeType: asset.mimeType,
      });
      const doc: ProofDocument = {
        url,
        fileName: asset.fileName ?? `${opts.slot}-${Date.now()}.jpg`,
        contentType: asset.mimeType ?? "image/jpeg",
        uploadedAt: new Date().toISOString(),
      };
      logger.info("apply-proofs", "upload ok", { slot: opts.slot, fileName: doc.fileName });
      return doc;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Upload failed";
      setError(msg);
      logger.warn("apply-proofs", "upload failed", { slot: opts.slot, error: e });
      return null;
    } finally {
      setUploadingSlot(null);
    }
  };

  const onAddGovId = async () => {
    const doc = await pickAndUpload({
      slot: "gov-id",
      kind: "provider-gov-id",
      source: "library",
    });
    if (doc) {
      logger.info("apply-proofs", "set governmentIdDocument", doc.fileName);
      setGovernmentIdDocument(doc);
    }
  };

  const onAddSelfie = async () => {
    Alert.alert("Selfie with ID", "Take a photo or choose from library?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Library",
        onPress: () => {
          void (async () => {
            const doc = await pickAndUpload({
              slot: "selfie",
              kind: "provider-selfie",
              source: "library",
            });
            if (doc) {
              logger.info("apply-proofs", "set selfieWithId (library)", doc.fileName);
              setSelfieWithId(doc);
            }
          })();
        },
      },
      {
        text: "Camera",
        onPress: () => {
          void (async () => {
            const doc = await pickAndUpload({
              slot: "selfie",
              kind: "provider-selfie",
              source: "camera",
            });
            if (doc) {
              logger.info("apply-proofs", "set selfieWithId (camera)", doc.fileName);
              setSelfieWithId(doc);
            }
          })();
        },
      },
    ]);
  };

  const onAddProof = async () => {
    if (proofs.length >= MAX_PROOFS) return;
    const doc = await pickAndUpload({
      slot: "proof",
      kind: "provider-proof",
      source: "library",
    });
    if (doc) {
      setProofs((prev) => [...prev, doc]);
      logger.info("apply-proofs", "added proof", { count: proofs.length + 1 });
    }
  };

  const onRemoveProof = (url: string) => {
    logger.info("apply-proofs", "remove proof");
    setProofs((prev) => prev.filter((p) => p.url !== url));
  };

  const onSubmit = async () => {
    setError(null);
    if (!governmentIdDocument) {
      setError("Upload your government-mandated ID");
      return;
    }
    if (!selfieWithId) {
      setError("Upload a selfie holding your ID");
      return;
    }
    if (proofs.length < 1) {
      setError("Add at least one proof of work document");
      return;
    }
    setSubmitting(true);
    try {
      logger.info("apply-proofs", "submit", {
        proofs: proofs.length,
        hasGovId: true,
        hasSelfie: true,
      });
      await submitProviderApply({
        proofDocuments: proofs,
        governmentIdDocument,
        selfieWithId,
      });
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
      <Title>Verify your identity</Title>
      <Muted>
        Upload your government ID, a selfie holding that ID, and 1–3 proof of work documents.
      </Muted>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Government ID</Text>
        <Muted>Required — national ID, driver’s license, or passport.</Muted>
        {governmentIdDocument ? (
          <DocRow
            doc={governmentIdDocument}
            onRemove={() => {
              logger.info("apply-proofs", "remove governmentIdDocument");
              setGovernmentIdDocument(null);
            }}
            onReplace={onAddGovId}
          />
        ) : (
          <Button
            label={uploadingSlot === "gov-id" ? "Uploading…" : "Upload government ID"}
            variant="secondary"
            onPress={onAddGovId}
            loading={uploadingSlot === "gov-id"}
            disabled={uploading}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Selfie with ID</Text>
        <Muted>Required — clear photo of you holding the same ID.</Muted>
        {selfieWithId ? (
          <DocRow
            doc={selfieWithId}
            onRemove={() => {
              logger.info("apply-proofs", "remove selfieWithId");
              setSelfieWithId(null);
            }}
            onReplace={onAddSelfie}
          />
        ) : (
          <Button
            label={uploadingSlot === "selfie" ? "Uploading…" : "Take selfie with ID"}
            variant="secondary"
            onPress={onAddSelfie}
            loading={uploadingSlot === "selfie"}
            disabled={uploading}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Proof of work</Text>
        <Muted>Required — license, portfolio, or shop photos (1–{MAX_PROOFS}).</Muted>

        <View style={{ gap: 10 }}>
          {proofs.map((proof) => (
            <DocRow
              key={proof.url}
              doc={proof}
              onRemove={() => onRemoveProof(proof.url)}
            />
          ))}
        </View>

        {proofs.length < MAX_PROOFS ? (
          <Button
            label={uploadingSlot === "proof" ? "Uploading…" : "Add proof of work"}
            variant="secondary"
            onPress={onAddProof}
            loading={uploadingSlot === "proof"}
            disabled={uploading}
          />
        ) : null}
      </View>

      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button
        label="Submit application"
        onPress={onSubmit}
        loading={submitting}
        disabled={!canSubmit || uploading}
      />
    </Screen>
  );
}

function DocRow({
  doc,
  onRemove,
  onReplace,
}: {
  doc: ProofDocument;
  onRemove: () => void;
  onReplace?: () => void;
}) {
  return (
    <View style={styles.proofRow}>
      <Image source={{ uri: doc.url }} style={styles.thumb} resizeMode="cover" />
      <Muted style={{ flex: 1 }}>{doc.fileName}</Muted>
      {onReplace ? (
        <Button label="Replace" variant="ghost" onPress={onReplace} />
      ) : null}
      <Button label="Remove" variant="ghost" onPress={onRemove} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8, marginTop: 8 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
  proofRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: colors.border },
});
