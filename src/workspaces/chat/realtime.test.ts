import { afterEach, expect, it, vi } from "vitest";
import { subscribeCaseEvents, type EventConnection } from "./realtime";
import { ApiError } from "@/app/_lib/api-client";
import type { EventData } from "@/app/_lib/contracts";
const id = "00000000-0000-4000-8000-000000000001";
const event: EventData = {
  id: "00000000-0000-4000-8000-000000000002",
  caseId: id,
  seq: 3,
  actor: "persona",
  personaId: "dana",
  type: "message",
  content: "Hello",
  createdAt: "2026-11-14T10:00:00.000Z",
  clientMsgId: null,
  draftId: null,
  meta: {},
};
class Connection implements EventConnection {
  onopen: ((event: Event) => unknown) | null = null;
  onerror: ((event: Event) => unknown) | null = null;
  closed = false;
  private listener?: (event: MessageEvent<string>) => void;
  addEventListener(
    _type: string,
    listener: (event: MessageEvent<string>) => void,
  ) {
    this.listener = listener;
  }
  close() {
    this.closed = true;
  }
  receive(value: unknown) {
    this.listener?.(
      new MessageEvent("case_event", { data: JSON.stringify(value) }),
    );
  }
}
afterEach(() => vi.useRealTimers());
it("loads history before opening SSE, respects lastSeq and strips private event metadata", async () => {
  vi.useFakeTimers();
  const connection = new Connection();
  const urls: string[] = [];
  const received: EventData[] = [];
  const stop = subscribeCaseEvents({
    caseId: id,
    fetchEvents: async () => ({ events: [event], lastSeq: 5 }),
    openStream: (url) => {
      urls.push(url);
      return connection;
    },
    onEvents: (events) => received.push(...events),
    onError: (error) => {
      throw error;
    },
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(urls).toEqual([`/api/cases/${id}/stream?afterSeq=5`]);
  connection.receive({
    ...event,
    seq: 6,
    meta: { typingMs: 500, innerThought: "secret", trapId: "secret" },
  });
  expect(received.at(-1)?.meta).toEqual({ typingMs: 500 });
  stop();
  connection.receive({ ...event, seq: 7 });
  expect(connection.closed).toBe(true);
  expect(received).toHaveLength(2);
});
it.each([401, 404])(
  "stops stream and retries when the access probe returns %s",
  async (status) => {
    vi.useFakeTimers();
    const connection = new Connection();
    let requests = 0;
    const errors: Error[] = [];
    const stop = subscribeCaseEvents({
      caseId: id,
      fetchEvents: async () => {
        requests += 1;
        if (requests > 1)
          throw new ApiError(
            status === 401 ? "UNAUTHORIZED" : "NOT_FOUND",
            "Access ended",
            status,
          );
        return { events: [], lastSeq: 0 };
      },
      openStream: () => connection,
      onEvents: () => {},
      onError: (error) => errors.push(error),
    });
    await vi.advanceTimersByTimeAsync(0);
    connection.onerror?.(new Event("error"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(errors).toHaveLength(1);
    expect(requests).toBe(2);
    expect(connection.closed).toBe(true);
    stop();
  },
);
it("polls at two-second intervals after a transient stream failure and resumes from the cursor", async () => {
  vi.useFakeTimers();
  const connections: Connection[] = [];
  const urls: string[] = [];
  const cursors: number[] = [];
  const stop = subscribeCaseEvents({
    caseId: id,
    fetchEvents: async (_id, cursor) => {
      cursors.push(cursor);
      if (cursors.length === 2) throw new ApiError("NETWORK_ERROR", "Offline");
      return { events: [event], lastSeq: 5 };
    },
    openStream: (url) => {
      urls.push(url);
      const connection = new Connection();
      connections.push(connection);
      return connection;
    },
    onEvents: () => {},
    onError: () => {},
  });
  await vi.advanceTimersByTimeAsync(0);
  connections[0].onerror?.(new Event("error"));
  await vi.advanceTimersByTimeAsync(0);
  expect(cursors).toEqual([0, 5]);
  await vi.advanceTimersByTimeAsync(2000);
  expect(cursors).toEqual([0, 5, 5]);
  expect(urls.at(-1)).toContain("afterSeq=5");
  stop();
  const count = cursors.length;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(cursors).toHaveLength(count);
});
