import { useTranslation } from 'react-i18next';

export function LocaleSwitcher() {
  const { i18n } = useTranslation();
  const lang = i18n.language || 'en';
  function setLang(next: string) {
    i18n.changeLanguage(next);
    try {
      localStorage.setItem('lang', next);
    } catch (e) {
      void e;
    }
  }
  const langNames: Record<string, string> = {
    en: 'English',
    es: 'Español',
  };

  return (
    <div
      role="group"
      aria-label="Language selection"
      style={{ position: 'absolute', right: 12, top: 56, display: 'flex', gap: 6 }}
    >
      {['en', 'es'].map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setLang(l);
            }
          }}
          style={{
            padding: '4px 8px',
            borderRadius: 6,
            border: '1px solid #334155',
            background: lang === l ? '#1f2937' : '#0b1220',
            color: '#e5e7eb',
            cursor: 'pointer',
          }}
          aria-pressed={lang === l}
          aria-label={`Switch to ${langNames[l] || l}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
