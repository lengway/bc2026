import { z } from 'zod';

const Flag = z.enum(['true', 'false']).default('false').transform((value) => value === 'true');
const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  LLM_PROVIDER: z.literal('openai').default('openai'),
  LLM_MODEL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
  DEMO_MODE: Flag,
  GUEST_ACCESS_ENABLED: Flag,
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: Flag,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ID_YEARLY: z.string().optional(),
});
export type ServerConfig = z.infer<typeof Env>;

export function readConfig(input: Record<string, string | undefined> = process.env): ServerConfig {
  const result = Env.safeParse(input);
  if (!result.success) throw new Error(`Missing or invalid server configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  if (result.data.NODE_ENV === 'production' && new URL(result.data.APP_URL).protocol !== 'https:') {
    throw new Error('APP_URL must use HTTPS in production.');
  }
  return result.data;
}
