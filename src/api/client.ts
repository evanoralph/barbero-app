import { Platform } from "react-native";
import { logger } from "@/src/utils/logger";
import type { ApiFailure, ApiSuccess } from "@/src/types/api";

const DEFAULT_API = "http://localhost:4000/api/v1";
/** Android emulator loopback to the host machine (localhost on device is the emulator itself). */
const ANDROID_EMULATOR_HOST = "10.0.2.2";

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
let loggedBaseUrl = false;

export function setApiTokenGetter(getter: () => string | null) {
  tokenGetter = getter;
}

/** Rewrite localhost → 10.0.2.2 on Android so emulator can reach the host API over HTTP. */
function resolveApiBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/$/, "");
  if (Platform.OS !== "android") return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      const previous = url.hostname;
      url.hostname = ANDROID_EMULATOR_HOST;
      const resolved = url.toString().replace(/\/$/, "");
      logger.info("api", "android cleartext host rewrite", {
        from: previous,
        to: ANDROID_EMULATOR_HOST,
        baseUrl: resolved,
      });
      return resolved;
    }
  } catch (error) {
    logger.warn("api", "failed to parse API base URL for android rewrite", { raw: trimmed, error });
  }

  return trimmed;
}

export function getApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API;
  const base = resolveApiBaseUrl(raw);
  if (!loggedBaseUrl) {
    loggedBaseUrl = true;
    logger.info("api", "API base URL ready", {
      platform: Platform.OS,
      configured: raw,
      resolved: base,
      cleartextHttp: base.startsWith("http://"),
    });
  }
  return base;
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
