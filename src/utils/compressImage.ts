import { Image } from "react-native";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { logger } from "@/src/utils/logger";

const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.7;
/** Soft cap after compression (~2MB). */
export const MAX_CHAT_IMAGE_BYTES = 2 * 1024 * 1024;

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

/**
 * Resize so longest edge is ≤1600px and JPEG-compress for chat / proof uploads.
 */
export async function compressImageForUpload(
  uri: string,
  opts?: { maxEdge?: number; quality?: number },
): Promise<CompressedImage> {
  const maxEdge = opts?.maxEdge ?? MAX_EDGE_PX;
  const quality = opts?.quality ?? JPEG_QUALITY;

  const beforeBytes = await measureUriBytes(uri);
  console.log("[compressImage] start", {
    uri: uri.slice(0, 80),
    maxEdge,
    quality,
    beforeBytes,
  });
  logger.info("compressImage", "start", { maxEdge, quality, beforeBytes });

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
  console.log("[compressImage] done", {
    width: result.width,
    height: result.height,
    beforeBytes,
    afterBytes,
    outUri: result.uri.slice(0, 80),
  });
  logger.info("compressImage", "done", {
    width: result.width,
    height: result.height,
    beforeBytes,
    afterBytes,
  });

  if (afterBytes > MAX_CHAT_IMAGE_BYTES) {
    console.log("[compressImage] still too large", { afterBytes, max: MAX_CHAT_IMAGE_BYTES });
    logger.warn("compressImage", "still too large", { afterBytes });
    throw new Error("Image is still too large after compression. Try a smaller photo.");
  }

  return {
    uri: result.uri,
    mimeType: "image/jpeg",
    width: result.width,
    height: result.height,
    beforeBytes,
    afterBytes,
  };
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
