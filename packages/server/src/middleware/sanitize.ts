// Lightweight sanitization utilities used in Zod transforms and route handlers

export function sanitizeString(
  input: string,
  opts?: { maxLen?: number; collapseWhitespace?: boolean; lower?: boolean },
) {
  try {
    let s = String(input);
    // Remove HTML tags (best-effort), keep text content
    s = s.replace(/<[^>]*>/g, '');
    // Unicode normalize
    s = s.normalize('NFKC');
    // Trim and collapse whitespace
    s = s.trim();
    if (opts?.collapseWhitespace !== false) s = s.replace(/\s+/g, ' ');
    if (opts?.lower) s = s.toLowerCase();
    if (opts?.maxLen && opts.maxLen > 0 && s.length > opts.maxLen) s = s.slice(0, opts.maxLen);
    return s;
  } catch {
    return '';
  }
}

// Restrict to safe identifier characters. Optionally lowercase.
export function sanitizeIdentifier(
  input: string,
  opts?: { lower?: boolean; allowSlash?: boolean },
) {
  let s = sanitizeString(input, { collapseWhitespace: true });
  // Allow only safe identifier characters. Place '-' at end of class to avoid range semantics.
  const re = opts?.allowSlash ? /[^A-Za-z0-9._/-]/g : /[^A-Za-z0-9._-]/g;
  s = s.replace(re, '');
  if (opts?.lower) s = s.toLowerCase();
  return s;
}
