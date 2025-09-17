const SENSITIVE_KEYS = [
  'authorization', 'cookie', 'set-cookie',
  'password', 'pass', 'secret', 'token', 'access_token', 'refresh_token', 'id_token', 'client_secret',
  'api_key', 'apikey', 'apiKey',
  'session', 'sessionid', 'session_id',
  'jwt', 'bearer',
  'email',
];

function norm(k: string) {
  return k.toLowerCase().replace(/[-_]/g, '');
}

export function isSensitiveKey(key: string): boolean {
  const nk = norm(key);
  return SENSITIVE_KEYS.some((s) => nk.includes(norm(s)));
}

function maskEmail(v: string): string {
  const at = v.indexOf('@');
  if (at <= 1) return '[redacted]';
  const local = v.slice(0, at);
  const dom = v.slice(at);
  const head = local.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(1, local.length - 2))}${dom}`;
}

function redactValue(val: unknown, keyHint?: string): unknown {
  if (typeof val === 'string') {
    if (keyHint && isSensitiveKey(keyHint)) return '[redacted]';
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) return maskEmail(val);
    if (/Bearer\s+[A-Za-z0-9\-_.]+/.test(val)) return 'Bearer [redacted]';
    if (val.length > 256) return val.slice(0, 256) + '…';
    return val;
  }
  return val;
}

export function scrubHeaders(h: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(h || {})) {
    out[k] = isSensitiveKey(k) ? '[redacted]' : redactValue(v, k);
  }
  return out;
}

export function scrubObject<T = any>(obj: T): T {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => scrubObject(v)) as any;
  const out: any = {};
  for (const [k, v] of Object.entries(obj as any)) {
    if (isSensitiveKey(k)) out[k] = '[redacted]';
    else if (v && typeof v === 'object') out[k] = scrubObject(v);
    else out[k] = redactValue(v, k);
  }
  return out as T;
}

export function redactUrl(url: string): string {
  try {
    const base = url.startsWith('http') ? '' : 'http://local';
    const u = new URL(base + url);
    const keys = Array.from(u.searchParams.keys());
    for (const k of keys) if (isSensitiveKey(k)) u.searchParams.set(k, '[redacted]');
    return base ? u.pathname + (u.search || '') : u.toString();
  } catch {
    return url;
  }
}

