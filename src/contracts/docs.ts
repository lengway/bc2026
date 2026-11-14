import { z } from "zod";
import type { CaseDoc } from "./case";

/*
 * PROPOSAL — content shapes for CaseDoc by `kind`.
 * CONTEXT.md §10 references this file but does not define it. These shapes
 * are what DocViewer renders; change them only together with backend
 * (`case.generate` output) and frontend.
 */

export const EmailThreadContent = z.object({
  subject: z.string(),
  messages: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      sentAt: z.string(),
      body: z.string(),
    }),
  ),
});
export type EmailThreadContent = z.infer<typeof EmailThreadContent>;

export const CrmRecordContent = z.object({
  account: z.string(),
  fields: z.array(z.object({ label: z.string(), value: z.string() })),
  activity: z.array(z.object({ at: z.string(), text: z.string() })),
});
export type CrmRecordContent = z.infer<typeof CrmRecordContent>;

export const SlackThreadContent = z.object({
  channel: z.string(),
  messages: z.array(
    z.object({ author: z.string(), sentAt: z.string(), text: z.string() }),
  ),
});
export type SlackThreadContent = z.infer<typeof SlackThreadContent>;

export const TableContent = z.object({
  caption: z.string().nullable(),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});
export type TableContent = z.infer<typeof TableContent>;

export const NoteContent = z.object({ body: z.string() });
export type NoteContent = z.infer<typeof NoteContent>;

export type ParsedDocContent =
  | { kind: "email_thread"; content: EmailThreadContent }
  | { kind: "crm_record"; content: CrmRecordContent }
  | { kind: "slack_thread"; content: SlackThreadContent }
  | { kind: "table"; content: TableContent }
  | { kind: "note"; content: NoteContent };

/** Returns typed content for a document, or null when it does not match its kind. */
export function parseDocContent(
  doc: Pick<CaseDoc, "kind" | "content">,
): ParsedDocContent | null {
  switch (doc.kind) {
    case "email_thread": {
      const r = EmailThreadContent.safeParse(doc.content);
      return r.success ? { kind: doc.kind, content: r.data } : null;
    }
    case "crm_record": {
      const r = CrmRecordContent.safeParse(doc.content);
      return r.success ? { kind: doc.kind, content: r.data } : null;
    }
    case "slack_thread": {
      const r = SlackThreadContent.safeParse(doc.content);
      return r.success ? { kind: doc.kind, content: r.data } : null;
    }
    case "table": {
      const r = TableContent.safeParse(doc.content);
      return r.success ? { kind: doc.kind, content: r.data } : null;
    }
    case "note": {
      const r = NoteContent.safeParse(doc.content);
      return r.success ? { kind: doc.kind, content: r.data } : null;
    }
  }
}
