import { describe, expect, it } from 'vitest';
import { assertOrigin, hashToken, newToken, readSessionCookie, sessionCookie, safeRedirect } from '../security';

describe('session security', () => {
  it('uses unpredictable tokens and stores only a stable one-way hash', () => {
    const a = newToken();
    expect(a).not.toBe(newToken());
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(hashToken(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(a)).not.toBe(a);
  });
  it('rejects absent, sibling and hostile origins for cookie mutations', () => {
    for (const origin of [null, 'https://evil.example', 'https://app.example.evil.com']) {
      expect(() => assertOrigin(origin, 'https://app.example')).toThrow();
    }
    expect(() => assertOrigin('https://app.example', 'https://app.example/path')).not.toThrow();
  });
  it('sets defensive cookies and reads only the expected token', () => {
    const token = newToken();
    const cookie = sessionCookie(token, new Date('2027-01-01'), true);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(readSessionCookie(`other=abc; ${cookie}`)).toBe(token);
    expect(readSessionCookie('skills_session=%bad')).toBeNull();
  });
  it('allows only local application landing paths', () => {
    for (const target of ['https://evil.example', '//evil.example', '/\\evil.example', '/api/auth/logout']) {
      expect(safeRedirect(target)).toBe('/onboarding');
    }
    for (const target of ['/dashboard', '/history?period=week', '/certificates', '/settings/learning', '/help#scoring']) {
      expect(safeRedirect(target)).toBe(target);
    }
  });
});
