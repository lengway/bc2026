import { z } from 'zod';
import { publishCase } from '@/modules/case-engine';
import type { CatalogService } from '@/modules/catalog';
import type { CredentialsService } from '@/modules/credentials';
import type { SqlExecutor } from '@/modules/database';
import { publishReview } from '@/modules/evaluation';
import type { ProgressService } from '@/modules/progress';
import { saveSubmission, writePersonaState } from '@/modules/simulation';
import { DEMO_SERIES_MODEL, prepareDemoSeries } from './series';

export function createGuestDemoSeeder({ catalog, progress, credentials }: {
  catalog: CatalogService;
  progress: Pick<ProgressService, 'awardWithExecutor'>;
  credentials: Pick<CredentialsService, 'issueCertificateWithExecutor' | 'issueSkillCertificatesWithExecutor'>;
}) {
  return async function seedGuest(tx: SqlExecutor, userId: string, now: Date) {
    const owner = await tx.query('SELECT is_guest FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (owner.rows[0]?.is_guest !== true) throw new Error('Synthetic demo series require a guest account.');
    const existing = await tx.query('SELECT id FROM cases WHERE user_id=$1 AND is_demo AND model=$2 LIMIT 1', [userId, DEMO_SERIES_MODEL]);
    if (existing.rows.length) return;

    await tx.query(`INSERT INTO profiles(user_id,intake_text,field,subfield,level,goals,updated_at)
      VALUES($1,$2,'sales','account_executive','intermediate',$3,$4) ON CONFLICT(user_id) DO NOTHING`,
    [userId, 'Synthetic demo profile.\nWants to practice: Handling objections', ['Handling objections'], now]);

    for (const { archetypeId, snapshot, review } of await prepareDemoSeries(catalog, userId, now)) {
      const { case: example, events } = snapshot;
      await tx.query(`INSERT INTO cases(id,user_id,field,subfield,level,type,workspace,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [example.id, userId, example.field, example.subfield, example.level, example.type, example.workspace, example.startedAt]);
      await publishCase(tx, example.id, {
        archetypeId, generated: example, workspace: example.workspace, scoringGuide: example.scoringGuide,
        rubric: example.rubric, isDemo: true, model: DEMO_SERIES_MODEL, promptVersion: '1', seed: example.id,
      }, new Date(example.startedAt));
      await tx.query(`INSERT INTO events(id,case_id,seq,actor,persona_id,type,content,meta,is_public,created_at)
        SELECT e.id,$1,e.seq,e.actor,e."personaId",e.type,e.content,e.meta,e."isPublic",e."createdAt"
        FROM jsonb_to_recordset($2) AS e(id uuid,seq integer,actor text,"personaId" text,type text,content text,
          meta jsonb,"isPublic" boolean,"createdAt" timestamptz)`, [example.id, JSON.stringify(events)]);
      await tx.query('UPDATE cases SET started_at=$2,last_event_seq=$3 WHERE id=$1', [example.id, example.startedAt, events.length]);
      for (const persona of example.personas) {
        await writePersonaState(tx, example.id, persona.public.id, persona.state, new Date(snapshot.submittedAt));
      }
      await saveSubmission(tx, snapshot);
      await publishReview(tx, review, new Date(snapshot.submittedAt));
      await progress.awardWithExecutor(tx, snapshot, review.evaluation);
      await credentials.issueCertificateWithExecutor(tx, snapshot);
    }
    await credentials.issueSkillCertificatesWithExecutor(tx, userId);
  };
}

/** Reserved synthetic identity used only for the CLI's shareable sample. */
export async function getOrCreateDemoSeriesAccount(tx: SqlExecutor) {
  const email = 'demo-skill-series@guest.invalid';
  await tx.query(`INSERT INTO users(email,display_name,is_guest) VALUES($1,'Demo Guest',true)
    ON CONFLICT DO NOTHING`, [email]);
  const row = (await tx.query('SELECT id,is_guest FROM users WHERE email=$1', [email])).rows[0];
  return z.object({ id: z.uuid(), is_guest: z.literal(true) }).parse(row).id;
}
