import { describe, expect, it } from "vitest";
import { mergeEvents, type ChatEvent } from "./events";
describe("conversation reconciliation", () => {
  it("collapses both copies when realtime arrives before the correlated HTTP reply", () => {
    const optimistic: ChatEvent = {
      id: "local",
      seq: Number.MAX_SAFE_INTEGER,
      clientMsgId: "request-one",
      delivery: "pending",
      content: "Hello",
    };
    const realtime: ChatEvent = {
      id: "server",
      seq: 1,
      delivery: "sent",
      content: "Hello",
    };
    const beforeHttp = mergeEvents([optimistic], [realtime]);
    const afterHttp = mergeEvents(beforeHttp, [
      { ...realtime, clientMsgId: "request-one" },
    ]);
    expect(afterHttp).toEqual([{ ...realtime, clientMsgId: "request-one" }]);
  });
  it("replaces an optimistic message by its client identity", () => {
    const pending: ChatEvent = {
      id: "local:one",
      seq: Number.MAX_SAFE_INTEGER,
      clientMsgId: "one",
      delivery: "pending",
      content: "Hello",
    };
    expect(
      mergeEvents(
        [pending],
        [
          {
            id: "server:one",
            seq: 3,
            clientMsgId: "one",
            delivery: "sent",
            content: "Hello",
          },
        ],
      ),
    ).toEqual([
      {
        id: "server:one",
        seq: 3,
        clientMsgId: "one",
        delivery: "sent",
        content: "Hello",
      },
    ]);
  });
  it("deduplicates HTTP and realtime delivery while preserving other events", () => {
    const first = { id: "first", seq: 2, content: "Hello" };
    const reply = { id: "reply", seq: 3, content: "Hi" };
    expect(mergeEvents([first, reply], [first])).toEqual([first, reply]);
  });
  it("sorts out-of-order events without mutating the previous cache", () => {
    const existing = [{ id: "later", seq: 8, content: "Later" }];
    expect(
      mergeEvents(existing, [
        { id: "earlier", seq: 2, content: "Earlier" },
      ]).map((event) => event.id),
    ).toEqual(["earlier", "later"]);
    expect(existing).toHaveLength(1);
  });
});
