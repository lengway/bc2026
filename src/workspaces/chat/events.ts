export type ChatEvent = {
  id: string;
  seq: number;
  clientMsgId?: string | null;
  delivery?: "pending" | "failed" | "sent";
  beforeEventId?: string;
  content: string;
};
export function mergeEvents<T extends ChatEvent>(
  existing: T[],
  incoming: T[],
): T[] {
  let next = [...existing];
  for (const event of incoming) {
    const matches = (item: T) =>
      item.id === event.id ||
      (Boolean(event.clientMsgId) && item.clientMsgId === event.clientMsgId) ||
      (event.seq !== Number.MAX_SAFE_INTEGER && item.seq === event.seq);
    const confirmed = next.find(
      (item) => matches(item) && item.delivery === "sent",
    );
    if (confirmed && event.delivery && event.delivery !== "sent") continue;
    next = next.filter((item) => !matches(item));
    next.push({
      ...event,
      clientMsgId:
        event.clientMsgId ?? confirmed?.clientMsgId ?? event.clientMsgId,
    });
  }
  // A Copilot response contains only its reply. Anchor the optimistic question
  // before that reply until /events supplies its real sequence; never invent seq.
  const sequenceById = new Map(next.map((event) => [event.id, event.seq]));
  const displayOrder = (event: T) => {
    const anchor = event.beforeEventId && sequenceById.get(event.beforeEventId);
    return typeof anchor === "number" ? anchor - 0.5 : event.seq;
  };
  return next.sort((a, b) => displayOrder(a) - displayOrder(b));
}
