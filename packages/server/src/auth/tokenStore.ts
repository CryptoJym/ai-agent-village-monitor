import { Buffer } from 'node:buffer';
import { getPrisma } from '../db';
import { encryptToken, decryptToken, tokenHash } from './crypto';

export type Provider = 'github';

export async function saveProviderToken(opts: { userKey: string; provider: Provider; token: string; scopes?: string }) {
  const prisma = getPrisma();
  if (!prisma) return; // DB not configured; noop
  const enc = encryptToken(opts.token);
  if (enc) {
    // Encrypted at rest
    await prisma['oAuthToken']?.upsert({
      where: { userKey_provider: { userKey: opts.userKey, provider: opts.provider } },
      update: {
        encCiphertext: enc.ciphertext,
        encIv: enc.iv,
        encTag: enc.tag,
        version: enc.version,
        scopes: opts.scopes ?? undefined,
        lastUsedAt: new Date(),
      },
      create: {
        userKey: opts.userKey,
        provider: opts.provider,
        encCiphertext: enc.ciphertext,
        encIv: enc.iv,
        encTag: enc.tag,
        version: enc.version,
        scopes: opts.scopes ?? undefined,
      },
    });
  } else {
    // Fallback: hashed reference only (not retrievable). Store digest in ciphertext field; leave iv/tag empty.
    const salt = process.env.GITHUB_TOKEN_SALT || process.env.JWT_SECRET || '';
    const digest = tokenHash(Buffer.from(opts.token + salt, 'utf8'));
    await prisma['oAuthToken']?.upsert({
      where: { userKey_provider: { userKey: opts.userKey, provider: opts.provider } },
      update: { encCiphertext: digest, encIv: Buffer.alloc(0), encTag: Buffer.alloc(0), version: 0, scopes: opts.scopes ?? undefined },
      create: { userKey: opts.userKey, provider: opts.provider, encCiphertext: digest, encIv: Buffer.alloc(0), encTag: Buffer.alloc(0), version: 0, scopes: opts.scopes ?? undefined },
    });
  }
}

export async function getProviderToken(opts: { userKey: string; provider: Provider }): Promise<string | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  const rec = await prisma['oAuthToken']?.findUnique({ where: { userKey_provider: { userKey: opts.userKey, provider: opts.provider } } });
  if (!rec) return null;
  if (rec.version !== 1) return null; // hashed reference only
  const token = decryptToken({ ciphertext: rec.encCiphertext, iv: rec.encIv, tag: rec.encTag, version: rec.version });
  if (token) {
    try { await prisma['oAuthToken']?.update({ where: { id: rec.id }, data: { lastUsedAt: new Date() } }); } catch {}
  }
  return token;
}

export async function revokeProviderToken(opts: { userKey: string; provider: Provider }) {
  const prisma = getPrisma();
  if (!prisma) return;
  try { await prisma['oAuthToken']?.delete({ where: { userKey_provider: { userKey: opts.userKey, provider: opts.provider } } }); } catch {}
}

