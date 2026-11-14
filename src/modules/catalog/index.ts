import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { CaseBrief, CaseDoc, CaseType, Field, PersonaPublic, WorkspaceType } from '@/contracts';
import { PersonaHidden } from '@/contracts/case';
import { Rubric } from '@/contracts/rubric';
import { NonEmpty } from '@/contracts/primitives';

export const Archetype = z.object({ id: NonEmpty, subfield: NonEmpty, title: NonEmpty, setup: NonEmpty, difficulty: z.enum(['beginner', 'intermediate', 'advanced']), suggestedTwists: z.array(NonEmpty) });
export type Archetype = z.infer<typeof Archetype>;
const PersonaTemplate = z.object({ id: NonEmpty, role: NonEmpty, personality: NonEmpty, style: NonEmpty });
const PackManifest = z.object({ field: Field, title: NonEmpty, subfields: z.array(NonEmpty).min(1), workspace: WorkspaceType, dimensions: z.array(NonEmpty).min(1), showTrustLive: z.boolean() });
export const DemoCase = z.object({ case: z.object({ type: CaseType, field: Field, subfield: NonEmpty, workspace: WorkspaceType, brief: CaseBrief, docs: z.array(CaseDoc).min(2).max(4) }), personas: z.array(z.object({ public: PersonaPublic, hidden: PersonaHidden })).min(1).max(2), rubric: Rubric });
export type DemoCase = z.infer<typeof DemoCase>;
export type Pack = z.infer<typeof PackManifest> & { archetypes: Archetype[]; personas: z.infer<typeof PersonaTemplate>[]; labels: Record<string, string> };

export function createCatalogService({ packsDir = join(process.cwd(), 'src', 'field-packs') }: { packsDir?: string } = {}) {
  const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'));
  const readDirectory = async <T>(path: string, schema: z.ZodType<T>): Promise<T[]> => {
    const names = (await readdir(path)).filter((name) => name.endsWith('.json')).sort();
    return Promise.all(names.map(async (name) => schema.parse(await readJson(join(path, name)))));
  };
  const getPack = async (field: Field): Promise<Pack> => {
    const validField = Field.parse(field);
    const dir = join(packsDir, validField);
    const [manifest, archetypes, personas, labels] = await Promise.all([
      readJson(join(dir, 'pack.json')).then((value) => PackManifest.parse(value)),
      readDirectory(join(dir, 'archetypes'), Archetype),
      readDirectory(join(dir, 'personas'), PersonaTemplate),
      readJson(join(dir, 'labels.json')).then((value) => z.record(NonEmpty, NonEmpty).parse(value)),
    ]);
    if (manifest.field !== validField || archetypes.some((item) => !manifest.subfields.includes(item.subfield)) || new Set(archetypes.map((item) => item.id)).size !== archetypes.length) throw new Error('Invalid field pack');
    return { ...manifest, archetypes, personas, labels };
  };
  return {
    getPack,
    async listFields(): Promise<Field[]> {
      const entries = await readdir(packsDir, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory() && Field.safeParse(entry.name).success).map((entry) => Field.parse(entry.name)).sort();
    },
    async pickArchetype(profile: { field: Field; subfield: string }, history: readonly (string | { archetypeId: string })[]): Promise<Archetype> {
      const pack = await getPack(profile.field);
      const eligible = pack.archetypes.filter((item) => item.subfield === profile.subfield);
      const options = eligible.length ? eligible : pack.archetypes;
      if (!options.length) throw new Error('No archetypes available');
      const used = new Set(history.map((item) => typeof item === 'string' ? item : item.archetypeId));
      return options.find((item) => !used.has(item.id)) ?? options[0];
    },
    async getDemoCase(field: Field, subfield: string): Promise<DemoCase> {
      const pack = await getPack(field);
      if (!pack.subfields.includes(subfield)) throw new Error('Unknown subfield');
      const demo = DemoCase.parse(await readJson(join(packsDir, field, 'demo', `${subfield}.json`)));
      if (demo.case.field !== field || demo.case.subfield !== subfield) throw new Error('Demo does not match requested field and subfield');
      return demo;
    },
  };
}
export type CatalogService = ReturnType<typeof createCatalogService>;
