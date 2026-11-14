import type { CaseDoc, ScoreEvidence } from '@/contracts';
import type { PreparedSubmission, SnapshotEvent } from './observations';

export function looksLikeScorerInstruction(text: string): boolean {
  return /\b(?:ignore|disregard|override|forget|replace)\s+(?:(?:all|any|the|your|previous|prior|original|system|evaluation|scoring|above)\s+){1,5}(?:instructions?|rubric|system prompt)\b/i.test(text) ||
    /\b(?:give|assign|award)\s+me\s+(?:a\s+)?(?:brilliant label|blunder label|100 points|perfect score)\b/i.test(text) ||
    /\b(?:set|output|return)\s+(?:(?:the|my)\s+)?(?:score|grade|label|accuracy)\s*(?:to|[:=])/i.test(text);
}

function quoteMaterial(doc: CaseDoc): string[] {
  switch (doc.kind) {
    case 'email_thread': return [doc.content.subject, ...doc.content.messages.flatMap((item) => [item.from, ...item.to, item.sentAt, item.body])];
    case 'crm_record': return [doc.content.account, doc.content.contact, doc.content.stage, ...doc.content.notes,
      ...doc.content.fields.flatMap((field) => [field.label, field.value])];
    case 'slack_thread': return doc.content.messages.flatMap((item) => [item.author, item.sentAt, item.text]);
    case 'table': return [...doc.content.columns, ...doc.content.rows.flat().flatMap((cell) => cell === null ? [] : [String(cell)])];
    case 'note': return [doc.content.text];
  }
}

export function createEvidenceValidator(prepared: PreparedSubmission) {
  const eventById = new Map(prepared.events.map((event) => [event.id, event]));
  const docs = new Map(prepared.snapshot.case.docs.map((doc) => [doc.id, quoteMaterial(doc)]));

  function rejection(evidence: ScoreEvidence, move: SnapshotEvent): string | null {
    if (!evidence.quote.trim()) return 'Evidence quote is blank.';
    if (evidence.source === 'case_doc') {
      const available = move.meta.availableDocumentIds;
      if (!Array.isArray(available) || !available.includes(evidence.sourceId)) return 'Document was not available at this move.';
      return docs.get(evidence.sourceId)?.some((text) => text.includes(evidence.quote))
        ? null : 'Quote is not an exact excerpt of the referenced document field.';
    }
    const source = eventById.get(evidence.sourceId);
    if (!source) return 'Evidence source event does not exist in this case.';
    if (source.seq > move.seq) return 'Evidence source occurred after this move.';
    if (!source.content.includes(evidence.quote)) return 'Quote is not an exact excerpt of the referenced event content.';
    switch (evidence.source) {
      case 'user_event':
        if (source.actor !== 'user' || source.type !== 'message') return 'user_event must reference a learner message.';
        return looksLikeScorerInstruction(evidence.quote) ? 'Instructions to the evaluator are not skill evidence.' : null;
      case 'persona_event': return source.actor === 'persona' && source.type === 'message'
        ? null : 'persona_event must reference a persona message.';
      case 'copilot_event': return source.actor === 'copilot' && source.type === 'copilot_reply'
        ? null : 'copilot_event must reference a copilot reply.';
      case 'editor_aggregate': return 'Editor observations cannot establish a move score.';
    }
  }

  function moveFor(evidence: ScoreEvidence[]) {
    const cited = evidence.filter((item) => item.source === 'user_event').map((item) => eventById.get(item.sourceId));
    if (cited.length === 0 || cited.some((item) => !item)) return undefined;
    return cited.reduce<SnapshotEvent | undefined>((latest, event) => event && (!latest || event.seq > latest.seq) ? event : latest, undefined);
  }

  return { validates: (item: ScoreEvidence, move: SnapshotEvent) => rejection(item, move) === null, rejection, moveFor };
}
export type EvidenceValidator = ReturnType<typeof createEvidenceValidator>;
