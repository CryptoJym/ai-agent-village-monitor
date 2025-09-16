export type LanguageStyle = {
  labelColor?: string;
  accentColor?: number;
};

const MAP: Record<string, LanguageStyle> = {
  js: { labelColor: '#fde68a', accentColor: 0xfbbf24 },
  ts: { labelColor: '#93c5fd', accentColor: 0x60a5fa },
  py: { labelColor: '#60a5fa', accentColor: 0x38bdf8 },
  go: { labelColor: '#a7f3d0', accentColor: 0x10b981 },
  rb: { labelColor: '#fecaca', accentColor: 0xf87171 },
  java: { labelColor: '#fca5a5', accentColor: 0xef4444 },
  cs: { labelColor: '#c7d2fe', accentColor: 0x818cf8 },
};

export function getLanguageStyle(lang: string): LanguageStyle {
  const key = (lang || '').toLowerCase();
  return MAP[key] || { labelColor: '#cbd5e1', accentColor: 0x64748b };
}
