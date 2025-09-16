import { useTranslation } from 'react-i18next';

export function LocaleSwitcher() {
  const { i18n } = useTranslation();
  const lang = i18n.language || 'en';
  function setLang(next: string) {
    i18n.changeLanguage(next);
    try {
      localStorage.setItem('lang', next);
    } catch {}
  }
  return (
    <div style={{ position: 'absolute', right: 12, top: 56, display: 'flex', gap: 6 }}>
      {['en', 'es'].map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          style={{
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid #334155',
            background: lang === l ? '#1f2937' : '#0b1220',
            color: '#e5e7eb',
            cursor: 'pointer',
          }}
          aria-pressed={lang === l}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
