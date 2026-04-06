export type DebugEventLevel = "info" | "success" | "warning" | "error";

export interface DebugEvent {
  id: string;
  createdAt: string;
  level: DebugEventLevel;
  source: string;
  title: string;
  message: string;
  details?: string;
}

const STORAGE_KEY = "geoai-debug-events";
const UPDATE_EVENT = "geoai-debug-events-updated";
const MAX_EVENTS = 80;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitUpdate(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

function getEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `debug-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadDebugEvents(): DebugEvent[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue) as DebugEvent[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry) => {
      return (
        entry &&
        typeof entry.id === "string" &&
        typeof entry.createdAt === "string" &&
        typeof entry.level === "string" &&
        typeof entry.source === "string" &&
        typeof entry.title === "string" &&
        typeof entry.message === "string"
      );
    });
  } catch {
    return [];
  }
}

function saveDebugEvents(events: DebugEvent[]): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)));
  emitUpdate();
}

export function appendDebugEvent(
  input: Omit<DebugEvent, "id" | "createdAt">,
): DebugEvent {
  const nextEvent: DebugEvent = {
    ...input,
    id: getEventId(),
    createdAt: new Date().toISOString(),
  };

  const current = loadDebugEvents();
  saveDebugEvents([nextEvent, ...current]);
  return nextEvent;
}

export function clearDebugEvents(): void {
  saveDebugEvents([]);
}

export function getDebugUpdateEventName(): string {
  return UPDATE_EVENT;
}

export function formatDebugEventsForClipboard(events: DebugEvent[]): string {
  if (events.length === 0) {
    return "Aucun evenement GeoAI enregistre.";
  }

  return events
    .map((event) =>
      [
        `[${event.createdAt}] ${event.level.toUpperCase()} - ${event.source} - ${event.title}`,
        event.message,
        event.details ? `details: ${event.details}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}
