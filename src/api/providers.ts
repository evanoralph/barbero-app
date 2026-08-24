import { apiRequest } from "@/src/api/client";
import type {
  MyProviderPortfolioPage,
  MyProviderPortfolioQuery,
  MyProviderServicesPage,
  MyProviderServicesQuery,
  ProviderAnalytics,
  ProviderAnalyticsRange,
  ProviderListItem,
  ProviderMapMarker,
  ProviderProfile,
  Review,
  UpdateProviderProfileInput,
} from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export function listProviders(params?: {
  category?: string;
  q?: string;
  sort?: "rating" | "name" | "newest";
  featured?: boolean;
  premium?: boolean;
}) {
  logger.debug("providers-api", "listProviders", params);
  return apiRequest<ProviderListItem[]>("/providers", {
    auth: false,
    query: {
      category: params?.category,
      q: params?.q,
      sort: params?.sort,
      featured: params?.featured,
      premium: params?.premium,
    },
  });
}

export function getProvider(slug: string) {
  return apiRequest<ProviderProfile>(`/providers/${encodeURIComponent(slug)}`, {
    auth: false,
  });
}

export function getProviderReviews(slug: string) {
  return apiRequest<Review[]>(`/providers/${encodeURIComponent(slug)}/reviews`, {
    auth: false,
  });
}

export function getProviderSlots(slug: string, date: string) {
  return apiRequest<{ times: string[] }>(
    `/providers/${encodeURIComponent(slug)}/slots`,
    { auth: false, query: { date } },
  );
}

export function listProvidersMap(params?: {
  category?: string;
  swLat?: number;
  swLng?: number;
  neLat?: number;
  neLng?: number;
}) {
  logger.debug("providers-api", "listProvidersMap", params);
  return apiRequest<ProviderMapMarker[]>("/providers/map", {
    auth: false,
    query: {
      category: params?.category,
      swLat: params?.swLat,
      swLng: params?.swLng,
      neLat: params?.neLat,
      neLng: params?.neLng,
    },
  });
}

export function getMyProvider() {
  return apiRequest<ProviderProfile>("/providers/me");
}

export function listMyPortfolio(params?: MyProviderPortfolioQuery) {
  logger.debug("providers-api", "listMyPortfolio", params);
  return apiRequest<MyProviderPortfolioPage>("/providers/me/portfolio", {
    query: {
      limit: params?.limit,
      page: params?.page,
      q: params?.q,
      filter: params?.filter,
    },
  });
}

export function listMyServices(params?: MyProviderServicesQuery) {
  logger.debug("providers-api", "listMyServices", params);
  return apiRequest<MyProviderServicesPage>("/providers/me/services", {
    query: {
      limit: params?.limit,
      page: params?.page,
      q: params?.q,
      category: params?.category,
    },
  });
}

export function updateMyProvider(body: UpdateProviderProfileInput) {
  logger.info("providers-api", "updateMyProvider", Object.keys(body));
  return apiRequest<ProviderProfile>("/providers/me", {
    method: "PATCH",
    body,
  });
}

export function getMyAnalytics(range: ProviderAnalyticsRange = "30days") {
  logger.debug("providers-api", "getMyAnalytics", { range });
  return apiRequest<ProviderAnalytics>("/providers/me/analytics", {
    query: { range },
  });
}
