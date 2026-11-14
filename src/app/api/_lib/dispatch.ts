import { getRuntime } from '@/modules/runtime';
import { createApi,type Api } from './handlers';
import { guarded } from './http';

/** Initialization failures use the same safe JSON envelope as request failures. */
export function dispatch(work:(api:Api)=>Promise<Response>):Promise<Response> {
  return guarded(()=>work(createApi(getRuntime())));
}
