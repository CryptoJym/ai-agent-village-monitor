// JSON utilities safe for BigInt and Date values

export function jsonReplacer(_key: string, value: unknown) {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  return value as any;
}

export function jsonSafe<T>(obj: T): T {
  try {
    return JSON.parse(JSON.stringify(obj, jsonReplacer));
  } catch {
    return obj;
  }
}

