import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authMe, login as apiLogin, logout as apiLogout } from "@/src/api/auth";
import { checkHealth, setApiTokenGetter } from "@/src/api/client";
import { clearToken, loadToken, saveToken } from "@/src/auth/token";
import { resumeMobileDdp, signOutMobileDdp } from "@/src/meteor/session";
import type { AuthMe, LoginResponse } from "@/src/types/api";
import { logger } from "@/src/utils/logger";
import { registerPushTokenPlaceholder } from "@/src/utils/pushPlaceholder";

export type AppRole = "customer" | "provider" | "admin" | "unknown";

type SessionState = {
  ready: boolean;
  token: string | null;
  user: AuthMe | null;
  role: AppRole;
  signIn: (email: string, password: string) => Promise<LoginResponse>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

function pickRole(roles: string[]): AppRole {
  if (roles.includes("provider")) return "provider";
  if (roles.includes("customer")) return "customer";
  if (roles.includes("admin")) return "admin";
  return "unknown";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthMe | null>(null);

  useEffect(() => {
    setApiTokenGetter(() => token);
  }, [token]);

  useEffect(() => {
    if (!token) {
      void signOutMobileDdp();
      return;
    }
    logger.info("session", "resuming DDP for live chat");
    void resumeMobileDdp(token);
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await authMe();
      setUser(me);
      logger.info("session", "session restored", { userId: me.userId, roles: me.roles });
    } catch (error) {
      logger.warn("session", "session restore failed — clearing token", error);
      await clearToken();
      setToken(null);
      setUser(null);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Don't block first paint on API health (API may be down).
        void checkHealth();
        const stored = await loadToken();
        if (cancelled) return;
        setToken(stored);
        if (stored) {
          setApiTokenGetter(() => stored);
          try {
            const me = await authMe();
            if (!cancelled) {
              setUser(me);
              logger.info("session", "boot restore ok", { roles: me.roles });
              void registerPushTokenPlaceholder(me.userId);
            }
          } catch (error) {
            logger.warn("session", "boot restore failed", error);
            await clearToken();
            if (!cancelled) {
              setToken(null);
              setUser(null);
            }
          }
        }
      } catch (error) {
        logger.error("session", "boot failed — continuing to login", error);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email.trim().toLowerCase(), password);
    await saveToken(result.token);
    setToken(result.token);
    setApiTokenGetter(() => result.token);
    setUser({
      userId: result.userId,
      email: result.email,
      roles: result.roles,
      expiresAt: result.expiresAt,
    });
    logger.info("session", "signed in", { roles: result.roles });
    void registerPushTokenPlaceholder(result.userId);
    return result;
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (token) await apiLogout();
    } catch (error) {
      logger.warn("session", "logout API failed (clearing local anyway)", error);
    }
    await clearToken();
    setToken(null);
    setUser(null);
    await signOutMobileDdp();
    logger.info("session", "signed out");
  }, [token]);

  const value = useMemo<SessionState>(
    () => ({
      ready,
      token,
      user,
      role: user ? pickRole(user.roles) : "unknown",
      signIn,
      signOut,
      refresh,
    }),
    [ready, token, user, signIn, signOut, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within AuthProvider");
  return ctx;
}
