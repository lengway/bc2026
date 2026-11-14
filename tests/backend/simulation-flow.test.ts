import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,expect,it } from 'vitest';
import { createCatalogService } from '@/modules/catalog';
import { readConfig } from '@/modules/config';
import { MockProvider,type EvaluatedMoves } from '@/modules/llm';
import { createCoreRuntime } from '@/modules/runtime';
import { createSimulationService } from '@/modules/simulation';
import { createWorker } from '../../src/worker/runner';
import { createTestDatabase } from './db-helper';
import { createApi } from '../../src/app/api/_lib/handlers';

let state:Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async()=>{state=await createTestDatabase();});
afterAll(async()=>{await state?.cleanup();});

it('runs corrected copilot use through immutable submission, evaluation, certificate and XP',async()=>{
  let instant=Date.now();
  const now=()=>new Date(instant);
  const demo=await createCatalogService().getDemoCase('sales','sdr_outbound');
  const wrong=demo.rubric.traps[0].errorToInject;
  const config=readConfig({APP_URL:'https://skills.example',DATABASE_URL:'unused',LLM_MODEL:'test-model',OPENAI_API_KEY:'unused',SMTP_HOST:'unused',SMTP_FROM:'test@example.com',GUEST_ACCESS_ENABLED:'true'});
  const reply={reply:'We lose track during the morning dispatch handoff.',typingMs:1200,trustDelta:10,patienceDelta:0,revealed:[],outcome:null,innerThought:'The question fits our operational problem.'};
  const grading:{value?:EvaluatedMoves}={};
  const mock=new MockProvider({
    'intake.parse':[JSON.stringify({subfield:'sdr_outbound',years:1,pains:['Discovery'],goals:['Qualify leads']})],
    'case.generate':[JSON.stringify({brief:demo.case.brief,docs:demo.case.docs,personas:demo.personas})],
    'case.rubric':[JSON.stringify(demo.rubric)],
    'persona.reply':[JSON.stringify(reply),JSON.stringify({...reply,reply:'Monthly billing matches our procurement process.'})],
    'copilot.reply':[JSON.stringify({reply:wrong})],
  });
  const app=createCoreRuntime(config,{db:state.db,now,mailer:{async sendMagicLink(){throw new Error('No email expected');}},provider:{async complete(request){
    if(request.promptId==='eval.moves') {
      if(!grading.value) throw new Error('Grading fixture not prepared');
      return {text:JSON.stringify(grading.value),model:request.model};
    }
    return mock.complete(request);
  }}});
  const simulation=createSimulationService({...app,now});
  const auth=await app.identity.createGuestSession('simulation-integration');
  const userId=auth.session!.user.id;
  const initialXp=new Map((await app.progress.getSkillPath(userId)).skills.map(({skill,xp})=>[skill,xp]));
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
  const messages=snapshot.events.filter(event=>event.actor==='user'&&event.type==='message');
  const sourceDoc=snapshot.case.docs.find(doc=>doc.kind==='crm_record')!;
  const correctionEvidence=[
    {source:'user_event' as const,sourceId:messages[1].id,quote:corrected,explanation:'Corrects the proposed term.'},
    {source:'copilot_event' as const,sourceId:advice.event.id,quote:wrong,explanation:'The original incorrect advice.'},
    {source:'case_doc' as const,sourceId:sourceDoc.id,quote:'$1,800 per month',explanation:'The documented monthly term.'},
  ];
  grading.value={
    moves:messages.map((message,index)=>({eventId:message.id,label:index===0?'good':'best',why:index===0?'Asked about the operational problem.':'Verified the commercial term.',betterMove:index===0?'Ask how the delay is measured.':null,
      rubricRef:index===0?'discovery':'critical_ai_use',assessmentStatus:'assessed',evidence:index===0?[{source:'user_event',sourceId:message.id,quote:message.content,explanation:'A concrete workflow question.'}]:correctionEvidence})),
    aiUseChecks:[{id:snapshot.case.rubric.aiUseChecks[0].id,criterionId:'critical_ai_use',status:'passed',earnedPoints:10,maxPoints:10,evidence:correctionEvidence,reason:'Checked the CRM and corrected the billing term.'}],
    trapAssessment:{status:'caught',evidence:correctionEvidence},summary:'The participant asked a relevant discovery question and corrected a billing claim against the CRM.',skills:[],
  };
  const evaluationWorker=createWorker({jobs:app.jobs,handlers:{'case.generate':app.caseEngine.handleGenerateJob,'case.evaluate':app.evaluation.handleEvaluateJob}});
  expect(await evaluationWorker.runOnce()).toBe(true);
  const review=await app.evaluation.getReview(caseId,userId);
  expect(review.evaluation).toMatchObject({accuracy:90,trapResult:'caught',aiUseSkill:{score:100},scoreAudit:{completionStatus:'partial'}});
  expect(review.evaluation.assistance.copilotRetainedPercent).toBeNull();
  const certificateRows=await state.db.query('SELECT slug FROM certificates WHERE case_id=$1',[caseId]);
  expect(certificateRows.rows).toHaveLength(1);
  const certificate=await app.credentials.getBySlug(String(certificateRows.rows[0].slug));
  expect(certificate).toMatchObject({accuracy:90,isDemo:true,holderName:'Demo Guest'});
  expect(JSON.stringify(certificate)).not.toContain('processObservations');
  const api=createApi(app);
  const httpReview=await api.review(new Request('https://skills.example/api/cases/'+caseId+'/review',{headers:{cookie:`skills_session=${auth.token}`}}),{params:Promise.resolve({id:caseId})});
  expect(httpReview.status).toBe(200);
  const httpResult=await httpReview.json();
  expect(httpResult.certificateSlug).toBe(certificateRows.rows[0].slug);
  const publicResult=await api.certificate(new Request('https://skills.example/api/certificates/'+httpResult.certificateSlug),{params:Promise.resolve({slug:httpResult.certificateSlug})});
  expect(publicResult.status).toBe(200);
  expect(await publicResult.json()).toMatchObject({accuracy:90,isDemo:true});
  const path=await app.progress.getSkillPath(userId);
  const newXp=path.skills.filter(({skill,xp})=>xp!==(initialXp.get(skill)??0));
  expect(newXp.map(({skill,xp})=>[skill,xp-(initialXp.get(skill)??0)])).toEqual([['critical_ai_use',90],['discovery',90]]);
  expect(await evaluationWorker.runOnce()).toBe(false);
  expect((await app.progress.getSkillPath(userId)).skills).toEqual(path.skills);
});
