export function alphaForProgress(p: number): number {
  const clamped = p < 0 ? 0 : p > 1 ? 1 : p;
  return 1 - clamped * 0.8; // 1.0 → 0.2
}
