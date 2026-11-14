import { z } from "zod";
import { apiClient } from "./api-client";
/** Proposed write companion to GET /events: requires backend adoption (see INTEGRATION.md). */
export const recordDocumentOpen = (caseId: string, documentId: string) =>
  apiClient(
    `/api/cases/${encodeURIComponent(caseId)}/events`,
    z.object({ accepted: z.literal(true) }),
    {
      method: "POST",
      body: { type: "doc_open", documentId, clientMsgId: crypto.randomUUID() },
      timeoutMs: 5000,
    },
  );
