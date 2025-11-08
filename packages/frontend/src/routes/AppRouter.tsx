import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from '../App';
import { useNavigate } from 'react-router-dom';
import { OnboardingStepper } from '../ui/onboarding/OnboardingStepper';
import { AuthProvider, ProtectedRoute } from '../contexts/AuthProvider';
import { LoginPage } from '../components/auth/LoginButton';
import { FeatureFlagProvider } from '../contexts/FeatureFlags';

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
      <FeatureFlagProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <App />
                </ProtectedRoute>
              }
            />
            <Route
              path="/village/:id"
              element={
                <ProtectedRoute>
                  <App />
                </ProtectedRoute>
              }
            />
            {/* Public mode just forwards to the same component; App will fetch viewerRole */}
            <Route path="/village/:id/public" element={<App />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </FeatureFlagProvider>
    </BrowserRouter>
  );
}
