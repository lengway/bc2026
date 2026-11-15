import { CertificateTranscriptEvent, Evaluation, MOVE_LABEL_POINTS, ReviewResponse, type AiUseSkill, type CriterionCoverage, type MoveReview, type ScoreEvidence, type TrapResult } from '@/contracts';
import { Percent } from '@/contracts/primitives';
import type { EvaluatedMoves } from '@/modules/llm';
import { createEvidenceValidator, looksLikeScorerInstruction, type EvidenceValidator } from './evidence';
import { similarityVersion, type PreparedSubmission } from './observations';
import { moveAssessmentIssues } from './proposals';

const normalize = (text: string) => text.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');

export function presentedTraps({ snapshot, replies }: PreparedSubmission) {
  return snapshot.case.rubric.traps.flatMap((trap) => replies
    .filter((reply) => reply.meta.trapId === trap.id && reply.meta.trapPresented === true && reply.content.includes(trap.errorToInject))
    .map((reply) => ({ trap, reply })));
}

function commitsClaim(text: string, claim: string) {
  if (!normalize(text).includes(normalize(claim).replace(/[.!?]$/, ''))) return false;
  // Exact repetition is sufficient only when it reads as a commitment. Ambiguous quotes are left to evidence review.
  return !/[“”"]/.test(text) && !/\b(?:incorrect|wrong|false|mistak(?:e|en)|actually|rather|instead|contradicts?|not|never|said|suggested|quoted|verify|check|correct)\b/i.test(text);
}

const wordSet = (text: string) => new Set(normalize(text).match(/[\p{L}\p{N}]+/gu) ?? []);
const associationStopWords = new Set(['about','after','also','and','are','can','could','for','from','has','have',
  'how','is','may','our','per','that','the','this','use','was','we','what','while','with','would','will','you','your']);

function sharedClaimTerms(left: string, right: string, exclude = new Set<string>()) {
  const rightWords = wordSet(right);
  return [...wordSet(left)].filter((word) => word.length > 1 && !associationStopWords.has(word) && !exclude.has(word) && rightWords.has(word)).length;
}

function negatesDocumentCorrection(message: string, wrongClaim: string, documentQuote: string) {
  const wrongTerms = wordSet(wrongClaim);
  const documentTerms = new Set([...wordSet(documentQuote)].filter((term) =>
    term.length > 1 && !wrongTerms.has(term) && !associationStopWords.has(term)));
  // Inspect the full message so a clipped evidence quote cannot hide a local negation.
  // A new clause can affirm the correct term after negating the mistaken one.
  const clauses = normalize(message).split(/[,.:](?!\d)|[;!?—–]|\b(?:but|instead|rather)\b/);
  return clauses.some((clause) => {
    const negation = /\b(?:not|never|[a-z]+n['’]t)\b(?!\s+only\b)/.exec(clause);
    if (!negation) return false;
    const negatedText = clause.slice(negation.index + negation[0].length);
    return [...wordSet(negatedText)].some((term) => documentTerms.has(term));
  });
}

type TrapAssessment = { result: Exclude<TrapResult, 'caught'> } |
  { result: 'caught'; moveId: string; claim: string; evidence: ScoreEvidence[] };

function classifyTrap(prepared: PreparedSubmission, proposal: EvaluatedMoves['trapAssessment'], evidence: EvidenceValidator): TrapAssessment {
  const presented = presentedTraps(prepared);
  if (presented.length === 0) return { result: 'not_presented' };
  const latestDirect = prepared.messages.findLast((message) => !looksLikeScorerInstruction(message.content) && presented.some(({ trap, reply }) =>
    message.seq > reply.seq && commitsClaim(message.content, trap.errorToInject)));
  const fallback: TrapAssessment = { result: latestDirect ? 'missed' : 'insufficient_evidence' };
  if (!proposal || proposal.status === 'insufficient_evidence') return fallback;
  const move = evidence.moveFor(proposal.evidence);
  if (!move || looksLikeScorerInstruction(move.content) || (latestDirect && latestDirect.seq >= move.seq) ||
    !proposal.evidence.every((item) => evidence.validates(item, move))) return fallback;
  const source = presented.find(({ reply, trap }) => reply.seq < move.seq && proposal.evidence.some((item) =>
    item.source === 'copilot_event' && item.sourceId === reply.id && item.quote.includes(trap.errorToInject)));
  if (!source) return fallback;
  const citedMove = proposal.evidence.filter((item) => item.source === 'user_event' && item.sourceId === move.id);
  const claim = source.trap.errorToInject;
  if (proposal.status === 'missed') {
    const adoptsClaim = citedMove.some(({ quote }) => (
      sharedClaimTerms(quote, claim) >= 2 && !/[“”"]/.test(quote) &&
      !/\b(?:not|never|wrong|incorrect|false|instead|rather|verify|check|quoted|said)\b/i.test(move.content)
    ));
    return adoptsClaim ? { result: 'missed' } : fallback;
  }
  const docs = proposal.evidence.filter((item) => item.source === 'case_doc');
  const wrongTerms = wordSet(claim);
  const citesCorrection = citedMove.some(({ quote }) => !source.reply.content.includes(quote) &&
    sharedClaimTerms(quote, claim) > 0 && docs.some((doc) => (
      sharedClaimTerms(quote, doc.quote, wrongTerms) > 0 && !negatesDocumentCorrection(move.content, claim, doc.quote)
    )));
  return citesCorrection ? { result: 'caught', moveId: move.id, claim, evidence: proposal.evidence } : fallback;
}

function uniqueProposals<T>(entries: T[], key: (entry: T) => string) {
  const grouped = new Map<string, T | null>();
  for (const entry of entries) {
    const id = key(entry);
    grouped.set(id, grouped.has(id) ? null : entry);
  }
  return grouped;
}

function trustedReplies(prepared: PreparedSubmission) {
  const byId = new Map(prepared.messages.map((event) => [event.id, event]));
  const replies = new Map<string, { trust: number; innerThought: string }>();
  for (const event of prepared.events) {
    const { replyToEventId, trustAfter, innerThought } = event.meta;
    if (event.actor !== 'persona' || event.type !== 'message' || typeof replyToEventId !== 'string') continue;
    const move = byId.get(replyToEventId);
    const trust = Percent.safeParse(trustAfter);
    if (!move || move.personaId !== event.personaId || move.seq >= event.seq || !trust.success || replies.has(move.id)) continue;
    replies.set(move.id, { trust: trust.data, innerThought: typeof innerThought === 'string' ? innerThought : '' });
  }
  return replies;
}

export function recordedTrustCurve(prepared: PreparedSubmission) {
  const replies = trustedReplies(prepared);
  return prepared.messages.flatMap((message) => {
    const result = replies.get(message.id);
    return result ? [{ seq: message.seq, trust: result.trust }] : [];
  });
}

function makeMoves(prepared: PreparedSubmission, proposals: EvaluatedMoves['moves'], evidence: EvidenceValidator, trap: TrapAssessment) {
  const grouped = uniqueProposals(proposals, (proposal) => proposal.eventId);
  const replies = trustedReplies(prepared);
  const criteria = new Set(prepared.snapshot.case.rubric.criteria.map((criterion) => criterion.id));
  const personaTrust = new Map(prepared.snapshot.case.personas.map(({ public: persona, hidden }) => [persona.id, hidden.initialTrust]));
  return prepared.messages.map((move) => {
    const proposal = grouped.get(move.id);
    const reply = replies.get(move.id);
    const personId = move.personaId ?? '';
    const before = personaTrust.get(personId) ?? 0;
    const trustAfter = reply?.trust ?? before;
    personaTrust.set(personId, trustAfter);
    const assessed = proposal?.assessmentStatus === 'assessed' && moveAssessmentIssues(proposal, move, criteria, evidence).length === 0;
    const correction = trap.result === 'caught' && trap.moveId === move.id ? trap : null;
    // A verified trap correction establishes the existing AI-use criterion independently of the ordinary move proposal.
    const correctionCriterion = correction && proposal?.assessmentStatus === 'insufficient_evidence' && criteria.has('critical_ai_use')
      ? 'critical_ai_use' : null;
    const rubricRef = assessed ? proposal.rubricRef : correctionCriterion;
    const moveEvidence = assessed ? proposal.evidence : [];
    const label = correction ? 'brilliant' : proposal?.label ?? 'good';
    const review = {
      eventId: move.id, seq: move.seq, userText: move.content, trustAfter, innerThought: reply?.innerThought ?? '',
      ...(rubricRef !== null && proposal ? {
        label, points: MOVE_LABEL_POINTS[label], betterMove: assessed ? proposal.betterMove : null,
        why: correction ? `You caught the Copilot error “${correction.claim}” and corrected it using the case documents.` : proposal.why,
        rubricRef, evidence: correction ? [...moveEvidence, ...correction.evidence.filter((item) =>
          !moveEvidence.some((existing) => existing.source === item.source && existing.sourceId === item.sourceId && existing.quote === item.quote))]
          : moveEvidence, assessmentStatus: 'assessed' as const,
      } : {
        label: 'good' as const, points: null, why: 'This move did not have sufficient verified evidence for a score.',
        betterMove: null, rubricRef: null, evidence: [], assessmentStatus: 'insufficient_evidence' as const,
      }),
    } satisfies MoveReview;
    return { review, trustChange: Math.abs(trustAfter - before) };
  });
}

function evaluateAiSkill(prepared: PreparedSubmission, proposals: EvaluatedMoves['aiUseChecks'], evidence: EvidenceValidator): AiUseSkill {
  const grouped = uniqueProposals(proposals, (proposal) => proposal.id);
  const anyOpportunity = prepared.messages.some((message) => prepared.replies.some((reply) => reply.seq < message.seq));
  const presented = presentedTraps(prepared);
  const checks = prepared.snapshot.case.rubric.aiUseChecks.map((check) => {
    const proposal = grouped.get(check.id);
    const move = proposal && evidence.moveFor(proposal.evidence);
    const observed = anyOpportunity && proposal && (proposal.status === 'passed' || proposal.status === 'failed') &&
      proposal.criterionId === check.criterionId && proposal.maxPoints === check.maxPoints &&
      move && prepared.replies.some((reply) => reply.seq < move.seq) &&
      proposal.evidence.every((item) => evidence.validates(item, move)) &&
      proposal.evidence.some((item) => item.source === 'copilot_event') &&
      (proposal.status === 'failed' || check.sourceRefs.length === 0 ||
        proposal.evidence.some((item) => check.sourceRefs.includes(item.sourceId)));
    if (observed) {
      const negatedCorrection = proposal.status === 'passed' && presented.some(({ reply, trap }) =>
        proposal.evidence.some((item) => item.source === 'copilot_event' && item.sourceId === reply.id) &&
        proposal.evidence.some((item) => item.source === 'case_doc' && check.sourceRefs.includes(item.sourceId) &&
          negatesDocumentCorrection(move.content, trap.errorToInject, item.quote)));
      if (!negatedCorrection) return { ...proposal, earnedPoints: proposal.status === 'passed' ? check.maxPoints : 0 };
    }
    return {
      id: check.id, criterionId: check.criterionId, maxPoints: check.maxPoints, earnedPoints: 0, evidence: [],
      ...(anyOpportunity ? { status: 'not_observed' as const, reason: 'No verified evidence established this check.' } :
        { status: 'not_applicable' as const, reason: 'No copilot reply preceded a submitted message.' }),
    };
  });
  const assessed = checks.filter((check) => check.status === 'passed' || check.status === 'failed');
  const applicable = checks.filter((check) => check.status !== 'not_applicable');
  const assessedMaxPoints = assessed.reduce((sum, check) => sum + check.maxPoints, 0);
  const earnedPoints = assessed.reduce((sum, check) => sum + check.earnedPoints, 0);
  return {
    checks, assessedChecks: assessed.length, applicableChecks: applicable.length, earnedPoints, assessedMaxPoints,
    applicableMaxPoints: applicable.reduce((sum, check) => sum + check.maxPoints, 0),
    score: assessedMaxPoints ? Math.round(100 * earnedPoints / assessedMaxPoints) : null,
  };
}

export function assessSubmission(
  prepared: PreparedSubmission, proposed: EvaluatedMoves, scorer: { model: string; promptVersion: string },
): ReviewResponse {
  const { snapshot, messages, assistance, processObservations } = prepared;
  const rubric = snapshot.case.rubric;
  const evidence = createEvidenceValidator(prepared);
  const trap = classifyTrap(prepared, proposed.trapAssessment, evidence);
  const rows = makeMoves(prepared, proposed.moves, evidence, trap);
  const moves = rows.map(({ review }) => review);
  const scored = rows.filter(({ review }) => review.points !== null);
  const pointsSum = scored.reduce((total, { review }) => total + (review.points ?? 0), 0);
  const maxPoints = scored.length * 100;
  const aiUseSkill = evaluateAiSkill(prepared, proposed.aiUseChecks, evidence);
  const trapResult = trap.result;
  const labelCounts = { brilliant: 0, best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
  for (const { review } of scored) labelCounts[review.label] += 1;
  const priority = (move: MoveReview) => Number(move.label === 'brilliant' || move.label === 'blunder');
  const topMoves = [...scored].sort((a, b) => priority(b.review) - priority(a.review) ||
    b.trustChange - a.trustChange || a.review.seq - b.review.seq).slice(0, 3).map(({ review }) => review);
  const skillScores = rubric.criteria.map(({ id }) => {
    const points = scored.filter(({ review }) => review.rubricRef === id).map(({ review }) => review.points ?? 0);
    if (id === 'critical_ai_use') return { skill: id, score: aiUseSkill.score };
    return { skill: id, score: points.length > 0 ? Math.round(points.reduce<number>((sum, point) => sum + point, 0) / points.length) : null };
  });
  const criterionCoverage: CriterionCoverage[] = rubric.criteria.map(({ id }) => {
    const observations = scored.filter(({ review }) => review.rubricRef === id);
    const scoredChecks = aiUseSkill.checks.filter((check) => check.criterionId === id);
    const checked = scoredChecks.filter((check) => check.status === 'passed' || check.status === 'failed');
    const values = [...observations.map(({ review }) => review.points ?? 0), ...checked.map((check) => check.status === 'passed' ? 100 : 0)];
    if (values.length === 0) return { criterionId: id, status: scoredChecks.length > 0 &&
      scoredChecks.every((check) => check.status === 'not_applicable') ? 'not_applicable' : 'not_observed' };
    const status = values.every((score) => score >= 80) ? 'met' :
      values.every((score) => score <= 20) ? 'not_met' : 'partially_met';
    return { criterionId: id, status };
  });
  const required = new Set(rubric.criteria.filter((criterion) => criterion.required).map((criterion) => criterion.id));
  const requiredMissing = criterionCoverage.some((item) => required.has(item.criterionId) && item.status === 'not_observed');
  const noScore = scored.length === 0;
  const partial = requiredMissing || scored.length !== messages.length || snapshot.limitations.length > 0;
  const outcome = snapshot.case.personas.find((persona) => persona.state.outcome !== null)?.state.outcome ?? 'incomplete';
  const evaluation = Evaluation.parse({
    caseId: snapshot.case.id, accuracy: noScore ? null : Math.round(100 * pointsSum / maxPoints), labelCounts,
    aiDependency: assistance.copilotTextSimilarityPercent, trapCaught: trapResult === 'caught', trapResult,
    assistance, aiUseSkill, processObservations, outcome, topMoves, trustCurve: recordedTrustCurve(prepared),
    summary: noScore ? 'The recorded actions did not provide enough verified evidence for a move score.' : proposed.summary,
    skills: skillScores.filter((entry) => entry.score !== null),
    scoreAudit: {
      rubricVersion: rubric.version, scorerModel: scorer.model, scorerPromptVersion: scorer.promptVersion,
      caseLevel: snapshot.case.level, labelPoints: MOVE_LABEL_POINTS,
      formula: `${snapshot.case.scoringGuide.accuracyFormula} Copilot text similarity uses ${similarityVersion} independently of skill points.`,
      scoredMoveCount: scored.length, totalUserMoveCount: messages.length, pointsSum, maxPoints, criterionCoverage,
      completionStatus: noScore ? 'insufficient_evidence' : partial ? 'partial' : 'complete',
      limitations: [
        ...(scored.length !== messages.length ? ['Some submitted messages could not be assessed from verified evidence.'] : []),
        ...(requiredMissing ? ['Some required criteria could not be observed.'] : []),
        ...(snapshot.limitations.length > 0 ? ['An operation was incomplete when the case was submitted.'] : []),
        'Scores reflect the recorded case and are not a standardized comparison between cases.',
      ],
    },
  });
  return ReviewResponse.parse({ evaluation, moves, transcript: prepared.events.map((event) => CertificateTranscriptEvent.parse(event)) });
}
