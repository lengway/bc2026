import { randomUUID } from 'node:crypto';
import type { Job, JobKind, JobsService } from '@/modules/jobs';

export interface JobLease { jobId: string; owner: string; token: string }
export type JobHandler = (job: Job, lease: JobLease) => Promise<void>;

export function createWorker({jobs,handlers,owner=randomUUID(),leaseMs=120_000,onError=()=>{}}: {
  jobs: JobsService; handlers: Record<JobKind,JobHandler>; owner?:string; leaseMs?:number;
  onError?: (code:string,jobId:string) => void;
}) {
  return {
    async runOnce():Promise<boolean> {
      const job=await jobs.claim(owner,{leaseMs});
      if (!job) return false;
      if (!job.leaseToken) throw new Error('Claimed job has no lease token');
      const lease={jobId:job.id,owner,token:job.leaseToken};
      let renewing:Promise<unknown>|undefined;
      const timer=setInterval(()=>{
        if (!renewing) renewing=jobs.renewLease(job.id,owner,lease.token,leaseMs)
          .catch(()=>onError('LEASE_RENEWAL_FAILED',job.id)).finally(()=>{renewing=undefined;});
      },Math.max(250,Math.floor(leaseMs/3)));
      try {
        // Handlers that publish data complete the lease inside that same transaction.
        await handlers[job.kind](job,lease);
        await jobs.complete(job.id,owner,lease.token);
      } catch {
        await jobs.fail(job.id,owner,lease.token,'JOB_HANDLER_FAILED',Math.min(60_000,1000*2**job.attempts));
        onError('JOB_HANDLER_FAILED',job.id);
      } finally {
        clearInterval(timer);
        await renewing;
      }
      return true;
    },
  };
}
