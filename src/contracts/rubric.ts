import { z } from 'zod';
import { NonEmpty, Percent, PositiveInt } from './primitives';
import { ScoringCriterion } from './scoring';

// Internal contract. Public scoring uses the allowlisted fields in PublicScoringGuide.
export const RubricCriterion = ScoringCriterion.extend({ required: z.boolean() });
export type RubricCriterion = z.infer<typeof RubricCriterion>;

export const RubricAiUseCheck = z.object({
  id: NonEmpty,
  criterionId: NonEmpty,
  description: NonEmpty,
  maxPoints: PositiveInt,
  passConditions: z.array(NonEmpty),
  failureConditions: z.array(NonEmpty),
  sourceRefs: z.array(NonEmpty),
});
export type RubricAiUseCheck = z.infer<typeof RubricAiUseCheck>;

export const RubricTwist = z.object({
  id: NonEmpty,
  trigger: z.union([
    z.strictObject({ afterUserTurn: PositiveInt }),
    z.strictObject({ trustBelow: Percent }),
  ]),
  event: z.object({
    kind: z.enum(['email', 'slack', 'persona_message']),
    from: NonEmpty,
    content: NonEmpty,
  }),
});
export type RubricTwist = z.infer<typeof RubricTwist>;

export const Rubric = z.object({
  version: NonEmpty,
  criteria: z.array(RubricCriterion).min(1),
  aiUseChecks: z.array(RubricAiUseCheck),
  keyMoments: z.array(z.object({ id: NonEmpty, description: NonEmpty, idealMove: NonEmpty, why: NonEmpty })).min(4).max(7),
  traps: z.array(z.object({ id: NonEmpty, injectAtCopilotCall: PositiveInt, errorToInject: NonEmpty, howToCatch: NonEmpty })).length(1),
  twists: z.array(RubricTwist).max(2),
  successCriteria: z.array(NonEmpty),
}).superRefine(({ criteria, aiUseChecks }, context) => {
  const criterionIds = new Set(criteria.map((criterion) => criterion.id));
  if (criteria.length !== criterionIds.size) {
    context.addIssue({ code: 'custom', path: ['criteria'], message: 'Criterion IDs must be unique' });
  }
  if (new Set(aiUseChecks.map((check) => check.id)).size !== aiUseChecks.length) {
    context.addIssue({ code: 'custom', path: ['aiUseChecks'], message: 'AI-use check IDs must be unique' });
  }
  for (const [index, check] of aiUseChecks.entries()) {
    if (!criterionIds.has(check.criterionId)) {
      context.addIssue({ code: 'custom', path: ['aiUseChecks', index, 'criterionId'], message: 'AI-use check must reference a criterion' });
    }
  }
});
export type Rubric = z.infer<typeof Rubric>;
