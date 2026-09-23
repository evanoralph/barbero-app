import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authMe, login as apiLogin, logout as apiLogout } from "@/src/api/auth";
import { setApiTokenGetter } from "@/src/api/client";
import { setLoginOtpChallenge } from "@/src/auth/login-otp-challenge";
import { clearToken, loadToken, saveToken } from "@/src/auth/token";
import { resumeMobileDdp, signOutMobileDdp } from "@/src/meteor/session";
import { clearCache } from "@/src/offline/cache";
import type { AuthMe, LoginResponse, LoginStartResult } from "@/src/types/api";
import { isLoginOtpChallenge } from "@/src/types/api";
import { clearDiscoveryLocation } from "@/src/utils/discoveryLocation";
import { logger } from "@/src/utils/logger";
import { registerPushToken } from "@/src/utils/push";

export type AppRole = "customer" | "provider" | "admin" | "unknown";

type SessionState = {
  ready: boolean;
  token: string | null;
  user: AuthMe | null;
  role: AppRole;
  /** True after DDP resume login succeeds — required for live typing/chat pubs. */
  ddpAuthed: boolean;
  /** Password step — may return OTP challenge instead of a session. */
  signIn: (email: string, password: string) => Promise<LoginStartResult>;
  /** Persist session after register verify or login OTP verify. */
  completeSignUp: (result: LoginResponse) => Promise<void>;
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
  const [ddpAuthed, setDdpAuthed] = useState(false);

  useEffect(() => {
    setApiTokenGetter(() => token);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setDdpAuthed(false);
      console.log("[session] ddpAuthed cleared (no token)");
      logger.info("session", "ddpAuthed cleared (no token)");
      void signOutMobileDdp();
      return;
    }
    logger.info("session", "resuming DDP for live chat");
    void (async () => {
      const ok = await resumeMobileDdp(token);
      if (cancelled) return;
      setDdpAuthed(ok);
      console.log("[session] ddp resume result", { ok });
      logger.info("session", ok ? "ddp resume ok" : "ddp resume fail", { ddpAuthed: ok });
    })();
    return () => {
      cancelled = true;
    };
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
              void registerPushToken(me.userId);
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
    if (isLoginOtpChallenge(result)) {
      setLoginOtpChallenge(result.email, result.challengeId, result.devCode);
      logger.info("session", "password ok — OTP required", {
        email: result.email,
        hasDevCode: Boolean(result.devCode),
      });
      return result;
    }
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
    void registerPushToken(result.userId);
    return result;
  }, []);

  const completeSignUp = useCallback(async (result: LoginResponse) => {
    await saveToken(result.token);
    setToken(result.token);
    setApiTokenGetter(() => result.token);
    setUser({
      userId: result.userId,
      email: result.email,
      roles: result.roles,
      expiresAt: result.expiresAt,
    });
    logger.info("session", "signed up / login OTP complete", { roles: result.roles });
    void registerPushToken(result.userId);
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (token) await apiLogout();
    } catch (error) {
      logger.warn("session", "logout API failed (clearing local anyway)", error);
    }
    await clearToken();
    await clearCache();
    await clearDiscoveryLocation();
    setToken(null);
    setUser(null);
    setDdpAuthed(false);
    await signOutMobileDdp();
    console.log("[session] signed out — ddpAuthed cleared, discovery location cleared");
    logger.info("session", "signed out");
  }, [token]);

  const value = useMemo<SessionState>(
    () => ({
      ready,
      token,
      user,
      role: user ? pickRole(user.roles) : "unknown",
      ddpAuthed,
      signIn,
      completeSignUp,
      signOut,
      refresh,
    }),
    [ready, token, user, ddpAuthed, signIn, completeSignUp, signOut, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within AuthProvider");
  return ctx;
}
