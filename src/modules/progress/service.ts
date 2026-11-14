import { z } from 'zod';
import { CASES_REQUIRED, CaseView, SkillPath, WINDOW_DAYS, type Evaluation } from '@/contracts';
import { createCatalogService, type CatalogService } from '@/modules/catalog';
import { canIssue, currentCertificates } from '@/modules/credentials';
import type { Database,SqlExecutor } from '@/modules/database';
import { AppError,systemClock,type Clock } from '@/modules/shared';
import type { SubmittedSnapshot } from '@/modules/simulation';
import { award,HistoryRows,SkillRows,StreakRow,timezoneFor,type CaseReader } from './repo';
import { dayNumber,levelForXp,localDate } from './math';
import { readSkillSeries } from '@/modules/skill-series';

export interface ProgressDeps {db:Database;getCaseForUser:CaseReader;loadSubmission:(caseId:string)=>Promise<SubmittedSnapshot|null>;now?:Clock;catalog?:CatalogService}
export function createProgressService({db,getCaseForUser,loadSubmission,now=systemClock,catalog=createCatalogService()}:ProgressDeps) {
  async function getTodayCases(userId:string) {
    const timezone=await timezoneFor(db,userId),today=localDate(now(),timezone);
    const weekday=new Date(`${today}T00:00:00Z`).getUTCDay();
    const weekStart=dayNumber(today)-(weekday+6)%7;
    const candidates=z.array(z.object({id:z.uuid(),type:z.enum(['daily','weekly']),created_at:z.coerce.date()})).parse((await db.query(`SELECT id,type,created_at FROM cases
      WHERE user_id=$1 AND type IN ('daily','weekly') AND status IN ('ready','in_progress','submitted','evaluated')
      AND created_at>$2 ORDER BY created_at DESC,id DESC`,[userId,new Date(now().getTime()-8*86_400_000)])).rows);
    const result:{daily:CaseView|null;weekly:CaseView|null}={daily:null,weekly:null};
    for(const candidate of candidates) {
      if(result[candidate.type]) continue;
      const date=localDate(candidate.created_at,timezone);
      if(candidate.type==='daily'?date!==today:dayNumber(date)<weekStart) continue;
      const parsed=CaseView.safeParse(await getCaseForUser(candidate.id,userId));
      if(parsed.success) result[candidate.type]=parsed.data;
    }
    return result;
  }
  return {
    awardWithExecutor:(tx:SqlExecutor,snapshot:SubmittedSnapshot,evaluation:Evaluation)=>award(tx,snapshot,evaluation,now()),
    async award(userId:string,evaluation:Evaluation) {
      const snapshot=await loadSubmission(evaluation.caseId);
      if(!snapshot||snapshot.case.userId!==userId) throw new AppError('NOT_FOUND',404,'Case not found.');
      await db.transaction(tx=>award(tx,snapshot,evaluation,now()));
    },
    getTodayCases,
    async getSkillPath(userId:string):Promise<SkillPath> {
      const timezone=await timezoneFor(db,userId),today=localDate(now(),timezone);
      const [skillsResult,streakResult,historyResult,todayCases,assessments,certificates,verified]=await Promise.all([
        db.query('SELECT skill,xp FROM skill_progress WHERE user_id=$1 ORDER BY skill',[userId]),
        db.query('SELECT current,best,last_practice_date::text FROM streaks WHERE user_id=$1',[userId]),
        db.query(`SELECT c.id AS case_id,c.brief->>'title' AS title,e.accuracy,COALESCE(c.submitted_at,c.created_at) AS date
          FROM cases c LEFT JOIN evaluations e ON e.case_id=c.id WHERE c.user_id=$1 AND c.status='evaluated'
          ORDER BY date DESC,c.id DESC LIMIT 50`,[userId]),
        getTodayCases(userId),
        readSkillSeries(db,catalog,userId,now()),
        currentCertificates(db,userId),
        canIssue(db,userId),
      ]);
      const stored=streakResult.rows[0]?StreakRow.parse(streakResult.rows[0]):{current:0,best:0,last_practice_date:null};
      const current=stored.last_practice_date&&dayNumber(today)-dayNumber(stored.last_practice_date)<=1?stored.current:0;
      return SkillPath.parse({
        skills:SkillRows.parse(skillsResult.rows).map(skill=>({...skill,...levelForXp(skill.xp)})),
        series: assessments.map(({ skill, counted, averageAccuracy, level, blockers }) => ({
          skill, casesCounted: counted, required: CASES_REQUIRED, windowDays: WINDOW_DAYS,
          averageAccuracy, eligible: level !== null && verified,
          blockers: verified ? blockers : [...blockers, 'email_unverified'],
          certificate: verified ? certificates.find((item) => item.skill === skill) : undefined,
        })),
        streak:{current,best:stored.best},today:todayCases,
        history:HistoryRows.parse(historyResult.rows).map(row=>({caseId:row.case_id,title:row.title,accuracy:row.accuracy,date:localDate(row.date,timezone)})),
      });
    },
  };
}
export type ProgressService=ReturnType<typeof createProgressService>;
