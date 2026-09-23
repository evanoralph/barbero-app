import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useSession } from "@/src/auth/session";
import { logger } from "@/src/utils/logger";
import {
  resolvePushHref,
  subscribePushNotificationNavigation,
  type PushNavPayload,
} from "@/src/utils/push";

/**
 * Listens for notification taps and navigates to chat thread or booking detail
 * once the session is ready. Queues a pending tap if auth is still loading.
 */
export function usePushNotificationNavigation(): void {
  const { ready, role, user } = useSession();
  const router = useRouter();
  const pendingRef = useRef<PushNavPayload | null>(null);
  const readyRef = useRef(ready);
  const roleRef = useRef(role);
  const userRef = useRef(user);

  readyRef.current = ready;
  roleRef.current = role;
  userRef.current = user;

  const navigate = (payload: PushNavPayload) => {
    if (!readyRef.current) {
      pendingRef.current = payload;
      logger.info("push-nav", "queued tap until session ready", {
        type: payload.type,
        dedupeKey: payload.dedupeKey,
      });
      return;
    }

    if (!userRef.current) {
      pendingRef.current = null;
      logger.info("push-nav", "drop tap — logged out", {
        type: payload.type,
      });
      return;
    }

    const href = resolvePushHref(roleRef.current, payload);
    if (!href) {
      pendingRef.current = null;
      return;
    }

    try {
      logger.info("push-nav", "navigating from notification tap", {
        href,
        role: roleRef.current,
        type: payload.type,
      });
      router.push(href);
      pendingRef.current = null;
    } catch (error) {
      logger.warn("push-nav", "navigation failed — leaving user on current screen", error);
      pendingRef.current = null;
    }
  };

  // Flush queue when session becomes ready.
  useEffect(() => {
    if (!ready) return;
    const pending = pendingRef.current;
    if (!pending) return;
    logger.info("push-nav", "flushing queued notification tap", {
      type: pending.type,
      role,
      hasUser: Boolean(user),
    });
    navigate(pending);
  }, [ready, role, user]);

  useEffect(() => {
    logger.info("push-nav", "hook mounted — attaching listeners");
    const unsubscribe = subscribePushNotificationNavigation((payload) => {
      navigate(payload);
    });
    return () => {
      logger.info("push-nav", "hook unmounted — detaching listeners");
      unsubscribe();
    };
  }, [router]);
}
