import { apiClient } from "./api-client";
import * as C from "./contracts";
const casePath = (id: string) => `/api/cases/${encodeURIComponent(id)}`;
export const api = {
  session: (signal?: AbortSignal) =>
    apiClient("/api/auth/session", C.SessionView, { signal }),
  magicLink: (email: string, next?: string) =>
    apiClient("/api/auth/magic-link", C.MagicLinkResponse, {
      method: "POST",
      body: { email, next },
    }),
  logout: () =>
    apiClient("/api/auth/logout", C.LogoutResponse, {
      method: "POST",
      body: {},
    }),
  events: (id: string, afterSeq = 0, signal?: AbortSignal) =>
    apiClient(`${casePath(id)}/events?afterSeq=${afterSeq}`, C.EventsPage, {
      signal,
    }),
  editorBatch: (id: string, body: C.EditorBatchData, signal?: AbortSignal) =>
    apiClient(`${casePath(id)}/editor-events`, C.EditorBatchAck, {
      method: "POST",
      body,
      signal,
      keepalive: true,
    }),
  intake: (body: C.IntakeRequest) =>
    apiClient("/api/intake", C.Profile, { method: "POST", body }),
  createCase: (type: C.CaseKind, skill?: C.SkillId, prep?: C.SalesCallPrep) =>
    apiClient("/api/cases", C.CreateCaseResponse, {
      method: "POST",
      body: { type, skill, prep },
    }),
  createPressureCase: () =>
    apiClient("/api/cases/pressure", C.CreateCaseResponse, {
      method: "POST",
      body: {},
    }),
  case: (id: string, signal?: AbortSignal) =>
    apiClient(casePath(id), C.CaseResponse, { signal }),
  start: (id: string) =>
    apiClient(`${casePath(id)}/start`, C.StartResponse, { method: "POST" }),
  move: (id: string, body: C.MoveInput) =>
    apiClient(`${casePath(id)}/move`, C.MoveResponse, {
      method: "POST",
      body,
      timeoutMs: 45_000,
    }),
  copilot: (id: string, body: C.CopilotInput) =>
    apiClient(`${casePath(id)}/copilot`, C.CopilotResponse, {
      method: "POST",
      body,
      timeoutMs: 45_000,
    }),
  submit: (id: string) =>
    apiClient(`${casePath(id)}/submit`, C.SubmitResponse, { method: "POST" }),
  review: (id: string, signal?: AbortSignal) =>
    apiClient(`${casePath(id)}/review`, C.Review, { signal }),
  certificate: (slug: string, signal?: AbortSignal) =>
    apiClient(`/api/certificates/${encodeURIComponent(slug)}`, C.Certificate, {
      signal,
    }),
  path: (signal?: AbortSignal) =>
    apiClient("/api/me/path", C.SkillPath, { signal }),
  recoverablePrep: (signal?: AbortSignal) =>
    apiClient("/api/me/prep", C.RecoverablePrepResponse, { signal }),
  checkout: (billing: "monthly" | "yearly" = "monthly") =>
    apiClient("/api/billing/checkout", C.CheckoutResponse, {
      method: "POST",
      body: { plan: billing },
    }),
};
