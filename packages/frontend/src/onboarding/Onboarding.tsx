import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Stepper } from './Stepper';

type StepId = 'login' | 'org' | 'install' | 'village' | 'sync' | 'done' | 'demo';

function steps(t: (k: string) => string) {
  return [
    { id: 'login', title: t('onboarding.step.login') },
    { id: 'org', title: t('onboarding.step.org') },
    { id: 'install', title: t('onboarding.step.install') },
    { id: 'village', title: t('onboarding.step.create') },
    { id: 'sync', title: t('onboarding.step.sync') },
  ] as const;
}

export default function Onboarding() {
  const { t } = useTranslation();
  const STEPS = useMemo(() => steps(t), [t]);
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];

  const actions = useMemo(() => {
    return {
      next() {
        setStepIdx((s) => Math.min(STEPS.length - 1, s + 1));
      },
      back() {
        setStepIdx((s) => Math.max(0, s - 1));
      },
      demo() {
        window.location.href = '/?demo=1';
      },
      login() {
        window.location.href = '/auth/login';
      },
    };
  }, []);

  return (
    <div
      style={{
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
        padding: 16,
        maxWidth: 880,
        margin: '0 auto',
      }}
    >
      <h1 style={{ marginBottom: 4 }}>{t('app.title')}</h1>
      <p style={{ color: '#94a3b8', marginTop: 0 }}>{t('onboarding.step.demo')}</p>

      <Stepper steps={STEPS} active={stepIdx} />

      <div
        style={{
          marginTop: 16,
          background: '#0b1220',
          border: '1px solid #1f2937',
          borderRadius: 8,
          padding: 16,
        }}
      >
        {step.id === 'login' && (
          <Section
            title={t('onboarding.step.login')}
            body={t('onboarding.step.login')}
            primary={{ label: t('onboarding.step.login'), onClick: actions.login }}
            secondary={{ label: 'Continue', onClick: actions.next }}
            demo={{ label: t('onboarding.step.demo'), onClick: actions.demo }}
          />
        )}
        {step.id === 'org' && (
          <Section
            title={t('onboarding.step.org')}
            body={t('onboarding.step.org')}
            primary={{ label: t('onboarding.step.org'), onClick: actions.next }}
            secondary={{ label: 'Back', onClick: actions.back }}
            demo={{ label: t('onboarding.step.demo'), onClick: actions.demo }}
          />
        )}
        {step.id === 'install' && (
          <Section
            title={t('onboarding.step.install')}
            body={t('onboarding.step.install')}
            primary={{ label: 'Open Installation', onClick: actions.next }}
            secondary={{ label: 'Back', onClick: actions.back }}
            demo={{ label: t('onboarding.step.demo'), onClick: actions.demo }}
          />
        )}
        {step.id === 'village' && (
          <Section
            title={t('onboarding.step.create')}
            body={t('onboarding.step.create')}
            primary={{ label: t('onboarding.step.create'), onClick: actions.next }}
            secondary={{ label: 'Back', onClick: actions.back }}
            demo={{ label: t('onboarding.step.demo'), onClick: actions.demo }}
          />
        )}
        {step.id === 'sync' && (
          <Section
            title={t('onboarding.step.sync')}
            body={t('onboarding.step.sync')}
            primary={{ label: 'Start Sync', onClick: actions.next }}
            secondary={{ label: 'Back', onClick: actions.back }}
            demo={{ label: t('onboarding.step.demo'), onClick: actions.demo }}
          />
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  body,
  primary,
  secondary,
  demo,
}: {
  title: string;
  body: string;
  primary: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
  demo?: { label: string; onClick: () => void };
}) {
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p style={{ color: '#a8b3cf' }}>{body}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={primary.onClick} style={btnPrimary}>
          {primary.label}
        </button>
        {secondary && (
          <button type="button" onClick={secondary.onClick} style={btnSecondary}>
            {secondary.label}
          </button>
        )}
        {demo && (
          <button type="button" onClick={demo.onClick} style={btnGhost}>
            {demo.label}
          </button>
        )}
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 14px',
  background: '#2563eb',
  color: '#fff',
  border: '1px solid #1d4ed8',
  borderRadius: 8,
  cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  padding: '10px 14px',
  background: '#1f2937',
  color: '#e5e7eb',
  border: '1px solid #374151',
  borderRadius: 8,
  cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  padding: '10px 14px',
  background: 'transparent',
  color: '#94a3b8',
  border: '1px solid #334155',
  borderRadius: 8,
  cursor: 'pointer',
};
