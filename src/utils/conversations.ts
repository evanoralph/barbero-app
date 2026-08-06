import type { ConversationListItem } from "@/src/types/api";

const UPCOMING_STATUSES = new Set(["pending", "confirmed"]);

export function isUpcomingConversation(c: ConversationListItem, now = Date.now()): boolean {
  const status = (c.bookingStatus || "").toLowerCase();
  if (!UPCOMING_STATUSES.has(status)) return false;
  if (!c.startsAt) return true;
  const start = new Date(c.startsAt).getTime();
  if (Number.isNaN(start)) return true;
  // Still "upcoming" through the appointment hour
  return start >= now - 60 * 60 * 1000;
}

export function splitConversations(items: ConversationListItem[]) {
  const upcoming: ConversationListItem[] = [];
  const earlier: ConversationListItem[] = [];
  for (const c of items) {
    if (isUpcomingConversation(c)) upcoming.push(c);
    else earlier.push(c);
  }
  upcoming.sort((a, b) => {
    const at = a.startsAt ? new Date(a.startsAt).getTime() : 0;
    const bt = b.startsAt ? new Date(b.startsAt).getTime() : 0;
    return at - bt;
  });
  earlier.sort((a, b) => {
    const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bt - at;
  });
  return { upcoming, earlier };
}

export function filterConversations(items: ConversationListItem[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((c) => {
    const hay = [c.participantName, c.serviceName, c.lastMessage, c.bookingStatus]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/** Gold mono booking line, e.g. "TODAY 2:30 PM · SKIN FADE & BEARD". */
export function formatConversationBookingLine(c: ConversationListItem): string | null {
  const service = (c.serviceName || "").trim();
  const status = (c.bookingStatus || "").trim().toLowerCase();
  if (!service && !c.startsAt) return null;

  const serviceUp = (service || "BOOKING").toUpperCase();

  if (!c.startsAt) {
    if (status === "pending") return `${serviceUp} PENDING`;
    return serviceUp;
  }

  const d = new Date(c.startsAt);
  if (Number.isNaN(d.getTime())) {
    return status === "pending" ? `${serviceUp} PENDING` : serviceUp;
  }

  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (sameDay && (status === "confirmed" || status === "pending")) {
    return `TODAY ${time} · ${serviceUp}`;
  }

  const month = d.toLocaleString(undefined, { month: "short" }).toUpperCase();
  const day = d.getDate();
  if (status === "pending") return `${month} ${day} · ${serviceUp} PENDING`;
  return `${month} ${day} · ${serviceUp}`;
}
