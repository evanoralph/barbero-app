import { apiRequest } from "@/src/api/client";
import type { EstablishmentListItem } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export function listEstablishments(params?: {
  category?: string;
  q?: string;
  featured?: boolean;
  limit?: number;
}) {
  logger.debug("establishments-api", "listEstablishments", params);
  return apiRequest<EstablishmentListItem[]>("/establishments", {
    auth: false,
    query: {
      category: params?.category,
      q: params?.q,
      featured: params?.featured,
      limit: params?.limit,
    },
  });
}

/** Public marketing site base for opening establishment shop pages in browser. */
export function publicWebBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const privacy = process.env.EXPO_PUBLIC_PRIVACY_URL?.trim();
  if (privacy) {
    try {
      return new URL(privacy).origin;
    } catch {
      /* ignore */
    }
  }
  return "https://beru.digital";
}

export function establishmentPublicUrl(slug: string): string {
  return `${publicWebBaseUrl()}/establishments/${encodeURIComponent(slug)}`;
}
