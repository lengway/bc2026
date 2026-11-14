import type { AiUseCheck, InputMode, MoveLabel, ScoreEvidence } from '@/contracts';
import type { Rubric } from '@/contracts/rubric';
import type { EvaluatedMoves } from '@/modules/llm';
import { SubmittedSnapshot } from '@/modules/simulation';
import view from '../../../mocks/fixtures/case-view.json';

type Event = SubmittedSnapshot['events'][number];
type Draft = SubmittedSnapshot['drafts'][number];
interface Golden {
  turns: { user: string; persona: string; label: string; criterion: string; trust: number }[];
  copilot?: string;
  presented?: boolean;
  trap?: { status: string; turn: number };
  check: string;
}

const caseId = '16000000-0000-4000-8000-000000001000';
const userId = '16000000-0000-4000-8000-000000001001';
const id = (n: number) => `16000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const timestamp = (seconds: number) => new Date(Date.parse('2026-05-11T09:00:00.000Z') + seconds * 1000).toISOString();
export const errorClaim = 'The pilot costs $1,800 per quarter.';
const correctClaim = 'A four-week pilot costs $1,800 per month, billed monthly.';
const hidden = {
  personality: 'Practical', style: 'Brief', realMotive: 'Meet a deadline', constraints: [], triggersOpen: [],
  triggersClose: [], knows: [], willNeverSayFirst: [], patience: 6, initialTrust: 45,
};
const criteria = view.scoringGuide.criteria.map((criterion) => ({
  ...criterion, required: ['discovery', 'value_articulation', 'closing'].includes(criterion.id),
}));
const rubric: Rubric = {
  version: view.scoringGuide.version, criteria, twists: [],
  keyMoments: ['discovery', 'value_articulation', 'objection_handling', 'closing'].map((name) => ({
    id: name, description: name, idealMove: 'Use concrete facts.', why: 'Focus on the case requirements.',
  })),
  traps: [{ id: 'billing-trap', injectAtCopilotCall: 1, errorToInject: errorClaim, howToCatch: correctClaim }],
  successCriteria: ['Agree one practical next step with the yard lead.'],
  aiUseChecks: [
    { id: 'verify-cadence', criterionId: 'critical_ai_use', description: 'Verify cadence', maxPoints: 3, passConditions: ['Cite the tariff'],
      failureConditions: ['Quote quarterly billing'], sourceRefs: ['terms'] },
    { id: 'verify-conversion', criterionId: 'critical_ai_use', description: 'Verify conversion',
      maxPoints: 2, passConditions: ['Check renewal terms'], failureConditions: ['Invent terms'], sourceRefs: ['terms'] },
  ],
};
export const modelOutput = { moves: [], aiUseChecks: [], summary: 'Review completed from the transcript.', skills: [] };

function event(seq: number, actor: Event['actor'], type: Event['type'], content: string, meta: Event['meta'] = {}): Event {
  return { id: id(seq), caseId, seq, actor, type, content, meta, isPublic: true,
    personaId: type === 'message' ? view.personas[0].id : null, createdAt: timestamp(seq * 10), clientMsgId: null, draftId: null };
}

export function candidate(move: Event, label: MoveLabel, rubricRef: string): EvaluatedMoves['moves'][number] {
  return { eventId: move.id, label, rubricRef, why: 'The quoted action establishes the label for this criterion.',
    betterMove: null, assessmentStatus: 'assessed',
    evidence: [{ source: 'user_event', sourceId: move.id, quote: move.content, explanation: 'This is the action being assessed.' }] };
}

function observation(move: Event, kind: Draft['events'][number]['kind'], sourceEventId: string | null): Draft {
  const draftId = id(100 + move.seq);
  const isKeyboard = kind !== 'paste' && kind !== 'copilot_insert';
  move.draftId = draftId;
  const editTime = timestamp(move.seq * 10 - 1);
  return {
    draftId, messageEventId: move.id, closedAt: move.createdAt, limitations: [],
    events: [{ id: id(200 + move.seq), draftId, seq: 1, kind, inputMode: (isKeyboard ? 'keyboard' : 'unknown') satisfies InputMode,
      clientAt: editTime, receivedAt: editTime, rangeStart: 0, rangeEnd: 0, insertedText: move.content, sourceEventId,
      inputType: 'insertText', isComposing: false, isTrusted: true }],
    interactionWindows: [{ id: id(300 + move.seq), startedAt: timestamp(move.seq * 10 - 7), endedAt: editTime,
      receivedAt: editTime, durationMs: 6000, pointerTypes: isKeyboard ? [] : ['touch'], pointerMoveSamples: null,
      pointerDownCount: 0, clickCount: 0, wheelCount: 0, pathLengthNormalized: null, directionChanges: null,
      movementIntervalSummary: null, inputIntervalSummary: null, editCount: 1, focusTransitionCount: 0,
      visibleDurationMs: 6000, trustedEventCount: 1, untrustedEventCount: 0, webdriverReported: false, capabilityGaps: [] }],
  };
}

export function snapshotFor(fixture: Golden, { telemetry = false }: { telemetry?: boolean } = {}) {
  const events: Event[] = [];
  const drafts: Draft[] = [];
  const response: EvaluatedMoves = { ...modelOutput, moves: [], aiUseChecks: [] };
  let copilot: Event | undefined;
  for (const [index, turn] of fixture.turns.entries()) {
    if (fixture.copilot && index === (fixture.trap?.turn ?? 0)) {
      events.push(event(events.length + 1, 'user', 'copilot_prompt', 'What billing term should I quote?'));
      copilot = event(events.length + 1, 'copilot', 'copilot_reply', fixture.copilot,
        fixture.presented ? { trapId: 'billing-trap', trapPresented: true } : {});
      events.push(copilot);
    }
    if (index === 0 && events.length === 0) events.push(event(1, 'system', 'doc_open', 'Pricing tariff', { documentIds: ['terms'] }));
    const move = event(events.length + 1, 'user', 'message', turn.user, { availableDocumentIds: ['terms'], userTurn: index + 1 });
    events.push(move, event(events.length + 2, 'persona', 'message', turn.persona,
      { replyToEventId: move.id, innerThought: 'The operational details matter.', trustAfter: turn.trust }));
    response.moves.push(candidate(move, turn.label as MoveLabel, turn.criterion));
    if (telemetry) drafts.push(observation(move, 'insert', null));
  }
  if (copilot && fixture.trap) {
    const move = response.moves[fixture.trap.turn];
    const user = events.find((event) => event.id === move.eventId)!;
    const evidence: ScoreEvidence[] = [
      { source: 'user_event', sourceId: user.id, quote: user.content, explanation: 'This move accepted or corrected the billing advice.' },
      { source: 'copilot_event', sourceId: copilot.id, quote: errorClaim, explanation: 'The saved reply gives the wrong term.' },
      { source: 'case_doc', sourceId: 'terms', quote: correctClaim, explanation: 'The pricing tariff defines the correct term.' },
    ];
    response.trapAssessment = { status: fixture.trap.status as 'caught' | 'missed', evidence };
    response.aiUseChecks.push({
      id: 'verify-cadence', criterionId: 'critical_ai_use', status: fixture.check as AiUseCheck['status'], maxPoints: 3,
      earnedPoints: fixture.check === 'passed' ? 3 : 0, evidence, reason: 'The transcript records a response to the published term.',
    });
  }
  const snapshot = SubmittedSnapshot.parse({
    version: 1, case: { ...view, id: caseId, userId, level: 'intermediate', isDemo: false, isGuest: false, rubric,
      docs: [
        { id: 'terms', title: 'Pricing tariff', kind: 'note', content: { text: correctClaim }, arrivesAtTurn: null },
        { id: 'later', title: 'Budget update', kind: 'note', content: { text: 'The next budget is $1,200.' }, arrivesAtTurn: 3 },
      ],
      personas: [{ public: view.personas[0], hidden, state: { turn: fixture.turns.length, trust: fixture.turns.at(-1)?.trust ?? 45,
        patience: 6, mood: 'neutral', revealed: [], outcome: null } }],
      startedAt: timestamp(0), timeLimitSec: 480, model: 'mock-creator', promptVersion: '1',
    },
    events, drafts, submittedAt: timestamp(210), reason: 'user', limitations: [],
  });
  return { snapshot, response };
}
