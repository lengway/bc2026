import { ApiError } from "./api-client";
/** The backend exposes read-only event history; document views are unobserved. */
export const recordDocumentOpen: (
  caseId: string,
  documentId: string,
) => Promise<never> = () =>
  Promise.reject(
    new ApiError("UNSUPPORTED", "Document-open observations are unavailable."),
  );
