import * as ImagePicker from "expo-image-picker";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Alert, Image, StyleSheet, View } from "react-native";
import { uploadImageUriToS3, type UploadKind } from "@/src/api/uploads";
import { Button, Field, Muted } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

export type ImageUploadFieldHandle = {
  /**
   * In `uploadMode="manual"`, this uploads the selected local image (if any)
   * and returns the final URL (or `""` if none is available).
   *
   * In `uploadMode="immediate"`, this simply returns the current `value`.
   */
  uploadNow: () => Promise<string>;
};

export type ImageUploadMode = "immediate" | "manual";

type ImageUploadFieldProps = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  kind: UploadKind;
  serviceId?: string;
  previewStyle?: object;
  placeholder?: string;
  uploadMode?: ImageUploadMode;
  hideUrlInput?: boolean;
};

export const ImageUploadField = forwardRef<ImageUploadFieldHandle, ImageUploadFieldProps>(
  (
    {
      label,
      value,
      onChange,
      kind,
      serviceId,
      previewStyle,
      placeholder = "https://…",
      uploadMode = "immediate",
      hideUrlInput = false,
    },
    ref,
  ) => {
  const [uploading, setUploading] = useState(false);
  const [pendingAsset, setPendingAsset] = useState<{
    uri: string;
    mimeType?: string | null;
    fileName?: string | null;
  } | null>(null);

  // In manual mode, if the user types/pastes a URL, we clear any pending
  // local selection so "Add" won't upload the wrong image.
  useEffect(() => {
    if (uploadMode !== "manual") return;
    if (value.trim()) {
      setPendingAsset(null);
    }
  }, [uploadMode, value]);

  const previewUri = (pendingAsset?.uri ?? value).trim();

  const pickAndUploadImmediate = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      logger.debug("image-upload", "permission", { kind, status: permission.status });
      if (!permission.granted) {
        Alert.alert("Permission needed", "Allow photo library access to upload images.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsEditing: kind === "provider-avatar",
        aspect: kind === "provider-avatar" ? [1, 1] : undefined,
      });

      if (result.canceled || !result.assets?.[0]) {
        logger.debug("image-upload", "picker cancelled", { kind });
        return;
      }

      const asset = result.assets[0];
      logger.info("image-upload", "immediate picked", {
        kind,
        fileUri: asset.uri,
        mimeType: asset.mimeType ?? null,
        allowsEditing: kind === "provider-avatar",
      });
      console.log("[image-upload] immediate picked", {
        kind,
        mimeType: asset.mimeType ?? null,
        uri: asset.uri.slice(0, 80),
      });
      setUploading(true);
      const publicUrl = await uploadImageUriToS3(asset.uri, kind, {
        mimeType: asset.mimeType,
        fileName: asset.fileName,
        serviceId,
      });
      onChange(publicUrl);
      logger.info("image-upload", "set url", { kind, publicUrl });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      logger.error("image-upload", "failed", { kind, msg, error });
      Alert.alert("Upload failed", msg);
    } finally {
      setUploading(false);
    }
  };

  const pickManual = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      logger.debug("image-upload", "permission", { kind, status: permission.status });
      if (!permission.granted) {
        Alert.alert("Permission needed", "Allow photo library access to upload images.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsEditing: kind === "provider-avatar",
        aspect: kind === "provider-avatar" ? [1, 1] : undefined,
      });

      if (result.canceled || !result.assets?.[0]) {
        logger.debug("image-upload", "picker cancelled", { kind });
        return;
      }

      const asset = result.assets[0];
      setPendingAsset({
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
      });
      logger.info("image-upload", "manual picked (deferred)", {
        kind,
        fileUri: asset.uri,
        mimeType: asset.mimeType ?? null,
        fileName: asset.fileName ?? null,
      });
      console.log("[image-upload] manual picked", {
        kind,
        mimeType: asset.mimeType ?? null,
        fileName: asset.fileName ?? null,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Select failed";
      logger.error("image-upload", "manual pick failed", { kind, msg, error });
      Alert.alert("Select failed", msg);
    }
  };

  const uploadNow = async (): Promise<string> => {
    // Immediate mode is always already uploaded by the picker.
    if (uploadMode !== "manual") return value.trim();

    if (!pendingAsset?.uri) {
      logger.debug("image-upload", "manual uploadNow: no pending asset", { kind });
      return value.trim();
    }

    try {
      setUploading(true);
      logger.info("image-upload", "manual uploadNow: upload start", {
        kind,
        fileUri: pendingAsset.uri,
        mimeType: pendingAsset.mimeType ?? null,
      });
      const publicUrl = await uploadImageUriToS3(pendingAsset.uri, kind, {
        mimeType: pendingAsset.mimeType,
        fileName: pendingAsset.fileName,
        serviceId,
      });
      onChange(publicUrl);
      logger.info("image-upload", "manual uploadNow: set url", { kind, publicUrl });
      setPendingAsset(null);
      return publicUrl;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      logger.error("image-upload", "manual uploadNow failed", { kind, msg, error });
      Alert.alert("Upload failed", msg);
      return "";
    } finally {
      setUploading(false);
    }
  };

  useImperativeHandle(ref, () => ({ uploadNow }), [ref, uploadNow]);

  return (
    <View style={{ gap: 8 }}>
      {hideUrlInput && label ? <Muted>{label}</Muted> : null}
      {previewUri ? (
        <Image
          source={{ uri: previewUri }}
          style={[styles.preview, previewStyle]}
          resizeMode="cover"
          onError={() => logger.warn("image-upload", "preview failed", { kind, previewUri })}
        />
      ) : (
        <Muted>
          {hideUrlInput
            ? "No photo yet. Tap below to select one."
            : "Image preview appears when you enter a URL or select a photo."}
        </Muted>
      )}
      {!hideUrlInput ? (
        <Field
          label={label}
          value={value}
          onChangeText={onChange}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={placeholder}
        />
      ) : null}
      <Button
        label={uploading ? "Uploading…" : uploadMode === "manual" ? "Select photo" : "Upload image"}
        variant="secondary"
        onPress={() => {
          void (uploadMode === "manual" ? pickManual() : pickAndUploadImmediate());
        }}
        loading={uploading}
      />
    </View>
  );
  },
);

const styles = StyleSheet.create({
  preview: {
    width: "100%",
    height: 140,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
});
