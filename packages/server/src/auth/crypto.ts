import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || '';
  if (!raw) return null;
  try {
    // Support base64 or hex; fallback to utf8 if malformed
    let key: Buffer;
    if (/^[A-Fa-f0-9]+$/.test(raw) && raw.length === 64) {
      key = Buffer.from(raw, 'hex');
    } else if (/^[A-Za-z0-9+/=]+$/.test(raw)) {
      key = Buffer.from(raw, 'base64');
    } else {
      key = Buffer.from(raw, 'utf8');
    }
    if (key.length !== 32) return null; // require 256-bit key
    return key;
  } catch {
    return null;
  }
}

export type CipherBundle = { ciphertext: Buffer; iv: Buffer; tag: Buffer; version: number };

export function encryptToken(plaintext: string): CipherBundle | null {
  const key = getKey();
  if (!key) return null;
  const iv = randomBytes(12); // GCM recommended IV size
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, iv, tag, version: 1 };
}

export function decryptToken(bundle: CipherBundle): string | null {
  const key = getKey();
  if (!key) return null;
  const decipher = createDecipheriv('aes-256-gcm', key, bundle.iv);
  decipher.setAuthTag(bundle.tag);
  const out = Buffer.concat([decipher.update(bundle.ciphertext), decipher.final()]);
  return out.toString('utf8');
}

export function tokenHash(bytes: Buffer): Buffer {
  // Lightweight hash (SHA-256 via Node crypto) implemented using sync createHash.
  return createHash('sha256').update(bytes).digest();
}
