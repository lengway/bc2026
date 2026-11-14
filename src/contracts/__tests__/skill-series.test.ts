import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CASES_REQUIRED, FOCUS_AREA_IDS, SKILL_IDS, SkillCertificateLimited, skillsForFocus, type FocusArea } from '@/contracts';

const pack = new URL('../../field-packs/sales/', import.meta.url);

describe('skill series contracts', () => {
  it('maps every focus area and supports different situations for every Sales skill', () => {
    const manifest = JSON.parse(readFileSync(new URL('pack.json', pack), 'utf8'));
    expect(SKILL_IDS).toEqual(manifest.dimensions);
    expect(FOCUS_AREA_IDS.every((focus) => skillsForFocus([focus]).length > 0)).toBe(true);
    const archetypes = readdirSync(new URL('archetypes/', pack)).map((file) => (
      JSON.parse(readFileSync(new URL(`archetypes/${file}`, pack), 'utf8')) as { id: string; focus: FocusArea[] }
    ));
    for (const skill of SKILL_IDS) {
      const ids = new Set(archetypes.filter(({ focus }) => skillsForFocus(focus).includes(skill)).map(({ id }) => id));
      expect(ids.size, skill).toBeGreaterThanOrEqual(CASES_REQUIRED);
    }
  });

  it('requires three cases on a skill certificate', () => {
    const completedAt = '2026-11-14T12:00:00.000Z';
    const cases = Array.from({ length: 3 }, (_, index) => ({
      caseId: `00000000-0000-4000-8000-00000000000${index}`, title: `Case ${index}`, archetypeId: `archetype-${index}`,
      accuracy: 80, outcome: 'won', completedAt,
    }));
    const certificate = {
      slug: 'testSlug01', holderName: 'Demo Learner', skill: 'discovery', field: 'sales', level: 2, issuedAt: completedAt,
      cases, averageAccuracy: 80, aiDependencyAverage: null, verified: true, verificationScope: 'recorded_simulation',
      trapResults: cases.map(({ caseId }) => ({ caseId, trapResult: 'not_presented' })), supersededBy: null,
    };
    expect(SkillCertificateLimited.safeParse(certificate).success).toBe(true);
    expect(SkillCertificateLimited.safeParse({ ...certificate, cases: cases.slice(0, 2) }).success).toBe(false);
  });
});
