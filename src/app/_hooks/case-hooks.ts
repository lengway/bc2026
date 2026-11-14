"use client";
import { useEffect, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  MoveInput,
  EventData,
  CopilotInput,
  CaseResponseData,
  CaseKind,
} from "@/app/_lib/contracts";
import { api } from "@/app/_lib/api";
import { ApiError } from "@/app/_lib/api-client";
import { mocksEnabled } from "@/app/_lib/environment";
import { mergeEvents } from "@/workspaces/chat/events";
import { subscribeCaseEvents } from "@/workspaces/chat/realtime";
export type DisplayEvent = EventData & {
  delivery?: "pending" | "failed" | "sent";
  beforeEventId?: string;
};
export const eventKey = (id: string) => ["case-events", id];
export const caseKey = (id: string) => ["case", id];
function incoming(client: QueryClient, id: string, events: EventData[]) {
  client.setQueryData<DisplayEvent[]>(eventKey(id), (previous) =>
    mergeEvents(
      previous ?? [],
      events.map((event) => ({ ...event, delivery: "sent" })),
    ),
  );
}
function optimistic(
  client: QueryClient,
  id: string,
  input: CopilotInput,
  type: "message" | "copilot_prompt",
  personaId: string | null,
  draftId: string | null = null,
) {
  const event: DisplayEvent = {
    id: input.clientMsgId,
    caseId: id,
    seq: Number.MAX_SAFE_INTEGER,
    actor: "user",
    type,
    content: input.text,
    personaId,
    clientMsgId: input.clientMsgId,
    draftId,
    createdAt: new Date().toISOString(),
    meta: {},
    delivery: "pending",
  };
  client.setQueryData<DisplayEvent[]>(eventKey(id), (previous) =>
    mergeEvents(previous ?? [], [event]),
  );
}
function failed(client: QueryClient, id: string, clientMsgId: string) {
  client.setQueryData<DisplayEvent[]>(
    eventKey(id),
    (previous) =>
      previous?.map((event) =>
        event.clientMsgId === clientMsgId && event.delivery === "pending"
          ? { ...event, delivery: "failed" }
          : event,
      ) ?? [],
  );
}
export function useCase(id: string) {
  return useQuery({
    queryKey: caseKey(id),
    queryFn: ({ signal }) => api.case(id, signal),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      ["generating", "evaluating"].includes(query.state.data?.status ?? "")
        ? 2000
        : false,
  });
}
export function useCaseEvents(id: string) {
  const client = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const result = useQuery<DisplayEvent[]>({
    queryKey: eventKey(id),
    queryFn: () => [],
    initialData: [],
    enabled: false,
    staleTime: Infinity,
  });
  useEffect(
    () =>
      subscribeCaseEvents({
        caseId: id,
        pollOnly: mocksEnabled,
        onEvents(events) {
          setError(null);
          incoming(client, id, events);
          if (
            events.some(
              (event) => event.type === "twist" || event.type === "submit",
            )
          )
            void client.invalidateQueries({ queryKey: caseKey(id) });
        },
        onError(failure) {
          setError(failure);
          if (
            failure instanceof ApiError &&
            [401, 404].includes(failure.status)
          ) {
            client.setQueryData(eventKey(id), []);
            void client.invalidateQueries({ queryKey: caseKey(id) });
            if (failure.status === 401) client.setQueryData(["session"], null);
          }
        },
      }),
    [id, client, attempt],
  );
  return {
    ...result,
    streamError: error,
    reconnect: () => setAttempt((value) => value + 1),
  };
}
export function useSendMove(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: MoveInput) => api.move(id, input),
    retry: false,
    onMutate: (input) =>
      optimistic(client, id, input, "message", input.personaId, input.draftId),
    onSuccess: (response) => {
      incoming(client, id, response.events);
      client.setQueryData(["case-outcome", id], response.outcome);
      void client.invalidateQueries({ queryKey: caseKey(id) });
    },
    onError: (_error, input) => failed(client, id, input.clientMsgId),
  });
}
export function useCopilot(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CopilotInput) => api.copilot(id, input),
    retry: false,
    onMutate: (input) => optimistic(client, id, input, "copilot_prompt", null),
    onSuccess: (response, input) => {
      client.setQueryData<DisplayEvent[]>(
        eventKey(id),
        (previous) =>
          previous?.map((event) =>
            event.clientMsgId === input.clientMsgId
              ? { ...event, delivery: "sent", beforeEventId: response.event.id }
              : event,
          ) ?? [],
      );
      incoming(client, id, [response.event]);
    },
    onError: (_error, input) => failed(client, id, input.clientMsgId),
  });
}
export function useStartCase(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.start(id),
    onSuccess: (response) => {
      client.setQueryData<CaseResponseData>(caseKey(id), (previous) =>
        previous && "brief" in previous
          ? {
              ...previous,
              status: "in_progress",
              startedAt: response.startedAt,
            }
          : previous,
      );
      void client.invalidateQueries({ queryKey: caseKey(id) });
    },
  });
}
export function useSubmitCase(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.submit(id),
    retry: false,
    onSuccess: () => {
      client.setQueryData<CaseResponseData>(caseKey(id), (previous) =>
        previous && "brief" in previous
          ? { ...previous, status: "evaluating" }
          : previous,
      );
      void client.invalidateQueries({ queryKey: caseKey(id) });
      void client.invalidateQueries({ queryKey: ["review", id] });
    },
  });
}
export function useReview(id: string, enabled = true) {
  return useQuery({
    queryKey: ["review", id],
    queryFn: ({ signal }) => api.review(id, signal),
    retry: false,
    enabled,
  });
}
export function useSkillPath() {
  return useQuery({
    queryKey: ["skill-path"],
    queryFn: ({ signal }) => api.path(signal),
  });
}
export function useCreateCase() {
  return useMutation({
    mutationFn: (type: CaseKind) => api.createCase(type),
    retry: false,
  });
}
export function useCheckout() {
  return useMutation({ mutationFn: api.checkout, retry: false });
}
