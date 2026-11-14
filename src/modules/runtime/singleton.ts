import { readConfig } from '@/modules/config';
import { createCoreRuntime,type CoreRuntime } from './core';

const holder=globalThis as typeof globalThis & { __skillsBackend?:CoreRuntime };
/** Lazy initialization keeps builds independent of secrets and shares the pool across routes. */
export function getRuntime():CoreRuntime {
  return holder.__skillsBackend??=createCoreRuntime(readConfig());
}
