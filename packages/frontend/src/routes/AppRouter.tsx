import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from '../App';
import { useNavigate } from 'react-router-dom';
import { OnboardingStepper } from '../ui/onboarding/OnboardingStepper';

function OnboardingPage() {
  const nav = useNavigate();
  return (
    <OnboardingStepper
      open
      onClose={() => nav('/')}
      onEnterVillage={(id) => nav(`/village/${encodeURIComponent(id)}`)}
    />
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/village/:id" element={<App />} />
        {/* Public mode just forwards to the same component; App will fetch viewerRole */}
        <Route path="/village/:id/public" element={<App />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
