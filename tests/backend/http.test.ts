import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,expect,it,vi } from 'vitest';
import { z } from 'zod';
import { readConfig } from '@/modules/config';
import { MockProvider } from '@/modules/llm';
import { createCoreRuntime,type CoreRuntime } from '@/modules/runtime';
import { createCatalogService } from '@/modules/catalog';
import { createApi,type Api } from '../../src/app/api/_lib/handlers';
import { guarded,json,readBody } from '../../src/app/api/_lib/http';
import { createWorker } from '../../src/worker/runner';
import { createTestDatabase } from './db-helper';

let state:Awaited<ReturnType<typeof createTestDatabase>>,app:CoreRuntime,api:Api,cookie:string,userId:string,caseId:string;
let sentLink='';
const origin='https://skills.example';
const context=()=>({params:Promise.resolve({id:caseId})});
const req=(path:string,method='GET',input?:unknown,session=cookie,headers:HeadersInit={})=>new Request(`${origin}${path}`,{
  method,headers:{origin,cookie:session??'','Content-Type':'application/json',...Object.fromEntries(new Headers(headers))},
  ...(input===undefined?{}:{body:JSON.stringify(input)}),
});
beforeAll(async()=>{
  state=await createTestDatabase();
  const demo=await createCatalogService().getDemoCase('sales','sdr_outbound');
  app=createCoreRuntime(readConfig({APP_URL:origin,DATABASE_URL:'unused',LLM_MODEL:'test-model',OPENAI_API_KEY:'unused',SMTP_HOST:'unused',SMTP_FROM:'test@example.com',GUEST_ACCESS_ENABLED:'true',STRIPE_PRICE_ID_MONTHLY:'price_test'}),{
    db:state.db,mailer:{async sendMagicLink(_email,url){sentLink=url;}},provider:new MockProvider({
      'intake.parse':[JSON.stringify({subfield:'sdr_outbound',years:1,pains:['Discovery'],goals:['Qualify leads']})],
      'case.generate':[JSON.stringify({brief:demo.case.brief,docs:demo.case.docs,personas:demo.personas})],
      'case.rubric':[JSON.stringify(demo.rubric)],
    }),
  });
  api=createApi(app,{streamPollMs:10});
  const guest=await api.guest(req('/api/auth/guest','POST',{}));
  cookie=guest.headers.get('set-cookie')!.split(';')[0];
  userId=(await guest.json()).user.id;
});
afterAll(async()=>{await state?.cleanup();});

it('exposes guest flag and an isolated secure session, rejects CSRF and owner spoofing',async()=>{
  expect(await (await api.authOptions()).json()).toEqual({guestAccessEnabled:true});
  expect(await (await api.session(req('/api/auth/session'))).json()).toMatchObject({user:{id:userId,isGuest:true}});
  expect(await (await api.session(req('/api/auth/session','GET',undefined,''))).json()).toBeNull();
  expect((await api.guest(req('/api/auth/guest','POST',{},'',{origin:'https://evil.example'}))).status).toBe(403);
  expect((await api.generateCase(req('/api/cases','POST',{type:'onboarding',userId:randomUUID()}))).status).toBe(400);
  expect((await api.generateCase(req('/api/cases','POST',{type:'onboarding'},''))).status).toBe(401);
  const again=await api.guest(req('/api/auth/guest','POST',{}));
  expect(again.headers.get('set-cookie')).toContain('HttpOnly');
  expect(again.headers.get('set-cookie')).toContain('Secure');
  expect((await again.json()).user.id).toBe(userId);
});

it('handles magic-link verification once and logout revocation through HTTP cookies',async()=>{
  expect((await api.magicLink(req('/api/auth/magic-link','POST',{email:'http-test@example.com'}))).status).toBe(202);
  const verified=await api.verify(new Request(sentLink));
  expect(verified.status).toBe(303);
  expect(verified.headers.get('location')).toBe(`${origin}/onboarding`);
  const memberCookie=verified.headers.get('set-cookie')!.split(';')[0];
  expect((await api.verify(new Request(sentLink))).status).toBe(401);
  expect((await api.logout(req('/api/auth/logout','POST',{},memberCookie))).status).toBe(200);
  expect(await (await api.session(req('/api/auth/session','GET',undefined,memberCookie))).json()).toBeNull();
});

