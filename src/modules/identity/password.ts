import { hash, verify, type Options } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';

// OWASP minimum Argon2id parameters; asynchronous native hashing keeps the event loop responsive.
const options: Options = { algorithm: 2 /* Argon2id */, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 };
export const hashPassword = (password: string) => hash(password, options);
let dummy: Promise<string> | undefined;
export async function verifyPassword(password: string, encoded: string | null): Promise<boolean> {
  dummy ??= hashPassword(randomBytes(32).toString('base64url'));
  const fallback = await dummy;
  const matches = await verify(encoded ?? fallback, password);
  return encoded !== null && matches;
}
