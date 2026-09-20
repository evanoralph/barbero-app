import { apiRequest } from "@/src/api/client";
import { logger } from "@/src/utils/logger";

export type UploadKind =
  | "provider-avatar"
  | "provider-cover"
  | "provider-portfolio"
  | "provider-service"
  | "provider-proof"
  | "provider-gov-id"
  | "provider-selfie"
  | "message-attachment";

export type PresignUploadResponse = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
};

export async function requestPresignedUpload(input: {
  kind: UploadKind;
  contentType: string;
  fileName?: string;
  serviceId?: string;
  threadId?: string;
  contentLength?: number;
}): Promise<PresignUploadResponse> {
  logger.info("uploads", "request presign", input);
  return apiRequest<PresignUploadResponse>("/uploads/presign", {
    method: "POST",
    body: input,
  });
}

function guessContentType(uri: string, mimeType?: string | null): string {
  if (mimeType) return mimeType;
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function fileNameFromUri(uri: string): string {
  const parts = uri.split("/");
  const last = parts[parts.length - 1];
  return last && last.includes(".") ? last : `upload-${Date.now()}.jpg`;
}

export async function uploadImageUriToS3(
  uri: string,
  kind: UploadKind,
  opts?: {
    mimeType?: string | null;
    serviceId?: string;
    threadId?: string;
    contentLength?: number;
  },
): Promise<string> {
  const contentType = guessContentType(uri, opts?.mimeType);
  const fileName = fileNameFromUri(uri);

  logger.info("uploads", "upload start", {
    kind,
    contentType,
    fileName,
    threadId: opts?.threadId,
    contentLength: opts?.contentLength,
  });
  console.log("[uploads] upload start", {
    kind,
    contentType,
    threadId: opts?.threadId,
    contentLength: opts?.contentLength,
  });

  const fileRes = await fetch(uri);
  const blob = await fileRes.blob();
  const contentLength = opts?.contentLength ?? blob.size;

  if (kind === "message-attachment" && contentLength > 1 * 1024 * 1024) {
    console.log("[uploads] reject oversize chat image", { contentLength });
    logger.warn("uploads", "reject oversize chat image", { contentLength });
    throw new Error("Photo must be under 1MB. Try a smaller or less detailed image.");
  }

  const presigned = await requestPresignedUpload({
    kind,
    contentType,
    fileName,
    serviceId: opts?.serviceId,
    threadId: opts?.threadId,
    contentLength,
  });

  const putRes = await fetch(presigned.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: blob,
  });

  if (!putRes.ok) {
    const preview = await putRes.text().catch(() => "");
    logger.error("uploads", "upload failed", {
      kind,
      status: putRes.status,
      preview: preview.slice(0, 120),
    });
    throw new Error(`Upload failed (${putRes.status})`);
  }

  logger.info("uploads", "upload ok", { kind, publicUrl: presigned.publicUrl });
  console.log("[uploads] upload ok", { kind, publicUrl: presigned.publicUrl });
  return presigned.publicUrl;
}
