import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { mkdir,open,readFile,writeFile,unlink } from 'node:fs/promises';
import { readConfig } from '../src/modules/config';
import { OpenAIProvider,type LlmProvider } from '../src/modules/llm';
import { createCoreRuntime } from '../src/modules/runtime';
import { createWorker } from '../src/worker/runner';
import { createTestDatabase } from '../tests/backend/db-helper';

// Deliberate opt-in, separate disposable DB, no SMTP or Stripe network operations.
// Reserves a conservative upper estimate BEFORE each paid call; failed calls are not refunded.
const ledgerPath='.tmp/llm-live-spend.json',lockPath='.tmp/llm-live.lock';
type Ledger={reservedUsd:number;reportedUsageUsd:number;calls:number};
const rates:Record<string,{input:number;output:number}>={'gpt-6.1-sol':{input:2,output:10},'gpt-6.1-terra':{input:1,output:5}};
let stage='configuration';

async function main() {
  if(process.env.LLM_LIVE!=='1') throw new Error('Set LLM_LIVE=1 explicitly to enable paid smoke tests.');
  if(!process.env.OPENAI_API_KEY?.trim()) throw new Error('OPENAI_API_KEY is missing.');
  await mkdir('.tmp',{recursive:true});
  const lock=await open(lockPath,'wx'); // One paid smoke runner at a time.
  let state:Awaited<ReturnType<typeof createTestDatabase>>|undefined;
  let ledger:Ledger={reservedUsd:0,reportedUsageUsd:0,calls:0};
  let runReserve=0,runReported=0;
  try {
    ledger=await readFile(ledgerPath,'utf8').then(JSON.parse).catch((error:unknown)=>{
      if(error instanceof Error&&'code' in error&&error.code==='ENOENT') return ledger;
      throw error;
    });
    if(!Number.isFinite(ledger.reservedUsd)||!Number.isFinite(ledger.reportedUsageUsd)||!Number.isInteger(ledger.calls)) throw new Error('Invalid spend ledger.');
    const delegate=new OpenAIProvider({apiKey:process.env.OPENAI_API_KEY});
    const provider:LlmProvider={async complete(request){
      const rate=rates[request.model];
      if(!rate) throw new Error('Live smoke only permits the two reviewed model IDs.');
      // UTF-8 bytes upper-bound text tokens; 4096 extra covers message framing.
      const inputBound=Buffer.byteLength(request.instructions+request.prompt+(request.validationError??''),'utf8')+4096;
      const reserve=(inputBound*rate.input+8192*rate.output)/1_000_000;
      if(ledger.reservedUsd+reserve>40||runReserve+reserve>2) throw new Error('Paid smoke budget reached.');
      runReserve+=reserve;ledger.reservedUsd+=reserve;ledger.calls++;
      await writeFile(ledgerPath,JSON.stringify(ledger,null,2));
      console.info('LLM_CALL',request.promptId,request.model);
      let response:Awaited<ReturnType<LlmProvider['complete']>>;
      try {response=await delegate.complete(request);}
      catch(error) {
        const status=typeof error==='object'&&error!==null&&'status' in error&&typeof error.status==='number'?error.status:null;
        const rawCode=typeof error==='object'&&error!==null&&'code' in error?error.code:null;
        const code=typeof rawCode==='string'&&/^[a-z_]{1,64}$/.test(rawCode)?rawCode:null;
        console.error('OPENAI_CALL_FAILED',JSON.stringify({promptId:request.promptId,status,code}));throw error;
      }
      const reported=((response.tokensIn??0)*rate.input+(response.tokensOut??0)*rate.output)/1_000_000;
      runReported+=reported;ledger.reportedUsageUsd+=reported;
      await writeFile(ledgerPath,JSON.stringify(ledger,null,2));
      console.info('LLM_USAGE',JSON.stringify({promptId:request.promptId,tokensIn:response.tokensIn,tokensOut:response.tokensOut,estimatedUsd:reported}));
      return response;
    }};
    stage='test-database';
    state=await createTestDatabase();
    stage='runtime';
    const config=readConfig({...process.env,NODE_ENV:'test',DATABASE_URL:'injected-test-database',APP_URL:'https://skills.example',
      GUEST_ACCESS_ENABLED:'true',DEMO_MODE:'false',SMTP_HOST:'unused',SMTP_FROM:'test@example.com'});
    const app=createCoreRuntime(config,{db:state.db,provider,mailer:{async sendMagicLink(){throw new Error('Live smoke must not send email.');}}});
    const guest=await app.identity.createGuestSession('bounded-live-smoke');
    const owner=guest.session!.user.id;
    stage='intake';
    await app.identity.upsertProfileFromIntake(owner,{field:'sales',level:'beginner',text:'I work as a new SDR at a B2B software vendor. I need to ask better discovery questions and verify claims before contacting leads.'});
    const {caseId}=await app.caseEngine.generateCase(owner,'onboarding');
    const worker=createWorker({jobs:app.jobs,handlers:{'case.generate':app.caseEngine.handleGenerateJob,'case.evaluate':app.evaluation.handleEvaluateJob}});
    stage='generation';
    await worker.runOnce();
    const record=await app.caseEngine.getCaseRecord(caseId,{userId:owner});
    if(!record||record.status!=='ready'||record.isDemo) throw new Error('Live generation did not produce a validated original case.');
    stage='simulation';
    await app.simulation.startCase(caseId,owner);
    const personaId=record.personas[0].public.id;
    await app.simulation.handleMove(caseId,owner,{clientMsgId:randomUUID(),personaId,draftId:null,text:'Before discussing a solution, what is the most costly problem in your current workflow, and how do you measure its impact?'});
    await app.simulation.askCopilot(caseId,owner,{clientMsgId:randomUUID(),text:'Suggest one concise follow-up question. Identify which commercial claims I should verify against the case documents.'});
    const view=await app.caseEngine.getCaseForUser(caseId,owner);
    if(view.status==='in_progress') {
      await app.simulation.handleMove(caseId,owner,{clientMsgId:randomUUID(),personaId,draftId:null,text:'Who else needs to approve a change, and what evidence would they need? I will verify pricing and contract terms against the CRM before promising them. Would a brief discovery session next week be useful?'});
    }
    stage='evaluation';
    await app.simulation.submitCase(caseId,owner);
    await worker.runOnce();
    const review=await app.evaluation.getReview(caseId,owner);
    const certificates=await state.db.query('SELECT slug FROM certificates WHERE case_id=$1',[caseId]);
    if(certificates.rows.length!==1) throw new Error('Live flow did not publish exactly one certificate.');
    const certificate=await app.credentials.getBySlug(String(certificates.rows[0].slug));
    const result={completed:true,caseId,models:{generation:config.LLM_MODEL,dialogue:config.LLM_MODEL_DIALOGUE,evaluation:config.LLM_MODEL_EVALUATION},
      accuracy:review.evaluation.accuracy,coverage:review.evaluation.scoreAudit.completionStatus,trapResult:review.evaluation.trapResult,
      certificateDemo:certificate.isDemo,runEstimatedUsd:runReported,runReservedUsd:runReserve,total:ledger,
      review,publicEvents:await app.events.listPublicByCase(caseId,0),documents:record.docs};
    await writeFile('.tmp/live-smoke-result.json',JSON.stringify(result,null,2));
    console.info('LIVE_SMOKE_PASSED',JSON.stringify({accuracy:result.accuracy,coverage:result.coverage,trapResult:result.trapResult,runEstimatedUsd:runReported,runReservedUsd:runReserve}));
  } finally {
    await state?.cleanup();await lock.close();await unlink(lockPath);
    console.info('LIVE_SPEND',JSON.stringify({runEstimatedUsd:runReported,runReservedUsd:runReserve,total:ledger,scope:'this local smoke script only; verify account-wide spend in OpenAI dashboard'}));
  }
}
main().catch(()=>{console.error('LIVE_SMOKE_FAILED',stage,'see safe stage/status output; no credentials printed.');process.exitCode=1;});
