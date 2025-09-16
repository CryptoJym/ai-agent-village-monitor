import React from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingStepper } from './OnboardingStepper';

export function Onboarding() {
  const nav = useNavigate();
  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#0f172a' }}>
      <div style={{ padding: 16, color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ margin: 0 }}>Onboarding</h1>
        <p style={{ color: '#94a3b8' }}>Connect GitHub or explore the demo.</p>
      </div>
      <OnboardingStepper
        open={true}
        onClose={() => nav('/')}
        onEnterVillage={(id) => nav(`/village/${encodeURIComponent(id)}`)}
      />
    </div>
  );
}
