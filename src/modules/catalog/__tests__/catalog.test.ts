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
});
