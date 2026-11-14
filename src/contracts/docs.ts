import { z } from 'zod';
import { NonEmpty, PositiveInt, Timestamp } from './primitives';

export const EmailThreadContent = z.object({
  subject: NonEmpty,
  messages: z.array(z.object({
    from: NonEmpty,
    to: z.array(NonEmpty).min(1),
    sentAt: Timestamp,
    body: NonEmpty,
  })).min(1),
});
export type EmailThreadContent = z.infer<typeof EmailThreadContent>;

export const CrmRecordContent = z.object({
  account: NonEmpty,
  contact: NonEmpty,
  stage: NonEmpty,
  fields: z.array(z.object({ label: NonEmpty, value: NonEmpty })),
  notes: z.array(NonEmpty),
});
export type CrmRecordContent = z.infer<typeof CrmRecordContent>;

export const SlackThreadContent = z.object({
  channel: NonEmpty,
  messages: z.array(z.object({ author: NonEmpty, sentAt: Timestamp, text: NonEmpty })).min(1),
});
export type SlackThreadContent = z.infer<typeof SlackThreadContent>;

export const TableContent = z.object({
  caption: z.string().nullable().optional(),
  columns: z.array(NonEmpty).min(1),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
}).refine(({ columns, rows }) => rows.every((row) => row.length === columns.length), {
  path: ['rows'],
  message: 'Every row must have a cell for each column',
});
export type TableContent = z.infer<typeof TableContent>;

export const NoteContent = z.object({ text: NonEmpty });
export type NoteContent = z.infer<typeof NoteContent>;

const DocBase = z.object({
  id: NonEmpty,
  title: NonEmpty,
  arrivesAtTurn: PositiveInt.nullable(),
});

export const CaseDoc = z.discriminatedUnion('kind', [
  DocBase.extend({ kind: z.literal('email_thread'), content: EmailThreadContent }),
  DocBase.extend({ kind: z.literal('crm_record'), content: CrmRecordContent }),
  DocBase.extend({ kind: z.literal('slack_thread'), content: SlackThreadContent }),
  DocBase.extend({ kind: z.literal('table'), content: TableContent }),
  DocBase.extend({ kind: z.literal('note'), content: NoteContent }),
]);
export type CaseDoc = z.infer<typeof CaseDoc>;

export const CaseDocKind = z.enum(['email_thread', 'crm_record', 'slack_thread', 'table', 'note']);
export type CaseDocKind = z.infer<typeof CaseDocKind>;

export type ParsedDocContent = {
  [K in CaseDocKind]: Pick<Extract<CaseDoc, { kind: K }>, 'kind' | 'content'>;
}[CaseDocKind];

/** Validate the same content shape used by generated cases before rendering it. */
export function parseDocContent(doc: Pick<CaseDoc, 'kind' | 'content'>): ParsedDocContent | null {
  const result = CaseDoc.safeParse({ id: 'content-preview', title: 'Content preview', arrivesAtTurn: null, ...doc });
  if (!result.success) return null;
  const { kind, content } = result.data;
  return { kind, content } as ParsedDocContent;
}
