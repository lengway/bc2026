import { z } from 'zod';
import {
  CaseParams,CaseResponse,CertificateParams,CertificateResponse,CheckoutRequest,CheckoutResponse,CopilotRequest,CopilotResponse,
  EditorBatch,EditorBatchAck,EventsPage,EventsQuery,GenerateCaseRequest,GenerateCaseResponse,IntakeRequest,LogoutResponse,
  MagicLinkRequest,MagicLinkResponse,MagicLinkVerifyQuery,MoveRequest,MoveResponse,Profile,ReviewResponse,SessionView,
  SkillPath,StartCaseResponse,StripeWebhookResponse,SubmitCaseResponse,
} from '@/contracts';
import { assertOrigin,readSessionCookie,sessionCookie } from '@/modules/identity';
import type { CoreRuntime } from '@/modules/runtime';
import { AppError } from '@/modules/shared';
import { body,guarded,json,query,readBody,type ParamsContext } from './http';
import { eventStream,streamCursor } from './stream';

const Empty=z.strictObject({});
export function createApi(app:CoreRuntime,{streamPollMs=2000}:{streamPollMs?:number}={}) {
  const secure=new URL(app.config.APP_URL).protocol==='https:';
  const csrf=(request:Request)=>assertOrigin(request.headers.get('origin'),app.config.APP_URL);
  const requestKey=(request:Request)=>app.config.NODE_ENV==='production'?(request.headers.get('x-real-ip')??'unknown'):'local-development';
  const token=(request:Request)=>readSessionCookie(request.headers.get('cookie'));
  async function user(request:Request) {
    const session=await app.identity.getSession(token(request));
    if(!session) throw new AppError('UNAUTHORIZED',401,'Sign in to continue.');
    return session.user;
  }
  const caseId=async(context:ParamsContext)=>CaseParams.parse(await context.params).id;
  return {
    authOptions:()=>guarded(async()=>json(z.object({guestAccessEnabled:z.boolean()}),{guestAccessEnabled:app.config.GUEST_ACCESS_ENABLED})),
    session:(request:Request)=>guarded(async()=>json(SessionView,await app.identity.getSession(token(request)))),
    magicLink:(request:Request)=>guarded(async()=>{
      csrf(request);const input=await body(request,MagicLinkRequest);
      return json(MagicLinkResponse,await app.identity.requestMagicLink(input.email,requestKey(request)),202);
    }),
    verify:(request:Request)=>guarded(async()=>{
      const input=MagicLinkVerifyQuery.parse(query(request));
      const result=await app.identity.consumeMagicLink(input.token);
      if(!result.session) throw new Error('Session was not created');
      return new Response(null,{status:303,headers:{Location:new URL('/onboarding',app.config.APP_URL).toString(),
        'Set-Cookie':sessionCookie(result.token,new Date(result.session.expiresAt),secure),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
    }),
    guest:(request:Request)=>guarded(async()=>{
      csrf(request);await body(request,Empty);
      const result=await app.identity.createGuestSession(requestKey(request),token(request));
      if(!result.session) throw new Error('Guest session was not created');
      return json(SessionView.unwrap(),result.session,200,{'Set-Cookie':sessionCookie(result.token,new Date(result.session.expiresAt),secure)});
    }),
    logout:(request:Request)=>guarded(async()=>{
      csrf(request);await body(request,Empty);await app.identity.revokeSession(token(request));
      return json(LogoutResponse,{ok:true},200,{'Set-Cookie':sessionCookie('',new Date(0),secure)});
    }),
    intake:(request:Request)=>guarded(async()=>{
      csrf(request);const owner=await user(request);
      return json(Profile,await app.identity.upsertProfileFromIntake(owner.id,await body(request,IntakeRequest)));
    }),
    generateCase:(request:Request)=>guarded(async()=>{
      csrf(request);const owner=await user(request);const input=await body(request,GenerateCaseRequest);
      return json(GenerateCaseResponse,await app.caseEngine.generateCase(owner.id,input.type),202);
    }),
    getCase:(request:Request,context:ParamsContext)=>guarded(async()=>{
      const owner=await user(request);return json(CaseResponse,await app.caseEngine.getCaseForUser(await caseId(context),owner.id));
    }),
    start:(request:Request,context:ParamsContext)=>guarded(async()=>{
      csrf(request);const owner=await user(request);await body(request,Empty);
      return json(StartCaseResponse,await app.simulation.startCase(await caseId(context),owner.id));
    }),
    move:(request:Request,context:ParamsContext)=>guarded(async()=>{
      csrf(request);const owner=await user(request);
      return json(MoveResponse,await app.simulation.handleMove(await caseId(context),owner.id,await body(request,MoveRequest)));
    }),
    copilot:(request:Request,context:ParamsContext)=>guarded(async()=>{
      csrf(request);const owner=await user(request);
      return json(CopilotResponse,await app.simulation.askCopilot(await caseId(context),owner.id,await body(request,CopilotRequest)));
    }),
    editorEvents:(request:Request,context:ParamsContext)=>guarded(async()=>{
      csrf(request);const owner=await user(request);
      return json(EditorBatchAck,await app.events.appendEditorBatch(await caseId(context),owner.id,await body(request,EditorBatch,262_144)));
    }),
    events:(request:Request,context:ParamsContext)=>guarded(async()=>{
      const owner=await user(request),id=await caseId(context);
      await app.caseEngine.getCaseForUser(id,owner.id);
      const cursor=EventsQuery.parse(query(request)).afterSeq;
      return json(EventsPage,await app.events.listPublicByCase(id,cursor));
    }),
    stream:(request:Request,context:ParamsContext)=>guarded(async()=>{
      const owner=await user(request),id=await caseId(context),cursor=streamCursor(request);
      await app.caseEngine.getCaseForUser(id,owner.id);
      return eventStream(app,request,id,owner.id,cursor,streamPollMs);
    }),
    submit:(request:Request,context:ParamsContext)=>guarded(async()=>{
      csrf(request);const owner=await user(request);await body(request,Empty);
      return json(SubmitCaseResponse,await app.simulation.submitCase(await caseId(context),owner.id),202);
    }),
    review:(request:Request,context:ParamsContext)=>guarded(async()=>{
      const owner=await user(request),id=await caseId(context);
      const review=await app.evaluation.getReview(id,owner.id);
      return json(ReviewResponse,{...review,certificateSlug:await app.credentials.getOwnedSlug(id,owner.id)});
    }),
    certificate:(_request:Request,context:ParamsContext)=>guarded(async()=>{
      const {slug}=CertificateParams.parse(await context.params);
      return json(CertificateResponse,await app.credentials.getBySlug(slug));
    }),
    path:(request:Request)=>guarded(async()=>json(SkillPath,await app.progress.getSkillPath((await user(request)).id))),
    checkout:(request:Request)=>guarded(async()=>{
      csrf(request);const owner=await user(request);const input=await body(request,CheckoutRequest);
      return json(CheckoutResponse,await app.billing.checkout(owner.id,input.plan));
    }),
    webhook:(request:Request)=>guarded(async()=>{
      return json(StripeWebhookResponse,await app.billing.handleWebhook(await readBody(request,1_048_576),request.headers.get('stripe-signature')??''));
    }),
  };
}
export type Api=ReturnType<typeof createApi>;
