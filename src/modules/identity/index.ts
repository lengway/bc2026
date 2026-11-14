export { createIdentityService, type IdentityService, type IdentityDeps, type MagicLinkMailer } from './service';
export { createSmtpMailer } from './smtp';
export { assertOrigin, hashToken, newToken, readSessionCookie, sessionCookie, safeRedirect, SESSION_COOKIE } from './security';
export { consumeRateLimit } from './repo';
