import { describe, expect, it } from 'vitest';
import { GeneratedCase } from '@/modules/llm';
import { Rubric } from '@/contracts/rubric';
import { pressureScenario, resolvePressureOutcome } from './pressure-case';

describe('curated Pressure case', () => {
  it('keeps the conversation open long enough to react to the CFO email', () => {
    expect(resolvePressureOutcome(pressureScenario.seed, 1, 'won')).toBeNull();
    expect(resolvePressureOutcome(pressureScenario.seed, 2, 'lost')).toBeNull();
    expect(resolvePressureOutcome(pressureScenario.seed, 3, 'won')).toBe('won');
    expect(resolvePressureOutcome('another-case', 1, 'won')).toBe('won');
  });
  it('matches case contracts and gates the finance correction until the second exchange', () => {
    expect(GeneratedCase.safeParse(pressureScenario.generated).success).toBe(true);
    expect(Rubric.safeParse(pressureScenario.rubric).success).toBe(true);
    const twist = pressureScenario.rubric.twists[0];
    expect(twist.trigger).toEqual({ afterUserTurn: 2 });
    expect(twist.documentIds).toEqual(['cfo-update']);
    expect(pressureScenario.generated.docs.find(({ id }) => id === 'cfo-update')?.arrivesAtTurn).toBe(3);
  });
});
