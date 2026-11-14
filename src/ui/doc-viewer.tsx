import { Building2, FileText, Hash, Mail, Table2 } from "lucide-react";
import {
  parseDocContent,
  type CaseDoc,
  type CaseDocKind,
  type CrmRecordContent,
  type EmailThreadContent,
  type NoteContent,
  type SlackThreadContent,
  type TableContent,
} from "@/contracts";
import { cn } from "@/ui/lib/utils";
import { PersonaAvatar } from "@/ui/persona-card";

const KIND_META: Record<CaseDocKind, { label: string; Icon: typeof Mail }> = {
  email_thread: { label: "Email", Icon: Mail },
  crm_record: { label: "CRM record", Icon: Building2 },
  slack_thread: { label: "Slack", Icon: Hash },
  table: { label: "Table", Icon: Table2 },
  note: { label: "Note", Icon: FileText },
};

const NUMERIC_CELL = /^[-−+]?[$€£]?[\d,.]+%?$/;

function EmailThread({ content }: { content: EmailThreadContent }) {
  return (
    <div className="flex flex-col">
      <p className="m-0 border-b px-5 py-3 text-[15px] font-medium">{content.subject}</p>
      <ol className="m-0 list-none divide-y p-0">
        {content.messages.map((message, index) => (
          <li key={index} className="flex flex-col gap-3 px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="m-0 text-sm">
                <span className="font-medium">{message.from}</span>
                <span className="text-muted-foreground"> to {message.to.join(", ")}</span>
              </p>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {message.sentAt}
              </span>
            </div>
            <p className="m-0 text-sm leading-relaxed whitespace-pre-line">{message.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CrmRecord({ content }: { content: CrmRecordContent }) {
  return (
    <div className="flex flex-col">
      <p className="m-0 border-b px-5 py-3 text-[15px] font-medium">{content.account}</p>
      <dl className="m-0 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 px-5 py-2 text-sm">
        {[{ label: "Contact", value: content.contact }, { label: "Stage", value: content.stage }, ...content.fields].map((field, index) => (
          <div
            key={`${field.label}-${index}`}
            className="col-span-2 grid grid-cols-subgrid border-b py-2 last:border-b-0"
          >
            <dt className="text-muted-foreground">{field.label}</dt>
            <dd className="m-0">{field.value}</dd>
          </div>
        ))}
      </dl>
      {content.notes.length > 0 ? (
        <div className="border-t bg-surface px-5 py-4">
          <p className="m-0 mb-3 text-xs font-medium text-muted-foreground">Notes</p>
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm">
            {content.notes.map((entry, index) => (
              <li key={index}>{entry}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function SlackThread({ content }: { content: SlackThreadContent }) {
  return (
    <div className="flex flex-col">
      <p className="m-0 border-b px-5 py-3 font-mono text-sm">#{content.channel}</p>
      <ol className="m-0 flex list-none flex-col gap-4 px-5 py-4">
        {content.messages.map((message, index) => (
          <li key={index} className="flex items-start gap-3">
            <PersonaAvatar name={message.author} />
            <div className="min-w-0">
              <p className="m-0 flex items-baseline gap-2 text-sm">
                <span className="font-medium">{message.author}</span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {message.sentAt}
                </span>
              </p>
              <p className="m-0 text-sm leading-relaxed whitespace-pre-line">{message.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function DataTable({ content }: { content: TableContent }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {content.caption ? (
          <caption className="caption-bottom border-t px-5 py-3 text-left text-xs text-muted-foreground">
            {content.caption}
          </caption>
        ) : null}
        <thead>
          <tr className="border-b bg-surface">
            {content.columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-5 py-2.5 text-left text-xs font-medium whitespace-nowrap text-muted-foreground"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {content.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cn(
                    "px-5 py-2.5 whitespace-nowrap",
                    cell !== null && NUMERIC_CELL.test(String(cell).trim()) && "font-mono tabular-nums",
                  )}
                >
                  {cell ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Note({ content }: { content: NoteContent }) {
  return (
    <p className="m-0 px-5 py-4 text-sm leading-relaxed whitespace-pre-line">{content.text}</p>
  );
}

/** Shown when a document's content does not match its kind. Still readable, never a crash. */
function RawContent({ content }: { content: unknown }) {
  const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  return (
    <pre className="m-0 overflow-x-auto px-5 py-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
      {text}
    </pre>
  );
}

type DocViewerProps = {
  doc: CaseDoc;
  /** Marks a document that arrived mid-case (a twist). */
  isNew?: boolean;
  className?: string;
};

/** Renders a case document so it reads like the real work tool it comes from. */
export function DocViewer({ doc, isNew = false, className }: DocViewerProps) {
  const { label, Icon } = KIND_META[doc.kind];
  const parsed = parseDocContent(doc);

  return (
    <article
      aria-label={doc.title}
      data-kind={doc.kind}
      className={cn("overflow-hidden rounded-xl border bg-card text-card-foreground", className)}
    >
      <header className="flex items-center justify-between gap-3 border-b bg-surface px-5 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.5} />
          <span>{label}</span>
          <span aria-hidden="true">·</span>
          <h3 className="m-0 truncate text-xs font-medium text-foreground">{doc.title}</h3>
        </div>
        {isNew ? (
          <span className="rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">
            New
          </span>
        ) : null}
      </header>

      {parsed === null ? <RawContent content={doc.content} /> : null}
      {parsed?.kind === "email_thread" ? <EmailThread content={parsed.content} /> : null}
      {parsed?.kind === "crm_record" ? <CrmRecord content={parsed.content} /> : null}
      {parsed?.kind === "slack_thread" ? <SlackThread content={parsed.content} /> : null}
      {parsed?.kind === "table" ? <DataTable content={parsed.content} /> : null}
      {parsed?.kind === "note" ? <Note content={parsed.content} /> : null}
    </article>
  );
}
