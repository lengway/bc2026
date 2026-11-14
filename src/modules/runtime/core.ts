import { createDatabase, type Database } from '@/modules/database';
import { createCatalogService } from '@/modules/catalog';
import { createCaseEngineService } from '@/modules/case-engine';
import { createEventsService } from '@/modules/events';
import { createJobsService } from '@/modules/jobs';
import { createIdentityService,createProfileService,createSmtpMailer,type MagicLinkMailer } from '@/modules/identity';
import { createLlmService,OpenAIProvider,type LlmProvider } from '@/modules/llm';
import type { ServerConfig } from '@/modules/config';
import type { Clock } from '@/modules/shared';
import { createLlmCallRecorder } from './llm-recorder';

export function createCoreRuntime(config:ServerConfig,overrides:{db?:Database;provider?:LlmProvider;mailer?:MagicLinkMailer;now?:Clock}={}) {
  const db=overrides.db??createDatabase(config.DATABASE_URL);
  const now=overrides.now;
  const catalog=createCatalogService();
  const llm=createLlmService({
    provider:overrides.provider??new OpenAIProvider({apiKey:config.OPENAI_API_KEY}),
    recordCall:createLlmCallRecorder(db),defaultModel:config.LLM_MODEL,defaultTimeoutMs:config.LLM_TIMEOUT_MS,now,
  });
  const mailer=overrides.mailer??createSmtpMailer({host:config.SMTP_HOST,port:config.SMTP_PORT,secure:config.SMTP_SECURE,user:config.SMTP_USER,password:config.SMTP_PASSWORD,from:config.SMTP_FROM});
  const identity={
    ...createIdentityService({db,mailer,appUrl:config.APP_URL,guestAccessEnabled:config.GUEST_ACCESS_ENABLED,now}),
    ...createProfileService({db,llm,catalog,now}),
  };
  const jobs=createJobsService({db,now});
  const events=createEventsService({db,now});
  const caseEngine=createCaseEngineService({db,jobs,llm,catalog,now,demoMode:config.DEMO_MODE});
  return {config,db,identity,catalog,llm,jobs,events,caseEngine};
}
export type CoreRuntime=ReturnType<typeof createCoreRuntime>;
