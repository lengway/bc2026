import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '@/modules/shared';

export const SESSION_COOKIE = 'skills_session';
export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');

export function assertOrigin(origin: string | null, appUrl: string): void {
  if (origin !== new URL(appUrl).origin) throw new AppError('FORBIDDEN', 403, 'Request origin is not allowed.');
}

export function safeRedirect(target: string | null | undefined): string {
  return target && ['/onboarding', '/dashboard', '/path'].includes(target) ? target : '/onboarding';
}

export function sessionCookie(token: string, expiresAt: Date, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure ? '; Secure' : ''}`;
}

export function readSessionCookie(header: string | null): string | null {
  const value = header?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
