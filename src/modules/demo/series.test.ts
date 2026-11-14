import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createCatalogService } from '@/modules/catalog';
import { prepareDemoSeries } from './series';

describe('synthetic demo skill series', () => {
  it('uses four catalog scenarios and produces an evidenced review for each', async () => {
    const catalog = createCatalogService();
    const at = new Date('2026-11-14T12:00:00Z');
    const first = await prepareDemoSeries(catalog, randomUUID(), at);
    const second = await prepareDemoSeries(catalog, randomUUID(), at);

    expect(first.map(({ archetypeId }) => archetypeId)).toEqual([
      'price-objection', 'procurement', 'committee', 'demo-no-show',
    ]);
    for (const [index, { snapshot, review }] of first.entries()) {
      const other = second[index].snapshot;
      expect(snapshot.case).toMatchObject({ isDemo: true, isGuest: true });
      expect(snapshot.case.brief.title).toMatch(/^Demo example/);
      expect(snapshot.case.id).not.toBe(other.case.id);
      expect(snapshot.case.personas[0].public.id).not.toBe(other.case.personas[0].public.id);
      const otherIds = other.events.map(({ id }) => id);
      expect(snapshot.events.some(({ id }) => otherIds.includes(id))).toBe(false);
      expect(review.evaluation.outcome).toBe('won');
      expect(review.evaluation.accuracy).toBeGreaterThanOrEqual(75);
      expect(review.evaluation.scoreAudit.completionStatus).toBe('complete');
      expect(review.evaluation.trapResult).toBe('caught');
      expect(review.evaluation.topMoves).toHaveLength(3);
      expect(review.moves.some((move) => move.evidence.some((item) => item.source === 'case_doc'))).toBe(true);
    }
  });
});

vi.mock('@/modules/identity', () => ({}));
