import { describe, expect, it } from 'vitest';
import { readConfig } from '.';

const valid = { APP_URL:'https://skills.example',DATABASE_URL:'postgres://private',LLM_MODEL:'test-model',OPENAI_API_KEY:'secret-value',SMTP_HOST:'smtp.example',SMTP_FROM:'Skills <noreply@example.com>' };
describe('server configuration', () => {
  it('does not interpret false as a truthy string', () => {
    expect(readConfig({...valid, DEMO_MODE:'false', SMTP_SECURE:'true'})).toMatchObject({DEMO_MODE:false,SMTP_SECURE:true});
  });
  it('rejects invalid configuration without including values in errors', () => {
    expect(() => readConfig({...valid,APP_URL:'secret-value'})).toThrow('APP_URL');
    try { readConfig({...valid,APP_URL:'secret-value'}); }
    catch (error) { expect(String(error)).not.toContain('secret-value'); }
    expect(() => readConfig({...valid,NODE_ENV:'production',APP_URL:'http://skills.example'})).toThrow('HTTPS');
  });
});
