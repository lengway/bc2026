import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createLlmService, type LlmCallRecord, type LlmRequest, type EvaluatedMoves } from '@/modules/llm';
import { prepareSubmission } from '../observations';
import { diagnoseMoveProposals, evaluationOutputSchema } from '../proposals';
import { assessSubmission } from '../scoring';
import strong from './golden/strong.json';
import synthetic from './golden/synthetic-net60.json';
import { snapshotFor } from './support';

describe('semantic scoring proposals', () => {
  const invalid: { name: string; change(response: EvaluatedMoves): void; expected: RegExp }[] = [
    { name: 'null criterion', change: (value) => { value.moves[0].rubricRef = null; }, expected: /rubric\.criteria/ },
    { name: 'unknown criterion', change: (value) => { value.moves[0].rubricRef = 'invented'; }, expected: /rubric\.criteria/ },
    { name: 'empty evidence', change: (value) => { value.moves[0].evidence = []; }, expected: /require a user_event quote/ },
    { name: 'invented quote', change: (value) => { value.moves[0].evidence[0].quote = 'Invented transcript text'; }, expected: /exact excerpt/ },
    { name: 'wrong source actor', change: (value) => { value.moves[0].evidence[0].source = 'persona_event'; }, expected: /persona_event must reference/ },
    { name: 'duplicate move', change: (value) => { value.moves.push(structuredClone(value.moves[0])); }, expected: /Duplicate assessment/ },
    { name: 'omitted move', change: (value) => { value.moves.pop(); }, expected: /Missing assessment/ },
    { name: 'foreign event', change: (value) => { value.moves[0].eventId = 'foreign'; }, expected: /learner message to a persona/ },
    { name: 'future evidence', change: (value) => { value.moves[0].evidence.push(structuredClone(value.moves[1].evidence[0])); }, expected: /occurred after/ },
    { name: 'unavailable document', change: (value) => { value.moves[0].evidence.push({ source: 'case_doc', sourceId: 'later',
      quote: 'The next budget is $1,200.', explanation: 'Unavailable budget.' }); }, expected: /not available/ },
  ];

  it.each(invalid)('repairs $name with precise feedback and keeps the original labels', async ({ change, expected }) => {
    const { snapshot, response } = snapshotFor(strong);
    const prepared = prepareSubmission(snapshot);
    const malformed = structuredClone(response);
    change(malformed);
    const requests: LlmRequest[] = [];
    const records: LlmCallRecord[] = [];
    const llm = createLlmService({ defaultModel: 'mock-scorer', recordCall: async (record) => { records.push(record); },
      provider: { async complete(request) {
        requests.push(request);
        return { model: request.model, text: JSON.stringify(requests.length === 1 ? malformed : response) };
      } } });
    expect(diagnoseMoveProposals(prepared, malformed.moves).map((issue) => issue.message).join(' ')).toMatch(expected);
    const result = await llm.run('eval.moves', { log: prepared.events, rubric: snapshot.case.rubric }, evaluationOutputSchema(prepared));
    expect(requests).toHaveLength(2);
    expect(requests[1].validationError).toMatch(expected);
    expect(records.map((record) => record.status)).toEqual(['invalid_schema', 'success']);
    expect(assessSubmission(prepared, result.data, result.meta).evaluation.accuracy).toBe(95);
    expect(result.data.moves.map((move) => move.label)).toEqual(response.moves.map((move) => move.label));
  });

  it('scores four substantive moves while excluding a greeting in a synthetic net-60 case', async () => {
    const { snapshot, response } = snapshotFor(synthetic);
    response.moves[0] = { ...response.moves[0], assessmentStatus: 'insufficient_evidence', rubricRef: null,
      evidence: [], why: 'A greeting alone does not establish a sales action.' };
    const prepared = prepareSubmission(snapshot);
    expect(evaluationOutputSchema(prepared).safeParse(response).success).toBe(true);
    const review = assessSubmission(prepared, response, { model: 'synthetic-fixture', promptVersion: '3' });
    expect(review.evaluation).toMatchObject({ accuracy: 83, scoreAudit: { scoredMoveCount: 4, totalUserMoveCount: 5 } });
    expect(review.moves[0]).toMatchObject({ points: null, assessmentStatus: 'insufficient_evidence' });
    expect(review.moves.slice(1).every((move) => move.assessmentStatus === 'assessed')).toBe(true);
  });

  it('still supplies required structural fields and exact-ID instructions to the provider', async () => {
    const { snapshot, response } = snapshotFor(strong);
    const schema = evaluationOutputSchema(prepareSubmission(snapshot));
    const jsonSchema = z.toJSONSchema(schema);
    expect(jsonSchema.properties?.moves).toMatchObject({ items: { required: expect.arrayContaining([
      'eventId', 'rubricRef', 'evidence', 'assessmentStatus',
    ]) } });
    let instructions = '';
    const llm = createLlmService({ defaultModel: 'mock-scorer', recordCall: async () => {}, provider: {
      async complete(request) { instructions = request.instructions; return { text: JSON.stringify(response), model: request.model }; },
    } });
    const result = await llm.run('eval.moves', {}, schema);
    expect(result.meta.promptVersion).toBe('5');
    expect(instructions).toContain('rubric.criteria[].id');
    expect(instructions).toContain('"assessmentStatus":"assessed"');
    expect(instructions).toContain('"assessmentStatus":"insufficient_evidence"');
  });

  it('instructs the provider to address the learner directly throughout the summary', async () => {
    const { snapshot, response } = snapshotFor(strong);
    let instructions = '';
    const llm = createLlmService({ defaultModel: 'mock-scorer', recordCall: async () => {}, provider: {
      async complete(request) { instructions = request.instructions; return { text: JSON.stringify(response), model: request.model }; },
    } });

    await llm.run('eval.moves', {}, evaluationOutputSchema(prepareSubmission(snapshot)));

    expect(instructions).toMatch(/write the entire summary in second person/i);
    expect(instructions).toMatch(/avoid.*the learner/i);
  });
});
