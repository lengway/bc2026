import { afterAll, beforeAll, expect, it } from 'vitest';
import { z } from 'zod';
import { createLlmService, MockProvider } from '@/modules/llm';
import { createLlmCallRecorder } from '@/modules/runtime';
import { createTestDatabase } from './db-helper';

let testDb: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async()=>{testDb=await createTestDatabase();});
afterAll(async()=>{await testDb?.cleanup();});
it('persists validation attempts and redacts secret fields in the private call journal',async()=>{
  const llm=createLlmService({defaultModel:'test-model',provider:new MockProvider({'intake.parse':['broken','{"answer":1}','{"answer":"ok"}']}),recordCall:createLlmCallRecorder(testDb.db)});
  const result=await llm.run('intake.parse',{text:'Sales',apiKey:'private-value'},z.object({answer:z.string()}));
  expect(result.data).toEqual({answer:'ok'});
  const rows=await testDb.db.query('SELECT ok,input,error_code,model,prompt_version FROM llm_calls ORDER BY created_at,id');
  expect(rows.rows).toHaveLength(3);
  expect(rows.rows.filter(row=>row.ok)).toHaveLength(1);
  expect(JSON.stringify(rows.rows)).not.toContain('private-value');
  expect(rows.rows.every(row=>row.model==='test-model'&&row.prompt_version==='1')).toBe(true);
});
