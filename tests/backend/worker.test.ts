import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,expect,it } from 'vitest';
import { createJobsService } from '@/modules/jobs';
import { createWorker } from '../../src/worker/runner';
import { createTestDatabase } from './db-helper';

let state:Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async()=>{state=await createTestDatabase();});
afterAll(async()=>{await state?.cleanup();});
it('runs a durable job once and fences completed jobs out of later workers',async()=>{
  const userId=randomUUID(),caseId=randomUUID();
  await state.db.query('INSERT INTO users(id,email) VALUES($1,$2)',[userId,`${userId}@example.com`]);
  await state.db.query("INSERT INTO cases(id,user_id,field,subfield,type,workspace) VALUES($1,$2,'sales','sdr_outbound','onboarding','chat')",[caseId,userId]);
  const jobs=createJobsService({db:state.db});
  await jobs.enqueue({caseId,kind:'case.generate',dedupeKey:caseId});
  let runs=0;
  const worker=createWorker({jobs,handlers:{'case.generate':async(_job,lease)=>{
    await state.db.transaction(async(tx)=>{
      if (!await jobs.completeWithExecutor(tx,lease.jobId,lease.owner,lease.token)) throw new Error('Lease lost');
      runs++;
    });
  },'case.evaluate':async()=>{throw new Error('Unexpected handler');}}});
  expect(await worker.runOnce()).toBe(true);
  expect(await worker.runOnce()).toBe(false);
  expect(runs).toBe(1);
  const row=await state.db.query('SELECT status FROM jobs WHERE case_id=$1',[caseId]);
  expect(row.rows[0].status).toBe('completed');
});
