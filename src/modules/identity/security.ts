import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '@/modules/shared';

export const SESSION_COOKIE = 'skills_session';
export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');

export function assertOrigin(origin: string | null, appUrl: string): void {
  if (origin !== new URL(appUrl).origin) throw new AppError('FORBIDDEN', 403, 'Request origin is not allowed.');
}

export function safeRedirect(target: string | null | undefined): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || /[\\\x00-\x20]/.test(target)) return '/onboarding';
  try {
    const decoded = decodeURIComponent(target);
    if (decoded.startsWith('//') || /[\\\x00-\x1f]/.test(decoded)) return '/onboarding';
    const url = new URL(target, 'https://local.invalid');
    if (url.origin !== 'https://local.invalid' || !/^\/(onboarding|dashboard|path|case|review|settings|billing|history|certificates|help)(\/|$)/.test(url.pathname)) return '/onboarding';
    return url.pathname + url.search + url.hash;
  } catch { return '/onboarding'; }
}

export function sessionCookie(token: string, expiresAt: Date, secure: boolean, now = new Date()): string {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Expires=${expiresAt.toUTCString()}${secure ? '; Secure' : ''}`;
}

export function readSessionCookie(header: string | null): string | null {
  const value = header?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
