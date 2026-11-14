import { CaseParams, type Evaluation, type MoveReview, type ReviewResponse } from '@/contracts';
import type { Database, SqlExecutor } from '@/modules/database';
import type { Job, JobsService } from '@/modules/jobs';
import { EvaluatedMoves, type LlmService } from '@/modules/llm';
import { AppError, systemClock, type Clock } from '@/modules/shared';
import type { SimulationService, SubmittedSnapshot } from '@/modules/simulation';
import { prepareSubmission } from './observations';
import { evaluationLease, publishReview, readReview, readReviewState, reconcileFailed } from './repo';
import { assessSubmission, presentedTraps, recordedTrustCurve } from './scoring';

export interface EvaluationDeps {
  db: Database;
  llm: LlmService;
  simulation: Pick<SimulationService, 'loadSubmission'>;
  jobs: JobsService;
  now?: Clock;
  onEvaluated?: (tx: SqlExecutor, snapshot: SubmittedSnapshot, evaluation: Evaluation, moves: MoveReview[]) => Promise<void>;
}
interface EvaluationLease { jobId: string; owner: string; token: string }

export function createEvaluationService({ db, llm, simulation, jobs, now = systemClock, onEvaluated }: EvaluationDeps) {
  async function evaluateCase(caseId: string, lease: EvaluationLease): Promise<ReviewResponse> {
    CaseParams.parse({ id: caseId });
    const held = await evaluationLease(db, lease.jobId, caseId, lease.owner, lease.token, now());
    if (held === 'completed') return readReview(db, caseId);
    if (held !== 'running') throw new Error('Evaluation lease lost');
    const snapshot = await simulation.loadSubmission(caseId);
    if (!snapshot || snapshot.case.id !== caseId) throw new Error('Submitted case snapshot unavailable');
    const state = await readReviewState(db, caseId);
    if (!state || state.status !== 'submitted' || state.userId !== snapshot.case.userId) throw new Error('Case is not awaiting evaluation');
    const prepared = prepareSubmission(snapshot);
    const scored = prepared.messages.length > 0 ? await llm.run('eval.moves', {
      log: prepared.events.map(({ id, seq, actor, type, content, meta }) => ({
        id, seq, actor, type, content,
        ...(actor === 'user' && type === 'message' ? { userTurn: meta.userTurn, availableDocumentIds: meta.availableDocumentIds } : {}),
      })),
      docs: snapshot.case.docs,
      rubric: snapshot.case.rubric,
      trustCurve: recordedTrustCurve(prepared),
      trapInfo: presentedTraps(prepared).map(({ trap, reply }) => ({ trapId: trap.id, eventId: reply.id, erroneousClaim: trap.errorToInject })),
      assistance: { copilotRequests: prepared.assistance.copilotRequests },
    }, EvaluatedMoves, { caseId }) : {
      data: { moves: [], aiUseChecks: [], skills: [], summary: 'No submitted actions were available for assessment.' },
      meta: { model: 'not_run', promptVersion: 'not_run' },
    };
    const review = assessSubmission(prepared, scored.data, scored.meta);
    return db.transaction(async (tx) => {
      if (!await jobs.completeWithExecutor(tx, lease.jobId, lease.owner, lease.token)) throw new Error('Evaluation lease lost');
      await publishReview(tx, review, now());
      await onEvaluated?.(tx, snapshot, review.evaluation, review.moves);
      return review;
    });
  }

  return {
    evaluateCase,
    async handleEvaluateJob(job: Job, lease: EvaluationLease) {
      if (job.kind !== 'case.evaluate' || job.id !== lease.jobId) throw new Error('Invalid evaluation job');
      await evaluateCase(job.caseId, lease);
    },
    async getReview(caseId: string, userId: string) {
      const valid = CaseParams.safeParse({ id: caseId });
      const state = valid.success ? await readReviewState(db, caseId, userId) : null;
      if (!state) throw new AppError('NOT_FOUND', 404, 'Review not found.');
      if (state.status === 'failed') throw new AppError('LLM_FAILED', 503, 'The review could not be prepared.');
      if (state.status !== 'evaluated') throw new AppError('VALIDATION', 409, 'The review is not available yet.');
      return readReview(db, caseId);
    },
    reconcileFailedEvaluations: () => reconcileFailed(db),
  };
}

export type EvaluationService = ReturnType<typeof createEvaluationService>;
