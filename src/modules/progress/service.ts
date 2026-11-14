import { z } from 'zod';
import { CASES_REQUIRED, CaseView, SkillPath, WINDOW_DAYS, skillsForFocus, type Evaluation } from '@/contracts';
import { createCatalogService, type CatalogService } from '@/modules/catalog';
import { canIssue, currentCertificates } from '@/modules/credentials';
import type { Database,SqlExecutor } from '@/modules/database';
import { AppError,systemClock,type Clock } from '@/modules/shared';
import type { SubmittedSnapshot } from '@/modules/simulation';
import { award,HistoryRows,SkillRows,StreakRow,readActivity,timezoneFor,type CaseReader } from './repo';
import { calendarWeekStart,dayNumber,levelForXp,localDate } from './math';
import { readSkillSeries } from '@/modules/skill-series';

export interface ProgressDeps {
  db: Database;
  getCaseForUser: CaseReader;
  loadSubmission: (caseId: string) => Promise<SubmittedSnapshot | null>;
  now?: Clock;
  catalog?: CatalogService;
  issueSkillCertificatesWithExecutor?: (tx: SqlExecutor, userId: string) => Promise<unknown>;
}
export function createProgressService({
  db, getCaseForUser, loadSubmission, now = systemClock, catalog = createCatalogService(), issueSkillCertificatesWithExecutor,
}: ProgressDeps) {
  async function getTodayCases(userId:string) {
    const timezone=await timezoneFor(db,userId),today=localDate(now(),timezone),weekStart=calendarWeekStart(today);
    const candidates=z.array(z.object({
      id:z.uuid(),type:z.enum(['daily','weekly']),date:z.coerce.date(),archetype_id:z.string().nullable(),
    })).parse((await db.query(`SELECT id,type,COALESCE(submitted_at,created_at) AS date,archetype_id FROM cases
      WHERE user_id=$1 AND type IN ('daily','weekly') AND status IN ('ready','in_progress','submitted','evaluated')
      AND COALESCE(submitted_at,created_at)>$2 ORDER BY date DESC,id DESC`,[userId,new Date(now().getTime()-8*86_400_000)])).rows);
    const result:SkillPath['today']={daily:null,weekly:null};
    for(const candidate of candidates) {
      if(result[candidate.type]) continue;
      const date=localDate(candidate.date,timezone);
      if(candidate.type==='daily'?date!==today:date<weekStart||date>today) continue;
      const parsed=CaseView.safeParse(await getCaseForUser(candidate.id,userId));
      if(!parsed.success) continue;
      result[candidate.type]=parsed.data;
      if(candidate.type==='daily'&&candidate.archetype_id) {
        const pack=await catalog.getPack(parsed.data.field);
        const archetype=pack.archetypes.find(({id})=>id===candidate.archetype_id);
        if(archetype) result.dailySkills=skillsForFocus(archetype.focus);
      }
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
      const [skillsResult,streakResult,historyResult,todayCases,assessments,storedCertificates,verified,activity]=await Promise.all([
        db.query('SELECT skill,xp FROM skill_progress WHERE user_id=$1 ORDER BY skill',[userId]),
        db.query('SELECT current,best,last_practice_date::text FROM streaks WHERE user_id=$1',[userId]),
        db.query(`SELECT c.id AS case_id,c.brief->>'title' AS title,e.accuracy,COALESCE(c.submitted_at,c.created_at) AS date
          FROM cases c LEFT JOIN evaluations e ON e.case_id=c.id WHERE c.user_id=$1 AND c.status='evaluated'
          ORDER BY date DESC,c.id DESC LIMIT 50`,[userId]),
        getTodayCases(userId),
        readSkillSeries(db,catalog,userId,now()),
        currentCertificates(db,userId),
        canIssue(db,userId),
        readActivity(db,userId,timezone,today),
      ]);
      let certificates = storedCertificates;
      if (verified && issueSkillCertificatesWithExecutor && assessments.some(({ skill, level }) =>
        level !== null && level > (storedCertificates.find((item) => item.skill === skill)?.level ?? 0))) {
        // The issuer rereads the scored cases under the same owner lock used by the evaluation worker.
        await db.transaction((tx) => issueSkillCertificatesWithExecutor(tx, userId));
        certificates = await currentCertificates(db, userId);
      }
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
        streak:{current,best:stored.best},today:todayCases,activity,
        history:HistoryRows.parse(historyResult.rows).map(row=>({caseId:row.case_id,title:row.title,accuracy:row.accuracy,date:localDate(row.date,timezone)})),
      });
    },
  };
}
export type ProgressService=ReturnType<typeof createProgressService>;
