import { describe, expect, it } from 'vitest';
import { createCatalogService, DemoCase } from '../index';

describe('sales catalog', () => {
  it('provides three complete validated demo cases and twelve distinct archetypes', async () => {
    const catalog = createCatalogService();
    const pack = await catalog.getPack('sales');
    expect(pack.archetypes).toHaveLength(12);
    expect(new Set(pack.archetypes.map((item) => item.id)).size).toBe(12);
    expect(await catalog.listFields()).toContain('sales');
    for (const subfield of ['sdr_outbound', 'account_executive', 'account_management']) {
      const demo = await catalog.getDemoCase('sales', subfield);
      expect(DemoCase.safeParse(demo).success).toBe(true);
      expect(demo.case.docs.some((doc) => doc.kind === 'email_thread')).toBe(true);
      expect(demo.case.docs.some((doc) => doc.kind === 'crm_record')).toBe(true);
      expect(demo.personas.length).toBeGreaterThan(0);
    }
  });

  it('prefers a matching subfield and avoids previously used archetypes', async () => {
    const catalog = createCatalogService();
    const first = await catalog.pickArchetype({ field: 'sales', subfield: 'sdr_outbound' }, []);
    const next = await catalog.pickArchetype({ field: 'sales', subfield: 'sdr_outbound' }, [first.id]);
    expect(next.subfield).toBe('sdr_outbound');
    expect(next.id).not.toBe(first.id);
  });

  it('tags every archetype with at least one focus area', async () => {
    const pack = await createCatalogService().getPack('sales');
    for (const archetype of pack.archetypes) expect(archetype.focus.length, archetype.id).toBeGreaterThan(0);
  });

  it('picks the case that trains what the person asked to practice', async () => {
    const catalog = createCatalogService();
    const intakeText = 'Role: Account executive.\nWants to practice: Price and discount pressure, Negotiation.';
    const picked = await catalog.pickArchetype({ field: 'sales', subfield: 'account_executive', level: 'intermediate', intakeText }, []);
    expect(picked.id).toBe('price-objection');
  });

  it('matches difficulty to the level when focus does not decide', async () => {
    const catalog = createCatalogService();
    const beginner = await catalog.pickArchetype({ field: 'sales', subfield: 'sdr_outbound', level: 'beginner', intakeText: '' }, []);
    const advanced = await catalog.pickArchetype({ field: 'sales', subfield: 'sdr_outbound', level: 'advanced', intakeText: '' }, []);
    expect(beginner.difficulty).toBe('beginner');
    expect(advanced.difficulty).toBe('advanced');
  });

  it('crosses into another role only for a strong focus match', async () => {
    const catalog = createCatalogService();
    const intakeText = 'Wants to practice: Renewals and churn risk, Upset or angry clients.';
    const picked = await catalog.pickArchetype({ field: 'sales', subfield: 'sdr_outbound', level: 'intermediate', intakeText }, []);
    expect(picked.id).toBe('renewal-risk');
  });

  it('falls back to used archetypes only when every option has been used', async () => {
    const catalog = createCatalogService();
    const pack = await catalog.getPack('sales');
    const picked = await catalog.pickArchetype({ field: 'sales', subfield: 'sdr_outbound' }, pack.archetypes.map((a) => a.id));
    expect(pack.archetypes.map((a) => a.id)).toContain(picked.id);
  });
});

it('targets the requested skill across the pack and diversifies the latest series', async () => {
  const catalog = createCatalogService();
  const profile = { field: 'sales', subfield: 'sdr_outbound', level: 'advanced', intakeText: 'Wants to practice: discovery' } as const;
  const pack = await catalog.getPack('sales');
  const previous = pack.archetypes.map(({ id }) => id);
  const picked = await catalog.pickArchetype(profile, previous, {
    skill: 'critical_ai_use',
    seriesArchetypeIds: ['competitor', 'competitor'],
  });
  expect(['price-objection', 'procurement']).toContain(picked.id);
});

it('prefers an archetype outside the counted series when its prior case is missing from history', async () => {
  const catalog = createCatalogService();
  const picked = await catalog.pickArchetype({ field: 'sales', subfield: 'account_executive' },
    ['price-objection', 'procurement'], { skill: 'critical_ai_use', seriesArchetypeIds: ['competitor'] });
  expect(['price-objection', 'procurement']).toContain(picked.id);
});
