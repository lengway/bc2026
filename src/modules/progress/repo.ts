import { z } from 'zod';
import { Evaluation,type CaseResponse } from '@/contracts';
import type { SqlExecutor } from '@/modules/database';
import { AppError } from '@/modules/shared';
import type { SubmittedSnapshot } from '@/modules/simulation';
import { calendarWeekStart,dateFromDayNumber,dayNumber,levelForXp,localDate,streakFromDays } from './math';

export async function timezoneFor(db:SqlExecutor,userId:string,lock=false) {
  const result=await db.query(`SELECT timezone FROM users WHERE id=$1${lock?' FOR UPDATE':''}`,[userId]);
  if(!result.rows[0]) throw new AppError('NOT_FOUND',404,'User account not found.');
  return z.object({timezone:z.string()}).parse(result.rows[0]).timezone;
}
const ActivityRow=z.object({total:z.coerce.number().int().nonnegative(),weekly:z.coerce.number().int().nonnegative()});
const PracticeDateRows=z.array(z.object({day:z.iso.date()}));
export async function readActivity(db:SqlExecutor,userId:string,timezone:string,today:string) {
  let calendarZone='UTC';
  try { calendarZone=new Intl.DateTimeFormat('en-US',{timeZone:timezone}).resolvedOptions().timeZone; }
  catch { /* Use the same UTC fallback as localDate. */ }
  const [completed,practiced]=await Promise.all([
    db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (
      WHERE (COALESCE(submitted_at,created_at) AT TIME ZONE $2)::date BETWEEN $3::date AND $4::date
    ) AS weekly FROM cases WHERE user_id=$1 AND status='evaluated'`,[userId,calendarZone,calendarWeekStart(today),today]),
    db.query(`SELECT DISTINCT practice_date::text AS day FROM practice_completions
      WHERE user_id=$1 AND counts_as_practice=true AND practice_date BETWEEN $2::date AND $3::date
      ORDER BY day`,[userId,dateFromDayNumber(dayNumber(today)-13),today]),
  ]);
  const {total,weekly}=ActivityRow.parse(completed.rows[0]);
  return {totalCompleted:total,completedThisWeek:weekly,today,practicedDates:PracticeDateRows.parse(practiced.rows).map(({day})=>day)};
}
export async function award(tx:SqlExecutor,snapshot:SubmittedSnapshot,input:Evaluation,now:Date) {
  const evaluation=Evaluation.parse(input);
  if(evaluation.caseId!==snapshot.case.id) throw new Error('Evaluation and snapshot do not match');
  const timezone=await timezoneFor(tx,snapshot.case.userId,true);
  const owner=z.object({user_id:z.uuid(),status:z.string()}).parse((await tx.query('SELECT user_id,status FROM cases WHERE id=$1',[snapshot.case.id])).rows[0]);
  if(owner.user_id!==snapshot.case.userId||owner.status!=='evaluated') throw new AppError('VALIDATION',409,'Only evaluated cases can award progress.');
  const date=localDate(new Date(snapshot.submittedAt),timezone);
  const practiced=snapshot.events.some(event=>event.actor==='user'&&event.type==='message');
  const inserted=await tx.query(`INSERT INTO practice_completions(case_id,user_id,practice_date,counts_as_practice,created_at)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(case_id) DO NOTHING RETURNING case_id`,[snapshot.case.id,snapshot.case.userId,date,practiced,now]);
  if(!inserted.rowCount) return;
  if(evaluation.accuracy!==null) {
    const xp=Math.round(evaluation.accuracy*(snapshot.case.type==='weekly'?3:1));
    for(const skill of new Set(evaluation.skills.map(item=>item.skill))) {
      const awardRow=await tx.query(`INSERT INTO progress_awards(case_id,user_id,skill,xp,created_at) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT DO NOTHING RETURNING case_id`,[snapshot.case.id,snapshot.case.userId,skill,xp,now]);
      if(!awardRow.rowCount) continue;
      const total=z.object({xp:z.number().int()}).parse((await tx.query(`INSERT INTO skill_progress(user_id,skill,level,xp) VALUES($1,$2,1,$3)
        ON CONFLICT(user_id,skill) DO UPDATE SET xp=skill_progress.xp+EXCLUDED.xp RETURNING xp`,[snapshot.case.userId,skill,xp])).rows[0]).xp;
      await tx.query('UPDATE skill_progress SET level=$3 WHERE user_id=$1 AND skill=$2',[snapshot.case.userId,skill,levelForXp(total).level]);
    }
  }
  const days=PracticeDateRows.parse((await tx.query(`SELECT DISTINCT practice_date::text AS day FROM practice_completions
    WHERE user_id=$1 AND counts_as_practice=true ORDER BY day`,[snapshot.case.userId])).rows).map(row=>row.day);
  const streak=streakFromDays(days);
  await tx.query(`INSERT INTO streaks(user_id,current,best,last_practice_date) VALUES($1,$2,$3,$4)
    ON CONFLICT(user_id) DO UPDATE SET current=EXCLUDED.current,best=EXCLUDED.best,last_practice_date=EXCLUDED.last_practice_date`,
  [snapshot.case.userId,streak.current,streak.best,streak.lastPracticeDate]);
}
export const SkillRows=z.array(z.object({skill:z.string(),xp:z.number().int().nonnegative()}));
export const StreakRow=z.object({current:z.number().int(),best:z.number().int(),last_practice_date:z.iso.date().nullable()});
export const HistoryRows=z.array(z.object({case_id:z.uuid(),title:z.string(),accuracy:z.number().int().nullable(),date:z.coerce.date()}));
export type CaseReader=(caseId:string,userId:string)=>Promise<CaseResponse|null>;
