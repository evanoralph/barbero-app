import { logger } from "@/src/utils/logger";
import type { ApiFailure, ApiSuccess } from "@/src/types/api";

const DEFAULT_API = "http://localhost:4000/api/v1";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

let tokenGetter: (() => string | null) | null = null;

export function setApiTokenGetter(getter: () => string | null) {
  tokenGetter = getter;
}

export function getApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API;
  return raw.replace(/\/$/, "");
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined>;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = getApiBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const qs = query
    ? Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join("&")
    : "";
  return qs ? `${base}${normalized}?${qs}` : `${base}${normalized}`;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, query } = options;
  const url = buildUrl(path, query);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (auth) {
    const token = tokenGetter?.() ?? null;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  logger.debug("api", `${method} ${path}`, { auth, query });

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    logger.error("api", `network error ${method} ${path}`, error);
    throw new ApiError("Network error — is the Meteor API running?", "NETWORK", 0, error);
  }

  let payload: ApiSuccess<T> | ApiFailure | null = null;
  try {
    payload = (await response.json()) as ApiSuccess<T> | ApiFailure;
  } catch {
    logger.error("api", `invalid JSON ${method} ${path}`, { status: response.status });
    throw new ApiError("Invalid API response", "INVALID_JSON", response.status);
  }

  if (!response.ok || !payload || payload.ok !== true) {
    const failure = payload && "error" in payload ? payload.error : null;
    const message = failure?.message ?? `Request failed (${response.status})`;
    const code = failure?.code ?? "HTTP_ERROR";
    logger.warn("api", `${method} ${path} failed`, { status: response.status, code, message });
    throw new ApiError(message, code, response.status, failure?.details);
  }

  logger.debug("api", `${method} ${path} ok`, { status: response.status });
  return payload.data;
}

export async function checkHealth(): Promise<void> {
  try {
    await apiRequest<{ status: string }>("/health", { auth: false });
    logger.info("api", "health ok");
  } catch (error) {
    logger.warn("api", "health check failed", error);
  }
}
