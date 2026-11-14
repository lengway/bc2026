import { describe, expect, it } from 'vitest';
import { assessSeries, type SeriesCase } from './index';

const make = (caseId: string, overrides: Partial<SeriesCase> = {}): SeriesCase => ({
  caseId,
  title: 'Recorded case',
  completedAt: '2026-11-14T12:00:00.000Z',
  archetypeId: 'cold-discovery',
  accuracy: 88,
  outcome: 'won',
  difficulty: 'beginner',
  isDemo: false,
  isSeededDemo: false,
  ...overrides,
});
const beginner = make('001');
const intermediate = make('002', { archetypeId: 'vendor', difficulty: 'intermediate' });
const advanced = make('003', { archetypeId: 'committee', difficulty: 'advanced' });

describe('skill series qualification', () => {
  it('requires three scored cases with varied archetypes', () => {
    expect(assessSeries([beginner, intermediate]).blockers).toContain('insufficient_cases');
    expect(assessSeries([beginner, beginner, beginner]).blockers).toContain('insufficient_archetypes');
    expect(assessSeries([beginner, intermediate, advanced])).toMatchObject({ level: 3, averageAccuracy: 88 });
  });

  it('uses the latest three scored cases and refuses a left case', () => {
    expect(assessSeries([make('004', { accuracy: 31 }), beginner, intermediate, advanced]))
      .toMatchObject({ level: null, averageAccuracy: 69 });
    expect(assessSeries([make('004', { outcome: 'left' }), beginner, intermediate, advanced]).blockers)
      .toContain('left_case');
  });

  it('requires at least one case of the appropriate difficulty for each higher level', () => {
    const differentBeginner = make('004', { archetypeId: 'demo-no-show' });
    expect(assessSeries([beginner, differentBeginner, beginner]).level).toBe(1);
    expect(assessSeries([beginner, intermediate, beginner]).level).toBe(2);
    expect(assessSeries([beginner, intermediate, { ...advanced, accuracy: 87 }]).level).toBe(2);
  });
});
