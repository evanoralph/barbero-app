import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { ApiError } from "@/src/api/client";
import { createBooking, updateBookingStatus } from "@/src/api/bookings";
import { showToast } from "@/src/offline/toast";
import { logger } from "@/src/utils/logger";

const KEY = "barbero_offline_queue:v1";

type CreateBookingInput = Parameters<typeof createBooking>[0];

export type QueuedAction =
  | { id: string; kind: "createBooking"; label: string; createdAt: number; input: CreateBookingInput }
  | { id: string; kind: "cancelBooking"; label: string; createdAt: number; bookingId: string };

type NewAction =
  | { kind: "createBooking"; label: string; input: CreateBookingInput }
  | { kind: "cancelBooking"; label: string; bookingId: string };

let items: QueuedAction[] = [];
let loaded: Promise<void> | null = null;
let flushing = false;
const listeners = new Set<(list: QueuedAction[]) => void>();

function emit() {
  const snapshot = [...items];
  listeners.forEach((l) => l(snapshot));
}

async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch (error) {
    logger.warn("queue", "persist failed", error);
  }
}

function ensureLoaded(): Promise<void> {
  if (!loaded) {
    loaded = (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) items = JSON.parse(raw) as QueuedAction[];
      } catch (error) {
        logger.warn("queue", "load failed", error);
      }
      emit();
    })();
  }
  return loaded;
}

export async function enqueue(action: NewAction): Promise<QueuedAction> {
  await ensureLoaded();
  const entry = {
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  } as QueuedAction;
  items = [...items, entry];
  await persist();
  emit();
  logger.info("queue", "enqueued", { kind: entry.kind, count: items.length });
  return entry;
}

export async function removeQueued(id: string) {
  await ensureLoaded();
  items = items.filter((i) => i.id !== id);
  await persist();
  emit();
}

/** Bookings that have a cancel waiting to be sent (for the "Cancelling…" state). */
export function hasQueuedCancel(list: QueuedAction[], bookingId: string): boolean {
  return list.some((i) => i.kind === "cancelBooking" && i.bookingId === bookingId);
}

async function run(action: QueuedAction) {
  if (action.kind === "cancelBooking") {
    await updateBookingStatus(action.bookingId, { status: "cancelled" });
  } else {
    await createBooking(action.input);
  }
}

/** Send everything queued, oldest first. Stops at the first network failure. */
export async function flushQueue() {
  await ensureLoaded();
  if (flushing || items.length === 0) return;
  flushing = true;
  let sent = 0;
  try {
    for (const action of [...items]) {
      try {
        await run(action);
        sent += 1;
        await removeQueued(action.id);
      } catch (e) {
        if (e instanceof ApiError && e.code === "NETWORK") break;
        // The server rejected it (slot taken, already cancelled…): drop it and say so.
        logger.warn("queue", "action rejected", { kind: action.kind, error: e });
        await removeQueued(action.id);
        showToast(`Couldn't send: ${action.label}. ${e instanceof Error ? e.message : ""}`.trim());
      }
    }
  } finally {
    flushing = false;
  }
  if (sent > 0) showToast(sent === 1 ? "Sent — back online" : `Sent ${sent} queued changes`);
}

/** Live view of the queue for banners and the offline page. */
export function useQueue(): QueuedAction[] {
  const [list, setList] = useState<QueuedAction[]>(items);
  useEffect(() => {
    listeners.add(setList);
    void ensureLoaded().then(() => setList([...items]));
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return list;
}
