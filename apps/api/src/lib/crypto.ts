import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for credentials at rest (docs/security/security.md). The key comes
// from CREDENTIAL_ENCRYPTION_KEY (32 bytes, base64). No key => refuse, never a
// silent plaintext fallback.
function key(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) throw new Error("CREDENTIAL_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("CREDENTIAL_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return buf;
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptJson<T>(payload: string): T {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv!);
  d.setAuthTag(tag!);
  return JSON.parse(Buffer.concat([d.update(enc!), d.final()]).toString("utf8")) as T;
}
