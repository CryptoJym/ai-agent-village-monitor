type CacheEntry = {
  token: string | null;
  inflight: Promise<string | null> | null;
};

const cache = new Map<string, CacheEntry>();

function getOriginKey(input: RequestInfo | URL): string {
  try {
    if (typeof input === 'string') {
      if (input.startsWith('http://') || input.startsWith('https://')) return new URL(input).origin;
      return typeof location !== 'undefined' ? location.origin : 'same';
    }
    // Request objects include a url field
    const url = (input as any)?.url ? String((input as any).url) : '';
    if (url.startsWith('http://') || url.startsWith('https://')) return new URL(url).origin;
    return typeof location !== 'undefined' ? location.origin : 'same';
  } catch {
    return typeof location !== 'undefined' ? location.origin : 'same';
  }
}

function getCsrfUrl(originKey: string): string {
  if (!originKey || originKey === 'same') return '/auth/csrf';
  return `${originKey}/auth/csrf`;
}

async function fetchCsrfToken(originKey: string): Promise<string | null> {
  try {
    const res = await fetch(getCsrfUrl(originKey), { credentials: 'include' });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const token = data?.csrfToken;
    if (typeof token !== 'string' || token.length < 10) return null;
    return token;
  } catch {
    return null;
  }
}

export function clearCsrfToken(originKey?: string) {
  if (!originKey) {
    cache.clear();
    return;
  }
  cache.delete(originKey);
}

export async function getCsrfToken(originKey: string): Promise<string | null> {
  const key = originKey || 'same';
  const existing = cache.get(key);
  if (existing?.token) return existing.token;
  if (existing?.inflight) return existing.inflight;

  const entry: CacheEntry = existing || { token: null, inflight: null };
  entry.inflight = fetchCsrfToken(key).then((t) => {
    entry.token = t;
    entry.inflight = null;
    return t;
  });
  cache.set(key, entry);
  return entry.inflight;
}

export async function csrfFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const method = String(init.method || 'GET').toUpperCase();
  const isSafe = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  const originKey = getOriginKey(input);

  if (isSafe) {
    return fetch(input, { ...init, credentials: init.credentials ?? 'include' });
  }

  const headers = new Headers(init.headers || {});
  const token = await getCsrfToken(originKey);
  if (token) headers.set('X-CSRF-Token', token);

  const res = await fetch(input, { ...init, headers, credentials: init.credentials ?? 'include' });
  if (res.status !== 403) return res;

  // Token can become invalid if the server secret rotates; refresh once.
  clearCsrfToken(originKey);
  const tokenRetry = await getCsrfToken(originKey);
  const headersRetry = new Headers(init.headers || {});
  if (tokenRetry) headersRetry.set('X-CSRF-Token', tokenRetry);
  return fetch(input, {
    ...init,
    headers: headersRetry,
    credentials: init.credentials ?? 'include',
  });
}
