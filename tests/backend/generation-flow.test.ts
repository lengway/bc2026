import { afterAll,beforeAll,expect,it } from 'vitest';
import { createCatalogService } from '@/modules/catalog';
import { readConfig } from '@/modules/config';
import { MockProvider } from '@/modules/llm';
import { createCoreRuntime } from '@/modules/runtime';
import { createWorker } from '../../src/worker/runner';
import { createTestDatabase } from './db-helper';

let state:Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async()=>{state=await createTestDatabase();});
afterAll(async()=>{await state?.cleanup();});
it('runs guest entry, intake, queued generation and a safe ready response through the composed backend',async()=>{
  const demo=await createCatalogService().getDemoCase('sales','sdr_outbound');
  const config=readConfig({APP_URL:'https://skills.example',DATABASE_URL:'unused',LLM_MODEL:'test-model',OPENAI_API_KEY:'unused',SMTP_HOST:'unused',SMTP_FROM:'test@example.com',GUEST_ACCESS_ENABLED:'true'});
  const app=createCoreRuntime(config,{db:state.db,mailer:{async sendMagicLink(){throw new Error('No email expected');}},provider:new MockProvider({
    'intake.parse':[JSON.stringify({subfield:'sdr_outbound',years:1,pains:['Discovery'],goals:['Qualify leads']})],
    'case.generate':[JSON.stringify({brief:demo.case.brief,docs:demo.case.docs,personas:demo.personas})],
    'case.rubric':[JSON.stringify(demo.rubric)],
  })});
  const auth=await app.identity.createGuestSession('integration');
  const userId=auth.session!.user.id;
  await app.identity.upsertProfileFromIntake(userId,{field:'sales',level:'beginner',text:'I am a new SDR.'});
  const created=await app.caseEngine.generateCase(userId,'onboarding');
  expect(await app.caseEngine.getCaseForUser(created.caseId,userId)).toEqual({id:created.caseId,status:'generating'});
  const worker=createWorker({jobs:app.jobs,handlers:{'case.generate':app.caseEngine.handleGenerateJob,'case.evaluate':async()=>{throw new Error('Unexpected evaluation');}}});
  expect(await worker.runOnce()).toBe(true);
  const ready=await app.caseEngine.getCaseForUser(created.caseId,userId);
  expect(ready).toMatchObject({status:'ready',startedAt:null,brief:{timeLimitSec:480}});
  expect(JSON.stringify(ready)).not.toContain('realMotive');
  expect(JSON.stringify(ready)).not.toContain(demo.rubric.traps[0].errorToInject);
  const calls=await state.db.query('SELECT ok FROM llm_calls');
  expect(calls.rows).toHaveLength(3);
  expect(calls.rows.every(call=>call.ok===true)).toBe(true);
});
