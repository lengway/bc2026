import 'dotenv/config';
import { setTimeout as delay } from 'node:timers/promises';
import { getRuntime } from '@/modules/runtime';
import { createWorker } from './runner';

async function main() {
  const app=getRuntime();
  let stopping=false;
  const stop=()=>{stopping=true;};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  const worker=createWorker({jobs:app.jobs,handlers:{'case.generate':app.caseEngine.handleGenerateJob,'case.evaluate':app.evaluation.handleEvaluateJob},
    onError:(code,jobId)=>console.error(code,jobId)});
  console.info('WORKER_READY');
  try {
    while(!stopping) {
      try {
        await app.caseEngine.reconcileFailedGenerations();
        await app.evaluation.reconcileFailedEvaluations();
        if(!await worker.runOnce()) await delay(1000);
      } catch {
        console.error('WORKER_POLL_FAILED');
        await delay(2000);
      }
    }
  } finally {
    process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
    await app.db.close();
  }
}
main().catch(()=>{console.error('WORKER_START_FAILED: check server configuration');process.exitCode=1;});
