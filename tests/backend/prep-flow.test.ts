import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createCatalogService } from '@/modules/catalog';
import { readConfig } from '@/modules/config';
import { createCoreRuntime } from '@/modules/runtime';
import { readSkillSeries } from '@/modules/skill-series';
import { createWorker } from '../../src/worker/runner';
import { createTestDatabase } from './db-helper';

let state: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { state = await createTestDatabase(); });
afterAll(async () => { await state?.cleanup(); });

it('uses the free daily slot for tailored practice and keeps the completed review private', async () => {
  const owner = randomUUID();
  await state.db.query('INSERT INTO users(id,email,email_verified_at) VALUES($1,$2,now())', [owner, owner+'@example.test']);
  await state.db.query(`INSERT INTO profiles(user_id,intake_text,field,subfield,level)
    VALUES ($1,'Original profile text','sales','sdr_outbound','beginner')`, [owner]);
  const demo = await createCatalogService().getDemoCase('sales','sdr_outbound');
  const prep = {
    offering: 'Fleet maintenance software',
    buyer: 'Operations director at a regional delivery fleet',
    objection: 'Rolling out another tool will take vans off the road',
  };
  const modelInput: Array<Record<string,unknown>> = [];
  const config = readConfig({
    APP_URL:'https://skills.example', DATABASE_URL:'unused', LLM_MODEL:'test-model', OPENAI_API_KEY:'unused',
    SMTP_HOST:'unused', SMTP_FROM:'test@example.com',
  });
  const app = createCoreRuntime(config,{
    db:state.db, mailer:{async sendMagicLink(){throw new Error('No email expected');}},
    provider:{async complete(request){
      modelInput.push(JSON.parse(request.prompt.slice(request.prompt.indexOf('\n') + 1)));
      const response = request.promptId === 'case.generate'
        ? { brief: {...demo.case.brief, title:'Keeping the fleet moving'}, docs:demo.case.docs, personas:demo.personas }
        : demo.rubric;
      return { model:'test-model',text:JSON.stringify(response) };
    }},
  });
  const { caseId } = await app.caseEngine.generateCase(owner,'prep',{prep});
  expect(await app.caseEngine.getRecoverablePrep(owner)).toEqual({ id: caseId, status: 'generating' });
  expect(await app.caseEngine.getRecoverablePrep(randomUUID())).toBeNull();
  const worker = createWorker({jobs:app.jobs,handlers:{
    'case.generate':app.caseEngine.handleGenerateJob,
    'case.evaluate':app.evaluation.handleEvaluateJob,
  }});
  expect(await app.caseEngine.getCaseForUser(caseId,owner)).toEqual({id:caseId,status:'generating',type:'prep'});
  await expect(app.caseEngine.generateCase(owner,'daily')).rejects.toMatchObject({code:'PAYWALL'});
  expect(await app.billing.summary(owner)).toMatchObject({freeDailyRemaining:0});
  expect(await worker.runOnce()).toBe(true);
  expect(modelInput[0]).toMatchObject({type:'prep',prep,profile:{intakeText:''}});
  expect(modelInput[1]).not.toHaveProperty('prep');
  expect(await app.caseEngine.getCaseForUser(caseId,owner)).toMatchObject({
    type:'prep',status:'ready',brief:{title:'Keeping the fleet moving',timeLimitSec:600},
  });
  expect(await app.caseEngine.getRecoverablePrep(owner)).toEqual({ id: caseId, status: 'ready' });
  expect((await state.db.query('SELECT payload FROM jobs WHERE case_id=$1',[caseId])).rows[0].payload).not.toHaveProperty('prep');
  expect((await state.db.query('SELECT input,output FROM llm_calls WHERE case_id=$1',[caseId])).rows)
    .toEqual([{input:null,output:null},{input:null,output:null}]);
  expect((await state.db.query('SELECT intake_text FROM profiles WHERE user_id=$1',[owner])).rows[0].intake_text)
    .toBe('Original profile text');

  await app.simulation.startCase(caseId,owner);
  await app.simulation.submitCase(caseId,owner);
  expect(await worker.runOnce()).toBe(true);
  await expect(app.credentials.getOwnedLink(caseId,owner)).resolves.toEqual({disabled:true});
  expect((await state.db.query('SELECT slug FROM certificates WHERE case_id=$1',[caseId])).rowCount).toBe(0);
  // A scored practice review still must not qualify for a skill certificate.
  await state.db.query('UPDATE evaluations SET accuracy=100 WHERE case_id=$1',[caseId]);
  expect((await readSkillSeries(state.db,app.catalog,owner,new Date())).flatMap(({counted})=>counted)).toEqual([]);
});
