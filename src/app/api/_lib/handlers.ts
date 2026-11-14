import { z } from 'zod';
import {
  CaseParams,CaseResponse,CertificateParams,CertificateResponse,CheckoutRequest,CheckoutResponse,CopilotRequest,CopilotResponse,
  EditorBatch,EditorBatchAck,EventsPage,EventsQuery,GenerateCaseRequest,GenerateCaseResponse,IntakeRequest,LogoutResponse,
  MagicLinkRequest,MagicLinkResponse,MagicLinkVerifyQuery,MoveRequest,MoveResponse,Profile,ReviewResponse,SessionView,
  SkillCertificateParams,SkillCertificateResponse,SkillPath,StartCaseResponse,StripeWebhookResponse,SubmitCaseResponse,
} from '@/contracts';
import { assertOrigin,readSessionCookie,sessionCookie } from '@/modules/identity';
import type { CoreRuntime } from '@/modules/runtime';
import { AppError } from '@/modules/shared';
import { assertJson,body,guarded,json,query,readBody,type ParamsContext } from './http';
import { eventStream,streamCursor } from './stream';
import { createAccountApi } from './accounts';

const Empty=z.strictObject({});
export function createApi(app:CoreRuntime,{streamPollMs=2000}:{streamPollMs?:number}={}) {
  const secure=new URL(app.config.APP_URL).protocol==='https:';
  const csrf=(request:Request)=>{assertOrigin(request.headers.get('origin'),app.config.APP_URL);assertJson(request);};
  const requestKey=(request:Request)=>app.config.NODE_ENV==='production'?(request.headers.get('x-real-ip')??'unknown'):'local-development';
  const token=(request:Request)=>readSessionCookie(request.headers.get('cookie'));
  const sessions=new WeakMap<Request,NonNullable<SessionView>>();
  async function respond(request:Request,work:()=>Promise<Response>) {
    const response=await guarded(work);
    const session=sessions.get(request);
    if(session&&!response.headers.has('Set-Cookie')) response.headers.set('Set-Cookie',sessionCookie(token(request)!,new Date(session.expiresAt),secure,app.now()));
    return response;
  }
  async function optionalSession(request:Request) {
    const session=await app.identity.getSession(token(request));
    if(session) sessions.set(request,session);
    return session;
  }
  async function user(request:Request) {
    const session=await optionalSession(request);
    if(!session) throw new AppError('UNAUTHORIZED',401,'Sign in to continue.');
    return session.user;
  }
  const caseId=async(context:ParamsContext)=>CaseParams.parse(await context.params).id;
  return {
    ...createAccountApi(app,{csrf,respond,user,token,requestKey,secure}),
    authOptions:()=>guarded(async()=>json(z.object({guestAccessEnabled:z.boolean()}),{guestAccessEnabled:app.config.GUEST_ACCESS_ENABLED})),
    session:(request:Request)=>respond(request,async()=>json(SessionView,await optionalSession(request))),
    magicLink:(request:Request)=>respond(request,async()=>{
      csrf(request);const input=await body(request,MagicLinkRequest);
      return json(MagicLinkResponse,await app.identity.requestMagicLink(input.email,requestKey(request),input.next),202);
    }),
    verify:(request:Request)=>respond(request,async()=>{
      const input=MagicLinkVerifyQuery.parse(query(request));
      const result=await app.identity.consumeMagicLink(input.token,token(request));
      if(!result.session) throw new Error('Session was not created');
      return new Response(null,{status:303,headers:{Location:new URL(result.next,app.config.APP_URL).toString(),
        'Set-Cookie':sessionCookie(result.token,new Date(result.session.expiresAt),secure,app.now()),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
    }),
    guest:(request:Request)=>respond(request,async()=>{
      csrf(request);await body(request,Empty);
      const result=await app.identity.createGuestSession(requestKey(request),token(request));
      if(!result.session) throw new Error('Guest session was not created');
      return json(SessionView.unwrap(),result.session,200,{'Set-Cookie':sessionCookie(result.token,new Date(result.session.expiresAt),secure,app.now())});
    }),
    logout:(request:Request)=>respond(request,async()=>{
      csrf(request);await body(request,Empty);await app.identity.revokeSession(token(request));
      return json(LogoutResponse,{ok:true},200,{'Set-Cookie':sessionCookie('',new Date(0),secure,app.now())});
    }),
    intake:(request:Request)=>respond(request,async()=>{
      csrf(request);const owner=await user(request);
      return json(Profile,await app.identity.upsertProfileFromIntake(owner.id,await body(request,IntakeRequest)));
    }),
    generateCase:(request:Request)=>respond(request,async()=>{
      csrf(request);const owner=await user(request);const input=await body(request,GenerateCaseRequest);
      return json(GenerateCaseResponse,await app.caseEngine.generateCase(owner.id,input.type,{skill:input.skill}),202);
    }),
    getCase:(request:Request,context:ParamsContext)=>respond(request,async()=>{
      const owner=await user(request);return json(CaseResponse,await app.caseEngine.getCaseForUser(await caseId(context),owner.id));
    }),
    start:(request:Request,context:ParamsContext)=>respond(request,async()=>{
      csrf(request);const owner=await user(request);await body(request,Empty);
      return json(StartCaseResponse,await app.simulation.startCase(await caseId(context),owner.id));
    }),
    move:(request:Request,context:ParamsContext)=>respond(request,async()=>{
      csrf(request);const owner=await user(request);
      return json(MoveResponse,await app.simulation.handleMove(await caseId(context),owner.id,await body(request,MoveRequest)));
    }),
    copilot:(request:Request,context:ParamsContext)=>respond(request,async()=>{
      csrf(request);const owner=await user(request);
      return json(CopilotResponse,await app.simulation.askCopilot(await caseId(context),owner.id,await body(request,CopilotRequest)));
    }),
    editorEvents:(request:Request,context:ParamsContext)=>respond(request,async()=>{
      csrf(request);const owner=await user(request);
      return json(EditorBatchAck,await app.events.appendEditorBatch(await caseId(context),owner.id,await body(request,EditorBatch,262_144)));
    }),
    events:(request:Request,context:ParamsContext)=>respond(request,async()=>{
      const owner=await user(request),id=await caseId(context);
      await app.caseEngine.getCaseForUser(id,owner.id);
      const cursor=EventsQuery.parse(query(request)).afterSeq;
      return json(EventsPage,await app.events.listPublicByCase(id,cursor));
    }),
    stream:(request:Request,context:ParamsContext)=>respond(request,async()=>{
      const owner=await user(request),id=await caseId(context),cursor=streamCursor(request);
      await app.caseEngine.getCaseForUser(id,owner.id);
      return eventStream(app,request,id,owner.id,cursor,streamPollMs);
    }),
    submit:(request:Request,context:ParamsContext)=>respond(request,async()=>{
      csrf(request);const owner=await user(request);await body(request,Empty);
      return json(SubmitCaseResponse,await app.simulation.submitCase(await caseId(context),owner.id),202);
    }),
    review:(request:Request,context:ParamsContext)=>respond(request,async()=>{
      const owner=await user(request),id=await caseId(context);
      const review=await app.evaluation.getReview(id,owner.id);
      const caseRecordSlug=await app.credentials.getOwnedSlug(id,owner.id);
      return json(ReviewResponse,{...review,caseRecordSlug,certificateSlug:caseRecordSlug});
    }),
    certificate:(_request:Request,context:ParamsContext)=>guarded(async()=>{
      const {slug}=CertificateParams.parse(await context.params);
      return json(CertificateResponse,await app.credentials.getBySlug(slug));
    }),
    skillCertificate:(request:Request,context:ParamsContext)=>respond(request,async()=>{
      const {slug}=SkillCertificateParams.parse(await context.params);
      const session=await optionalSession(request);
      return json(SkillCertificateResponse,await app.credentials.getSkillCertificateBySlug(slug,session?.user.id??null));
    }),
    path:(request:Request)=>respond(request,async()=>json(SkillPath,await app.progress.getSkillPath((await user(request)).id))),
    checkout:(request:Request)=>respond(request,async()=>{
      csrf(request);const owner=await user(request);const input=await body(request,CheckoutRequest);
      return json(CheckoutResponse,await app.billing.checkout(owner.id,input.plan));
    }),
    webhook:(request:Request)=>respond(request,async()=>{
      return json(StripeWebhookResponse,await app.billing.handleWebhook(await readBody(request,1_048_576),request.headers.get('stripe-signature')??''));
    }),
  };
}
export type Api=ReturnType<typeof createApi>;
