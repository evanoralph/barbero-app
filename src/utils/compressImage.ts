import { Image } from "react-native";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { logger } from "@/src/utils/logger";

const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.7;
/** Hard cap after compression for booking-chat photos. */
export const MAX_CHAT_IMAGE_BYTES = 1 * 1024 * 1024;

export type CompressedImage = {
  uri: string;
  mimeType: "image/jpeg";
  width: number;
  height: number;
  beforeBytes?: number;
  afterBytes?: number;
};

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err ?? new Error("Unable to read image size")),
    );
  });
}

async function compressOnce(
  uri: string,
  maxEdge: number,
  quality: number,
): Promise<{ uri: string; width: number; height: number; afterBytes: number }> {
  const { width: srcW, height: srcH } = await getImageSize(uri);
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
  const targetW = Math.max(1, Math.round(srcW * scale));
  const targetH = Math.max(1, Math.round(srcH * scale));

  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: targetW, height: targetH });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: quality,
  });
  const afterBytes = await measureUriBytes(result.uri);
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    afterBytes,
  };
}

/**
 * Resize + JPEG-compress for chat uploads. Retries with smaller settings
 * until under {@link MAX_CHAT_IMAGE_BYTES} (1MB).
 */
export async function compressImageForUpload(
  uri: string,
  opts?: { maxEdge?: number; quality?: number },
): Promise<CompressedImage> {
  const attempts: Array<{ maxEdge: number; quality: number }> = [
    { maxEdge: opts?.maxEdge ?? MAX_EDGE_PX, quality: opts?.quality ?? JPEG_QUALITY },
    { maxEdge: 1200, quality: 0.55 },
    { maxEdge: 960, quality: 0.4 },
  ];

  const beforeBytes = await measureUriBytes(uri);
  console.log("[compressImage] start", {
    uri: uri.slice(0, 80),
    beforeBytes,
    maxBytes: MAX_CHAT_IMAGE_BYTES,
  });
  logger.info("compressImage", "start", { beforeBytes, maxBytes: MAX_CHAT_IMAGE_BYTES });

  let last: { uri: string; width: number; height: number; afterBytes: number } | null = null;

  for (let i = 0; i < attempts.length; i += 1) {
    const { maxEdge, quality } = attempts[i]!;
    const sourceUri = last?.uri ?? uri;
    last = await compressOnce(sourceUri, maxEdge, quality);
    console.log("[compressImage] pass", {
      pass: i + 1,
      maxEdge,
      quality,
      width: last.width,
      height: last.height,
      afterBytes: last.afterBytes,
    });
    if (last.afterBytes <= MAX_CHAT_IMAGE_BYTES) {
      logger.info("compressImage", "done", {
        pass: i + 1,
        width: last.width,
        height: last.height,
        beforeBytes,
        afterBytes: last.afterBytes,
      });
      return {
        uri: last.uri,
        mimeType: "image/jpeg",
        width: last.width,
        height: last.height,
        beforeBytes,
        afterBytes: last.afterBytes,
      };
    }
  }

  console.log("[compressImage] still too large", {
    afterBytes: last?.afterBytes,
    max: MAX_CHAT_IMAGE_BYTES,
  });
  logger.warn("compressImage", "still too large", { afterBytes: last?.afterBytes });
  throw new Error("Photo must be under 1MB. Try a smaller or less detailed image.");
}

/** Approximate size via fetch blob (for logs + soft cap). */
export async function measureUriBytes(uri: string): Promise<number> {
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    return blob.size;
  } catch (e) {
    console.log("[compressImage] measureUriBytes failed", e);
    logger.warn("compressImage", "measureUriBytes failed", e);
    return 0;
  }
}
