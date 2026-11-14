import { api } from "@/app/_lib/api";
import { ApiError } from "@/app/_lib/api-client";
import {
  PublicEvent,
  type EventData,
  type EventsPageData,
} from "@/app/_lib/contracts";
export type EventStreamOptions = {
  caseId: string;
  onEvents: (events: EventData[]) => void;
  onError: (error: Error) => void;
  fetchEvents?: (
    id: string,
    after: number,
    signal?: AbortSignal,
  ) => Promise<EventsPageData>;
  openStream?: (url: string) => EventConnection;
  pollOnly?: boolean;
};
export interface EventConnection {
  onopen: ((event: Event) => unknown) | null;
  onerror: ((event: Event) => unknown) | null;
  addEventListener(
    type: string,
    listener: (event: MessageEvent<string>) => void,
  ): void;
  close(): void;
}
export function subscribeCaseEvents(options: EventStreamOptions) {
  const {
    caseId,
    onEvents,
    onError,
    fetchEvents = api.events,
    openStream = (url) => new EventSource(url),
    pollOnly = false,
  } = options;
  const controller = new AbortController();
  let stopped = false;
  let cursor = 0;
  let connected = false;
  let attempts = 0;
  let stream: EventConnection | undefined;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let fetching: Promise<boolean> | undefined;
  function stop() {
    stopped = true;
    stream?.close();
    controller.abort();
    clearTimeout(pollTimer);
    clearTimeout(reconnectTimer);
  }
  function fail(error: unknown) {
    if (stopped) return;
    const safe =
      error instanceof Error
        ? error
        : new ApiError("UNAVAILABLE", "The conversation is reconnecting.");
    onError(safe);
    if (
      safe instanceof ApiError &&
      (safe.status === 401 || safe.status === 404)
    )
      stop();
  }
  function catchUp(): Promise<boolean> {
    if (fetching) return fetching;
    fetching = fetchEvents(caseId, cursor, controller.signal)
      .then((page) => {
        if (stopped) return false;
        const events = page.events.filter((event) => event.caseId === caseId);
        cursor = Math.max(
          cursor,
          page.lastSeq,
          ...events.map((event) => event.seq),
        );
        onEvents(events);
        return true;
      })
      .catch((error) => {
        fail(error);
        return false;
      })
      .finally(() => {
        fetching = undefined;
      });
    return fetching;
  }
  function poll() {
    clearTimeout(pollTimer);
    if (stopped || connected) return;
    pollTimer = setTimeout(async () => {
      await catchUp();
      poll();
    }, 2000);
  }
  function reconnect() {
    if (stopped || pollOnly || reconnectTimer) return;
    reconnectTimer = setTimeout(
      () => {
        reconnectTimer = undefined;
        // Polling already probes access; opening from the last cursor replays any gap.
        connect();
      },
      Math.min(30_000, 2000 * 2 ** attempts++),
    );
  }
  function connect() {
    if (stopped || pollOnly) return;
    stream?.close();
    try {
      stream = openStream(
        `/api/cases/${encodeURIComponent(caseId)}/stream?afterSeq=${cursor}`,
      );
    } catch (error) {
      fail(error);
      poll();
      reconnect();
      return;
    }
    stream.onopen = () => {
      if (!stopped) {
        connected = true;
        attempts = 0;
        clearTimeout(pollTimer);
      }
    };
    stream.addEventListener("case_event", (event) => {
      if (stopped) return;
      try {
        const parsed = PublicEvent.safeParse(JSON.parse(event.data));
        if (!parsed.success || parsed.data.caseId !== caseId)
          throw new Error("Invalid event");
        cursor = Math.max(cursor, parsed.data.seq);
        onEvents([parsed.data]);
      } catch {
        fail(
          new ApiError(
            "INVALID_RESPONSE",
            "An update couldn't be read. Reconnecting…",
          ),
        );
        stream?.close();
        connected = false;
        void catchUp();
        poll();
        reconnect();
      }
    });
    stream.onerror = () => {
      if (stopped) return;
      connected = false;
      stream?.close();
      // EventSource hides HTTP status. Probe the JSON endpoint before retrying.
      void catchUp().then(() => {
        if (!stopped) {
          poll();
          reconnect();
        }
      });
    };
  }
  void catchUp().then((ok) => {
    if (stopped) return;
    if (ok && !pollOnly) connect();
    else {
      poll();
      reconnect();
    }
  });
  return stop;
}
