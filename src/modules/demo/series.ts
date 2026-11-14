import { randomUUID } from 'node:crypto';
import type { ReviewResponse, ScoreEvidence } from '@/contracts';
import { scoringGuide } from '@/modules/case-engine';
import type { CatalogService } from '@/modules/catalog';
import { assessSubmission, prepareSubmission } from '@/modules/evaluation';
import type { EvaluatedMoves } from '@/modules/llm';
import { SubmittedSnapshot } from '@/modules/simulation';
import { loadScenario, scenarios } from './scenarios';

export const DEMO_SERIES_MODEL = 'synthetic-demo-series';
const scorer = { model: DEMO_SERIES_MODEL, promptVersion: '1' };
type SnapshotEvent = SubmittedSnapshot['events'][number];

function prepareCase(
  { archetype, demo, crmId, term, turns }: Awaited<ReturnType<typeof loadScenario>>,
  userId: string, submittedAt: Date, concern: string,
): { archetypeId: string; snapshot: SubmittedSnapshot; review: ReviewResponse } {
  const caseId = randomUUID();
  const original = demo.personas[0];
  const persona = { ...original.public, id: randomUUID() };
  const startedAt = new Date(submittedAt.getTime() - 180_000);
  const events: SnapshotEvent[] = [];
  function append(
    actor: SnapshotEvent['actor'], type: SnapshotEvent['type'], content: string, meta: SnapshotEvent['meta'] = {},
  ) {
    const event: SnapshotEvent = {
      id: randomUUID(), caseId, seq: events.length + 1, actor, type, content, meta,
      personaId: type === 'message' ? persona.id : null,
      clientMsgId: null, draftId: null, isPublic: true,
      createdAt: (type === 'submit' ? submittedAt : new Date(startedAt.getTime() + events.length * 10_000)).toISOString(),
    };
    events.push(event);
    return event;
  }

  const trap = demo.rubric.traps[0];
  const check = demo.rubric.aiUseChecks[0];
  const proposed: EvaluatedMoves = {
    summary: 'Synthetic demo evaluation. The participant identified a buyer concern, checked the CRM terms and agreed on a practical next step.',
    moves: [], aiUseChecks: [], skills: [],
  };
  const opening = append('persona', 'message', concern);
  const documentIds = demo.case.docs.map(({ id }) => id);
  for (const [index, turn] of turns.entries()) {
    const verifiesTerms = turn.criterion === check.criterionId;
    const copilot = verifiesTerms ? (
      append('user', 'copilot_prompt', 'Summarize the commercial terms for this account.'),
      append('copilot', 'copilot_reply', trap.errorToInject, { trapId: trap.id, trapPresented: true })
    ) : null;
    const user = append('user', 'message', turn.content, { userTurn: index + 1, availableDocumentIds: documentIds });
    append('persona', 'message', turn.reply, { replyToEventId: user.id, trustAfter: turn.trust });
    const evidence: ScoreEvidence[] = [{
      source: 'user_event', sourceId: user.id, quote: user.content, explanation: turn.why,
    }];
    if (turn.criterion === 'closing') {
      evidence.push({ source: 'persona_event', sourceId: opening.id, quote: opening.content,
        explanation: 'The buyer’s original concern gives context for the agreed next step.' });
    }
    if (copilot) {
      evidence.push(
        { source: 'case_doc', sourceId: crmId, quote: term, explanation: 'The CRM records the commercial terms.' },
        { source: 'copilot_event', sourceId: copilot.id, quote: copilot.content, explanation: 'The copilot gave a conflicting term.' },
      );
      proposed.trapAssessment = { status: 'caught', evidence };
      proposed.aiUseChecks.push({
        id: check.id, criterionId: check.criterionId, status: 'passed', maxPoints: check.maxPoints,
        earnedPoints: check.maxPoints, evidence, reason: 'The participant checked the CRM and corrected the commercial term.',
      });
    }
    proposed.moves.push({
      eventId: user.id, label: turn.label, why: turn.why, betterMove: null,
      rubricRef: turn.criterion, evidence, assessmentStatus: 'assessed',
    });
  }
  append('system', 'submit', '', { reason: 'outcome' });
  const snapshot = SubmittedSnapshot.parse({
    version: 1,
    case: {
      ...demo.case, id: caseId, userId, level: archetype.difficulty, isDemo: true, isGuest: true,
      brief: { ...demo.case.brief, title: `Demo example · ${archetype.title}`, mission: archetype.setup },
      rubric: demo.rubric, scoringGuide: scoringGuide(demo.rubric),
      personas: [{ public: persona, hidden: original.hidden, state: {
        turn: turns.length, trust: turns.at(-1)!.trust, patience: original.hidden.patience,
        mood: 'engaged', revealed: [], outcome: 'won',
      } }],
      startedAt: startedAt.toISOString(), timeLimitSec: demo.case.brief.timeLimitSec,
      model: DEMO_SERIES_MODEL, promptVersion: scorer.promptVersion,
    },
    events, drafts: [], submittedAt: submittedAt.toISOString(), reason: 'outcome', limitations: [],
  });
  return { archetypeId: archetype.id, snapshot, review: assessSubmission(prepareSubmission(snapshot), proposed, scorer) };
}

export async function prepareDemoSeries(catalog: CatalogService, userId: string, now: Date) {
  const pack = await catalog.getPack('sales');
  return Promise.all(scenarios.map(async (scenario, index) => prepareCase(
    await loadScenario(catalog, pack, scenario), userId,
    new Date(now.getTime() - (scenarios.length - index) * 86_400_000), scenario.concern,
  )));
}
