import { randomUUID } from 'node:crypto';
import { CaseView,ReviewResponse } from '@/contracts';
import { createCatalogService } from '@/modules/catalog';
import type { Database } from '@/modules/database';
import { SubmittedSnapshot } from '@/modules/simulation';
import * as fixture from '../../src/mocks/fixtures';

export async function reviewedCase(db:Database,options:{userId?:string;guest?:boolean;timezone?:string;submittedAt?:string;type?:'onboarding'|'daily'|'weekly'}={}) {
  const userId=options.userId??randomUUID(),caseId=randomUUID();
  const submittedAt=options.submittedAt??'2026-11-14T12:00:00.000Z';
  await db.query(`INSERT INTO users(id,email,display_name,is_guest,timezone,email_verified_at) VALUES($1,$2,$3,$4,$5,CASE WHEN $4 THEN NULL ELSE now() END) ON CONFLICT(id) DO NOTHING`,
    [userId,`${userId}@example.com`,options.guest?'Demo Guest':'Jordan Reyes',options.guest??false,options.timezone??'UTC']);
  const view=CaseView.parse(fixture.caseView);
  const demo=await createCatalogService().getDemoCase('sales','sdr_outbound');
  const review=ReviewResponse.parse({...fixture.review,evaluation:{...fixture.review.evaluation,caseId}});
  const snapshot=SubmittedSnapshot.parse({version:1,case:{...view,id:caseId,userId,type:options.type??'daily',level:'intermediate',isGuest:options.guest??false,isDemo:options.guest??false,
    personas:view.personas.map(publicPersona=>({public:publicPersona,hidden:demo.personas[0].hidden,state:{turn:6,trust:70,patience:4,mood:'neutral',revealed:[],outcome:'won'}})),
    rubric:demo.rubric,startedAt:'2026-11-14T11:50:00.000Z',timeLimitSec:600,model:'test-model',promptVersion:'1'},
    events:fixture.eventsPage.events.map(event=>({...event,caseId,isPublic:true,meta:{...event.meta,privateMarker:'private-event-value'}})),
    drafts:[],submittedAt,reason:'user',limitations:[]});
  await db.query(`INSERT INTO cases(id,user_id,field,subfield,level,type,workspace,status,brief,submitted_at,submitted_snapshot)
    VALUES($1,$2,'sales','sdr_outbound','intermediate',$3,'chat','evaluated',$4,$5,$6)`,
  [caseId,userId,snapshot.case.type,JSON.stringify(view.brief),submittedAt,JSON.stringify(snapshot)]);
  return {snapshot,review,userId,caseId};
}
