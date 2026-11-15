import { describe, expect, it } from 'vitest';
import { GenerateCaseRequest } from '@/contracts';

const prep = {
  offering: ' Fleet maintenance software ',
  buyer: 'Operations director at a regional delivery fleet',
  objection: 'Rolling out another tool will take vans off the road',
};

describe('sales call preparation request', () => {
  it('accepts and trims the three private practice details', () => {
    expect(GenerateCaseRequest.parse({ type: 'prep', prep })).toEqual({
      type: 'prep', prep: { ...prep, offering: prep.offering.trim() },
    });
  });

  it('rejects missing, oversized, blank, unknown, or misplaced details', () => {
    for (const input of [
      { type: 'prep' },
      { type: 'prep', prep: { ...prep, objection: ' ' } },
      { type: 'prep', prep: { ...prep, buyer: 'x'.repeat(1_000) } },
      { type: 'prep', prep: { ...prep, secret: 'extra' } },
      { type: 'prep', prep, skill: 'closing' },
      { type: 'daily', prep },
    ]) expect(GenerateCaseRequest.safeParse(input).success).toBe(false);
  });
});
