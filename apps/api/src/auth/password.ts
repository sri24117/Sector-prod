import argon2 from "argon2";

// argon2id per ADR-0005 (docs/decisions/ADR-0005-auth-approach.md). Default
// argon2 package params are already tuned for interactive login (not the
// memory-heavy "kdf for encryption" profile) — not overriding them without
// a concrete reason to.

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain);
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain).catch(() => false);
}
