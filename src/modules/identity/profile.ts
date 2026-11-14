import { z } from 'zod';
import { IntakeRequest, Profile } from '@/contracts';
import { IntakeParsed, type LlmService } from '@/modules/llm';
import type { CatalogService } from '@/modules/catalog';
import type { Database } from '@/modules/database';
import { AppError, type Clock, systemClock } from '@/modules/shared';
import { consumeRateLimit } from './repo';

const Row=z.object({user_id:z.uuid(),intake_text:z.string(),field:z.string(),subfield:z.string(),level:z.string(),years:z.number().int().nullable(),pains:z.array(z.string()),goals:z.array(z.string()),updated_at:z.coerce.date(),daily_goal:z.int()});
function parseRow(input:unknown):Profile {
  const row=Row.parse(input);
  return Profile.parse({userId:row.user_id,intakeText:row.intake_text,field:row.field,subfield:row.subfield,level:row.level,years:row.years,pains:row.pains,goals:row.goals,updatedAt:row.updated_at.toISOString(),dailyGoal:row.daily_goal});
}
export function createProfileService({db,llm,catalog,now=systemClock}:{db:Database;llm:LlmService;catalog:CatalogService;now?:Clock}) {
  return {
    async getProfile(userId:string):Promise<Profile|null> {
      const result=await db.query('SELECT * FROM profiles WHERE user_id=$1',[userId]);
      return result.rows[0]?parseRow(result.rows[0]):null;
    },
    async upsertProfileFromIntake(userId:string,input:IntakeRequest):Promise<Profile> {
      const request=IntakeRequest.parse(input);
      if (!(await catalog.listFields()).includes(request.field)) throw new AppError('VALIDATION',400,'This field is not available yet.');
      const pack=await catalog.getPack(request.field);
      const schema=IntakeParsed.refine(value=>pack.subfields.includes(value.subfield),{path:['subfield'],message:'Choose a supported subfield from the supplied pack.'});
      // This limit protects a public-facing, paid provider call independently of generation.
      await db.transaction(tx=>consumeRateLimit(tx,`intake:${userId}`,20,3_600_000,now()));
      let details:z.infer<typeof IntakeParsed>;
      try { details=(await llm.run('intake.parse',{...request,subfields:pack.subfields},schema,{userId})).data; }
      catch { throw new AppError('LLM_FAILED',502,'Unable to interpret your profile. Please try again.'); }
      const result=await db.query(`INSERT INTO profiles(user_id,intake_text,field,subfield,level,years,pains,goals,updated_at,daily_goal)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10::integer,1)) ON CONFLICT(user_id) DO UPDATE SET
        intake_text=EXCLUDED.intake_text,field=EXCLUDED.field,subfield=EXCLUDED.subfield,level=EXCLUDED.level,
        years=EXCLUDED.years,pains=EXCLUDED.pains,goals=EXCLUDED.goals,updated_at=EXCLUDED.updated_at,
        daily_goal=COALESCE($10,profiles.daily_goal) RETURNING *`,
      [userId,request.text,request.field,details.subfield,request.level,details.years,details.pains,details.goals,now(),request.dailyGoal??null]);
      return parseRow(result.rows[0]);
    },
  };
}
export type ProfileService=ReturnType<typeof createProfileService>;
