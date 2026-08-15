import SimpleDDP from "simpleddp";
import { simpleDDPLogin } from "simpleddp-plugin-login";
import { getApiBaseUrl } from "@/src/api/client";
import { logger } from "@/src/utils/logger";

export type MobileDdp = SimpleDDP;

const CONNECT_TIMEOUT_MS = 15_000;
const DEFAULT_DDP = "ws://localhost:4000/websocket";

let instance: MobileDdp | null = null;

function ddpUrlFromApiBase(apiBase: string): string {
  try {
    const u = new URL(apiBase);
    const wsScheme = u.protocol === "https:" ? "wss:" : "ws:";
    return `${wsScheme}//${u.host}/websocket`;
  } catch {
    return DEFAULT_DDP;
  }
}

export function publicDdpWebSocketUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_DDP_URL?.trim();
  if (explicit) {
    try {
      const api = new URL(getApiBaseUrl());
      const ddp = new URL(explicit);
      if (
        (ddp.hostname === "localhost" || ddp.hostname === "127.0.0.1") &&
        api.hostname !== ddp.hostname
      ) {
        ddp.hostname = api.hostname;
        const rewritten = ddp.toString().replace(/\/$/, "");
        logger.info("ddp", "rewrote DDP host to match API", {
          from: explicit,
          to: rewritten,
        });
        return rewritten;
      }
    } catch (error) {
      logger.warn("ddp", "failed to rewrite EXPO_PUBLIC_API_DDP_URL", error);
    }
    return explicit;
  }
  return ddpUrlFromApiBase(getApiBaseUrl());
}

export function getMobileDdp(): MobileDdp {
  if (!instance) {
    const endpoint = publicDdpWebSocketUrl();
    logger.info("ddp", "creating SimpleDDP client", { endpoint });
    instance = new SimpleDDP(
      {
        endpoint,
        SocketConstructor: WebSocket,
        reconnectInterval: 4000,
        maxTimeout: 60_000,
        autoConnect: false,
      },
      [simpleDDPLogin],
    );
  }
  return instance;
}

export async function connectMobileDdp(timeoutMs = CONNECT_TIMEOUT_MS): Promise<MobileDdp> {
  const endpoint = publicDdpWebSocketUrl();
  const ddp = getMobileDdp();
  if (ddp.connected) return ddp;
  logger.info("ddp", "connecting", { endpoint });
  await Promise.race([
    ddp.connect(),
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        reject(new Error(`No DDP connection to ${endpoint} after ${timeoutMs / 1000}s`));
      }, timeoutMs),
    ),
  ]);
  logger.info("ddp", "connected", { endpoint });
  return ddp;
}

export async function meteorCall<T>(method: string, ...args: unknown[]): Promise<T> {
  const ddp = await connectMobileDdp();
  return (await ddp.call(method, ...args)) as T;
}

export async function meteorCallSafe<T>(
  method: string,
  ...args: unknown[]
): Promise<{ ok: true; data: T } | { ok: false; error: unknown }> {
  try {
    const data = await meteorCall<T>(method, ...args);
    return { ok: true, data };
  } catch (error) {
    logger.warn("ddp", "method failed", { method, error });
    return { ok: false, error };
  }
}

export async function logoutMobileDdpSafe(): Promise<void> {
  if (!instance || !instance.connected) {
    logger.debug("ddp", "skip logout; not connected");
    return;
  }
  try {
    await instance.logout();
    logger.info("ddp", "logged out");
  } catch (error) {
    logger.warn("ddp", "logout failed", error);
  }
}
