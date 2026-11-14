import path from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const lint = new ESLint();

async function errors(source: string, file: string) {
  const [result] = await lint.lintText(source, { filePath: path.resolve(file) });
  return result.messages.filter((message) => message.severity === 2);
}

describe('module boundaries', () => {
  it('rejects a relative import that bypasses another module public API', async () => {
    const result = await errors(
      "export { evaluateCase } from '../evaluation/service';",
      'src/modules/simulation/service.ts',
    );
    expect(result.some((error) => error.ruleId === 'architecture/module-boundary')).toBe(true);
  });

  it('allows local implementation imports inside the same module', async () => {
    expect(await errors("export { load } from './repo';", 'src/modules/simulation/service.ts')).toEqual([]);
  });

  it('allows another module public index', async () => {
    expect(await errors("export { run } from '@/modules/llm';", 'src/modules/simulation/service.ts')).toEqual([]);
  });

  it('rejects provider SDK imports outside the LLM module', async () => {
    const result = await errors("export { default } from 'openai';", 'src/modules/simulation/service.ts');
    expect(result.some((error) => error.ruleId === 'no-restricted-imports')).toBe(true);
  });
});
