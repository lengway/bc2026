import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,expect,it } from 'vitest';
import { createCatalogService } from '@/modules/catalog';
import { readConfig } from '@/modules/config';
import { MockProvider } from '@/modules/llm';
import { createCoreRuntime } from '@/modules/runtime';
import { createSimulationService } from '@/modules/simulation';
import { createWorker } from '../../src/worker/runner';
import { createTestDatabase } from './db-helper';

let state:Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async()=>{state=await createTestDatabase();});
afterAll(async()=>{await state?.cleanup();});

it('preserves moves, corrected copilot edits and an immutable submission through the composed services',async()=>{
  let instant=Date.now();
  const now=()=>new Date(instant);
  const demo=await createCatalogService().getDemoCase('sales','sdr_outbound');
  const wrong=demo.rubric.traps[0].errorToInject;
  const config=readConfig({APP_URL:'https://skills.example',DATABASE_URL:'unused',LLM_MODEL:'test-model',OPENAI_API_KEY:'unused',SMTP_HOST:'unused',SMTP_FROM:'test@example.com',GUEST_ACCESS_ENABLED:'true'});
  const reply={reply:'We lose track during the morning dispatch handoff.',typingMs:1200,trustDelta:10,patienceDelta:0,revealed:[],outcome:null,innerThought:'The question fits our operational problem.'};
  const app=createCoreRuntime(config,{db:state.db,now,mailer:{async sendMagicLink(){throw new Error('No email expected');}},provider:new MockProvider({
    'intake.parse':[JSON.stringify({subfield:'sdr_outbound',years:1,pains:['Discovery'],goals:['Qualify leads']})],
    'case.generate':[JSON.stringify({brief:demo.case.brief,docs:demo.case.docs,personas:demo.personas})],
    'case.rubric':[JSON.stringify(demo.rubric)],
    'persona.reply':[JSON.stringify(reply),JSON.stringify({...reply,reply:'Monthly billing matches our procurement process.'})],
    'copilot.reply':[JSON.stringify({reply:wrong})],
  })});
  const simulation=createSimulationService({...app,now});
  const auth=await app.identity.createGuestSession('simulation-integration');
  const userId=auth.session!.user.id;
  await app.identity.upsertProfileFromIntake(userId,{field:'sales',level:'beginner',text:'I am a new SDR.'});
  const {caseId}=await app.caseEngine.generateCase(userId,'onboarding');
  await createWorker({jobs:app.jobs,handlers:{'case.generate':app.caseEngine.handleGenerateJob,'case.evaluate':async()=>{throw new Error('Evaluation belongs to T4');}}}).runOnce();
  const record=await app.caseEngine.getCaseRecord(caseId,{userId});
  const personaId=record!.personas[0].public.id;
  await simulation.startCase(caseId,userId);
  instant+=1000;
  const move={clientMsgId:randomUUID(),personaId,text:'Which dispatch handoff is hardest to track?',draftId:null};
  const first=await simulation.handleMove(caseId,userId,move);
  expect(await simulation.handleMove(caseId,userId,move)).toEqual(first);
  expect(JSON.stringify(first)).not.toContain('innerThought');
  const advice=await simulation.askCopilot(caseId,userId,{clientMsgId:randomUUID(),text:'Which billing term should I propose?'});
  expect(advice.event.content).toBe(wrong);
  expect(JSON.stringify(advice)).not.toContain('trapId');
  instant+=1000;
  const draftId=randomUUID();
  const corrected='The CRM states $1,800 per month, not per quarter. Would monthly billing fit your process?';
  const edit={draftId,inputMode:'keyboard' as const,clientAt:now().toISOString(),inputType:'insertText',isComposing:false,isTrusted:true};
  const batch={draftId,batchId:randomUUID(),events:[
    {...edit,id:randomUUID(),seq:1,kind:'copilot_insert' as const,rangeStart:0,rangeEnd:0,insertedText:wrong,sourceEventId:advice.event.id,isTrusted:false},
    {...edit,id:randomUUID(),seq:2,kind:'insert' as const,rangeStart:0,rangeEnd:wrong.length,insertedText:corrected,sourceEventId:null},
  ]};
  await app.events.appendEditorBatch(caseId,userId,batch);
  await simulation.handleMove(caseId,userId,{clientMsgId:randomUUID(),personaId,text:corrected,draftId});
  expect(await simulation.submitCase(caseId,userId)).toEqual({status:'evaluating'});
  expect(await simulation.submitCase(caseId,userId)).toEqual({status:'evaluating'});
  const snapshot=await simulation.loadSubmission(caseId);
  if (!snapshot) throw new Error('Missing submitted snapshot');
  expect(snapshot).toMatchObject({version:1,case:{id:caseId,isGuest:true,isDemo:true}});
  expect(snapshot.drafts).toEqual(expect.arrayContaining([expect.objectContaining({draftId,messageEventId:expect.any(String)})]));
  await expect(app.events.appendEditorBatch(caseId,userId,{...batch,batchId:randomUUID()})).rejects.toMatchObject({status:409});
  expect(await simulation.loadSubmission(caseId)).toEqual(snapshot);
  const queued=await state.db.query("SELECT id FROM jobs WHERE case_id=$1 AND kind='case.evaluate'",[caseId]);
  expect(queued.rows).toHaveLength(1);
  const view=await app.caseEngine.getCaseForUser(caseId,userId);
  expect(view.status).toBe('evaluating');
  expect(JSON.stringify(view)).not.toContain('innerThought');
});
