import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { checkHealth, setServerUnavailableHandler } from "@/src/api/client";
import { logger } from "@/src/utils/logger";

type ServerStatusState = {
  /** null while the initial boot health check is in flight */
  serverAvailable: boolean | null;
  checking: boolean;
  checkServerHealth: () => Promise<boolean>;
  markServerUnavailable: (reason?: string) => void;
};

const ServerStatusContext = createContext<ServerStatusState | null>(null);

export function ServerStatusProvider({ children }: { children: React.ReactNode }) {
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  const checkServerHealth = useCallback(async (): Promise<boolean> => {
    logger.info("server", "health check start");
    setChecking(true);
    const ok = await checkHealth();
    setServerAvailable(ok);
    setChecking(false);
    if (ok) {
      logger.info("server", "health check ok");
    } else {
      logger.warn("server", "health check failed — server unavailable");
    }
    return ok;
  }, []);

  const markServerUnavailable = useCallback((reason = "unknown") => {
    logger.warn("server", "marked unavailable", { reason });
    setServerAvailable(false);
  }, []);

  useEffect(() => {
    void checkServerHealth();
  }, [checkServerHealth]);

  useEffect(() => {
    setServerUnavailableHandler((reason) => markServerUnavailable(reason));
    return () => setServerUnavailableHandler(null);
  }, [markServerUnavailable]);

  const value = useMemo<ServerStatusState>(
    () => ({
      serverAvailable,
      checking,
      checkServerHealth,
      markServerUnavailable,
    }),
    [serverAvailable, checking, checkServerHealth, markServerUnavailable],
  );

  return <ServerStatusContext.Provider value={value}>{children}</ServerStatusContext.Provider>;
}

export function useServerStatus() {
  const ctx = useContext(ServerStatusContext);
  if (!ctx) throw new Error("useServerStatus must be used within ServerStatusProvider");
  return ctx;
}