it('validates intake, enqueues generation and enforces Free entitlements via runtime billing',async()=>{
  const profile=await api.intake(req('/api/intake','POST',{field:'sales',level:'beginner',text:'I am a new SDR.'}));
  expect(profile.status).toBe(200);
  const weekly=await api.generateCase(req('/api/cases','POST',{type:'weekly'}));
  expect(weekly.status).toBe(403);
  expect(await weekly.json()).toMatchObject({error:{code:'PAYWALL'}});
  const generated=await api.generateCase(req('/api/cases','POST',{type:'onboarding'}));
  expect(generated.status).toBe(202);caseId=(await generated.json()).caseId;
  expect(await (await api.getCase(req('/api/cases/'+caseId),context())).json()).toMatchObject({status:'generating'});
  await createWorker({jobs:app.jobs,handlers:{'case.generate':app.caseEngine.handleGenerateJob,'case.evaluate':app.evaluation.handleEvaluateJob}}).runOnce();
  const ready=await api.getCase(req('/api/cases/'+caseId),context());
  expect(ready.status).toBe(200);
  const text=await ready.text();
  expect(text).not.toContain('errorToInject');expect(text).not.toContain('innerThought');
  expect((await api.start(req('/api/cases/'+caseId+'/start','POST',{}),context())).status).toBe(200);
  expect((await api.checkout(req('/api/billing/checkout','POST',{plan:'monthly'}))).status).toBe(403);
});

it('denies foreign cases consistently for HTTP reads, writes, polling and streaming',async()=>{
  const stranger=await api.guest(req('/api/auth/guest','POST',{},''));
  const other=stranger.headers.get('set-cookie')!.split(';')[0];
  for(const handler of [api.getCase,api.events,api.stream,api.review]) {
    expect((await handler(req('/api/cases/'+caseId,'GET',undefined,other),context())).status).toBe(404);
  }
  expect((await api.submit(req('/api/cases/'+caseId+'/submit','POST',{},other),context())).status).toBe(404);
  expect((await api.move(req('/api/cases/'+caseId+'/move','POST',{clientMsgId:randomUUID(),personaId:'unknown',text:'Hello'},other),context())).status).toBe(404);
});

it('replays SSE after Last-Event-ID, keeps later events and removes private metadata',async()=>{
  const first=await app.events.append(caseId,{actor:'system',type:'message',content:'Visible first'});
  await app.events.append(caseId,{actor:'system',type:'message',content:'private marker',isPublic:false});
  const second=await app.events.append(caseId,{actor:'system',type:'message',content:'Visible second',meta:{innerThought:'secret reason'}});
  const response=await api.stream(req(`/api/cases/${caseId}/stream?afterSeq=0`,'GET',undefined,cookie,{'last-event-id':String(first.seq)}),context());
  expect(response.status).toBe(200);
  expect(response.headers.get('x-accel-buffering')).toBe('no');
  const reader=response.body!.getReader(),decoder=new TextDecoder();
  const firstChunk=decoder.decode((await reader.read()).value);
  expect(firstChunk).toContain(`id: ${second.seq}`);
  expect(firstChunk).not.toMatch(/Visible first|private marker|innerThought|secret reason/);
  const third=await app.events.append(caseId,{actor:'system',type:'message',content:'Arrived after replay'});
  let received='';
  for(let i=0;i<20&&!received.includes('Arrived after replay');i++) received+=decoder.decode((await reader.read()).value);
  expect(received).toContain(`id: ${third.seq}`);
  await reader.cancel();
  expect((await api.events(req('/api/cases/'+caseId+'/events?afterSeq=-1'),context())).status).toBe(400);
});

it('closes an SSE reader on request abort and on session revocation',async()=>{
  const controller=new AbortController();
  const request=new Request(`${origin}/api/cases/${caseId}/stream`,{headers:{cookie},signal:controller.signal});
  const response=await api.stream(request,context()),reader=response.body!.getReader();
  await reader.read();controller.abort();
  while(!(await reader.read()).done) { /* Drain any events already queued before abort. */ }
  const response2=await api.stream(req('/api/cases/'+caseId+'/stream?afterSeq=99999'),context()),reader2=response2.body!.getReader();
  await reader2.read();
  await api.logout(req('/api/auth/logout','POST',{}));
  while(!(await reader2.read()).done) { /* Revocation is observed on the next poll. */ }
});

it('rejects oversized/invalid JSON and UTF-8, and never leaks internal failures',async()=>{
  expect((await api.magicLink(new Request(origin,{method:'POST',headers:{origin},body:'{oops'}))).status).toBe(400);
  expect((await api.magicLink(new Request(origin,{method:'POST',headers:{origin},body:'x'.repeat(65_537)}))).status).toBe(413);
  await expect(readBody(new Request(origin,{method:'POST',body:new Uint8Array([0xff])}))).rejects.toMatchObject({status:400});
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  const failed=await guarded(async()=>{throw new Error('sk-secret database password');});
  expect(failed.status).toBe(500);expect(await failed.text()).not.toContain('secret');
  const malformedOutput=await guarded(async()=>json(z.object({count:z.number()}),{count:'invalid'}));
  expect(malformedOutput.status).toBe(500);expect(log).toHaveBeenCalledWith('API_REQUEST_FAILED');
});

it('webhook bypasses CSRF but still requires configured signature verification',async()=>{
  expect((await api.webhook(new Request(origin,{method:'POST',body:'{}'}))).status).toBe(503);
});
