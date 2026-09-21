import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  checkHealth,
  setServerReachableHandler,
  setServerUnavailableHandler,
} from "@/src/api/client";
import { flushQueue } from "@/src/offline/queue";
import { logger } from "@/src/utils/logger";

const RECOVERY_POLL_MS = 8000;

type ServerStatusState = {
  /** null while the initial boot health check is in flight. false only before we ever connected. */
  serverAvailable: boolean | null;
  checking: boolean;
  /**
   * Lost the connection after the app was already running. Screens stay usable on cached
   * data; the offline banner shows and queued actions wait for reconnect.
   */
  offline: boolean;
  /** Epoch ms of the last successful response; null if never connected this session. */
  lastConnectedAt: number | null;
  checkServerHealth: () => Promise<boolean>;
  markServerUnavailable: (reason?: string) => void;
};

const ServerStatusContext = createContext<ServerStatusState | null>(null);

export function ServerStatusProvider({ children }: { children: React.ReactNode }) {
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [offline, setOffline] = useState(false);
  const [lastConnectedAt, setLastConnectedAt] = useState<number | null>(null);
  const hasConnected = useRef(false);
  const offlineRef = useRef(false);
  const lastConnectedRef = useRef<number | null>(null);

  const markConnected = useCallback(() => {
    hasConnected.current = true;
    lastConnectedRef.current = Date.now();
    if (offlineRef.current) {
      offlineRef.current = false;
      setOffline(false);
      logger.info("server", "back online — flushing queue");
      void flushQueue();
    }
  }, []);

  const goOffline = useCallback(() => {
    if (offlineRef.current) return;
    offlineRef.current = true;
    setLastConnectedAt(lastConnectedRef.current);
    setOffline(true);
  }, []);

  const checkServerHealth = useCallback(async (): Promise<boolean> => {
    logger.info("server", "health check start");
    setChecking(true);
    const ok = await checkHealth();
    if (ok) {
      markConnected();
      setServerAvailable(true);
      logger.info("server", "health check ok");
    } else if (hasConnected.current) {
      goOffline();
      logger.warn("server", "health check failed — offline");
    } else {
      setServerAvailable(false);
      logger.warn("server", "health check failed — server unavailable");
    }
    setChecking(false);
    return ok;
  }, [markConnected, goOffline]);

  const markServerUnavailable = useCallback(
    (reason = "unknown") => {
      logger.warn("server", "marked unavailable", { reason, hasConnected: hasConnected.current });
      if (hasConnected.current) goOffline();
      else setServerAvailable(false);
    },
    [goOffline],
  );

  useEffect(() => {
    void checkServerHealth();
  }, [checkServerHealth]);

  useEffect(() => {
    setServerUnavailableHandler((reason) => markServerUnavailable(reason));
    setServerReachableHandler(() => {
      if (hasConnected.current) markConnected();
    });
    return () => {
      setServerUnavailableHandler(null);
      setServerReachableHandler(null);
    };
  }, [markServerUnavailable, markConnected]);

  // While offline, probe quietly so the banner clears and the queue flushes on its own.
  useEffect(() => {
    if (!offline) return;
    const id = setInterval(() => {
      void checkHealth().then((ok) => {
        if (ok) markConnected();
      });
    }, RECOVERY_POLL_MS);
    return () => clearInterval(id);
  }, [offline, markConnected]);

  const value = useMemo<ServerStatusState>(
    () => ({
      serverAvailable,
      checking,
      offline,
      lastConnectedAt,
      checkServerHealth,
      markServerUnavailable,
    }),
    [serverAvailable, checking, offline, lastConnectedAt, checkServerHealth, markServerUnavailable],
  );

  return <ServerStatusContext.Provider value={value}>{children}</ServerStatusContext.Provider>;
}

export function useServerStatus() {
  const ctx = useContext(ServerStatusContext);
  if (!ctx) throw new Error("useServerStatus must be used within ServerStatusProvider");
  return ctx;
}
