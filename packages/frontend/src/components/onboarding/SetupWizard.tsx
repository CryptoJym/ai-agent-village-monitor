import React, { useState, useEffect } from 'react';

interface SetupWizardProps {
  onComplete: (data: SetupData) => void;
  onBack: () => void;
}

interface SetupData {
  selectedOrgs: string[];
  preferences: {
    notifications: boolean;
    autoSync: boolean;
    theme: 'light' | 'dark' | 'system';
  };
  betaFeatures: string[];
}

interface GitHubOrg {
  id: string;
  login: string;
  avatar_url?: string;
  description?: string;
  public_repos?: number;
}

export function SetupWizard({ onComplete, onBack }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [orgs, setOrgs] = useState<GitHubOrg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [setupData, setSetupData] = useState<SetupData>({
    selectedOrgs: [],
    preferences: {
      notifications: true,
      autoSync: true,
      theme: 'system',
    },
    betaFeatures: [],
  });

  const steps = [
    { id: 'connect', title: 'Connect GitHub', icon: '🔗' },
    { id: 'organizations', title: 'Select Organizations', icon: '🏢' },
    { id: 'preferences', title: 'Preferences', icon: '⚙️' },
    { id: 'beta-features', title: 'Beta Features', icon: '🧪' },
  ];

  const betaFeatures = [
    {
      id: 'advanced-analytics',
      title: 'Advanced Analytics',
      description: 'Detailed insights into agent behavior and repository patterns',
      status: 'experimental' as const,
    },
    {
      id: 'ai-recommendations',
      title: 'AI Recommendations',
      description: 'Smart suggestions for optimizing workflows and agent configurations',
      status: 'preview' as const,
    },
    {
      id: 'team-collaboration',
      title: 'Team Collaboration',
      description: 'Real-time collaboration features for multi-developer environments',
      status: 'coming-soon' as const,
    },
    {
      id: 'custom-dashboards',
      title: 'Custom Dashboards',
      description: 'Create personalized views and monitoring dashboards',
      status: 'experimental' as const,
    },
  ];

  useEffect(() => {
    if (currentStep === 1) {
      fetchOrganizations();
    }
  }, [currentStep]);

  const fetchOrganizations = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/github/orgs', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch organizations');
      const data = await response.json();
      setOrgs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Unable to fetch organizations. Please check your GitHub connection.');
      // Fallback to demo data for beta testing
      setOrgs([
        { id: 'demo-org', login: 'demo-org', description: 'Demo Organization', public_repos: 12 },
        { id: 'test-team', login: 'test-team', description: 'Test Team', public_repos: 8 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete(setupData);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      onBack();
    }
  };

  const toggleOrg = (orgId: string) => {
    setSetupData(prev => ({
      ...prev,
      selectedOrgs: prev.selectedOrgs.includes(orgId)
        ? prev.selectedOrgs.filter(id => id !== orgId)
        : [...prev.selectedOrgs, orgId]
    }));
  };

  const updatePreferences = (key: keyof SetupData['preferences'], value: any) => {
    setSetupData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [key]: value,
      },
    }));
  };

  const toggleBetaFeature = (featureId: string) => {
    setSetupData(prev => ({
      ...prev,
      betaFeatures: prev.betaFeatures.includes(featureId)
        ? prev.betaFeatures.filter(id => id !== featureId)
        : [...prev.betaFeatures, featureId]
    }));
  };

  const containerStyles: React.CSSProperties = {
    width: 'min(600px, 96vw)',
    background: 'linear-gradient(135deg, #0b1220 0%, #1e293b 100%)',
    border: '1px solid #1f2a3a',
    borderRadius: 16,
    padding: 'clamp(24px, 3vw, 40px)',
    color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
    maxHeight: '90vh',
    overflowY: 'auto',
  };

  const stepIndicatorStyles: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  };

  const buttonPrimaryStyles: React.CSSProperties = {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 600,
    transition: 'all 0.3s ease',
  };

  const buttonSecondaryStyles: React.CSSProperties = {
    padding: '12px 24px',
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid #374151',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 16,
    transition: 'all 0.3s ease',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 8, 23, 0.9)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(16px, 3vw, 48px)',
        zIndex: 2000,
      }}
      role="presentation"
    >
      <div
        style={containerStyles}
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-wizard-title"
      >
        {/* Step Indicator */}
        <div style={stepIndicatorStyles}>
          {steps.map((step, index) => (
            <div
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 20,
                background: index === currentStep ? '#1f2937' : 'transparent',
                border: '1px solid',
                borderColor: index === currentStep ? '#374151' : 'transparent',
                fontSize: 14,
              }}
            >
              <span>{step.icon}</span>
              <span style={{
                color: index === currentStep ? '#e2e8f0' : '#64748b',
                fontWeight: index === currentStep ? 600 : 400,
              }}>
                {step.title}
              </span>
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div style={{ minHeight: 300 }}>
          {currentStep === 0 && (
            <div style={{ textAlign: 'center' }}>
              <h2 id="setup-wizard-title" style={{ margin: '0 0 16px 0', fontSize: 24 }}>
                Connect Your GitHub Account
              </h2>
              <p style={{ color: '#94a3b8', marginBottom: 24 }}>
                We'll connect to your GitHub account to sync your repositories and create your village.
              </p>
              <div style={{
                padding: 24,
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid #334155',
                borderRadius: 12,
                marginBottom: 24,
              }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#60a5fa' }}>Required Permissions</h3>
                <ul style={{ textAlign: 'left', color: '#cbd5e1', lineHeight: 1.6 }}>
                  <li>Read access to repositories and organizations</li>
                  <li>Workflow run information for activity tracking</li>
                  <li>Basic profile information</li>
                </ul>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div>
              <h2 style={{ margin: '0 0 16px 0', fontSize: 24 }}>
                Select Organizations
              </h2>
              <p style={{ color: '#94a3b8', marginBottom: 24 }}>
                Choose which GitHub organizations you'd like to monitor in your village.
              </p>

              {loading && (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                  <p>Loading your organizations...</p>
                </div>
              )}

              {error && (
                <div style={{
                  padding: 16,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 8,
                  color: '#fca5a5',
                  marginBottom: 16,
                }}>
                  {error}
                </div>
              )}

              {!loading && orgs.length > 0 && (
                <div style={{ display: 'grid', gap: 12 }}>
                  {orgs.map((org) => (
                    <label
                      key={org.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: 16,
                        background: setupData.selectedOrgs.includes(org.id)
                          ? 'rgba(59, 130, 246, 0.1)'
                          : 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid',
                        borderColor: setupData.selectedOrgs.includes(org.id)
                          ? '#3b82f6'
                          : '#334155',
                        borderRadius: 12,
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={setupData.selectedOrgs.includes(org.id)}
                        onChange={() => toggleOrg(org.id)}
                        style={{ width: 18, height: 18 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{org.login}</div>
                        <div style={{ fontSize: 14, color: '#94a3b8' }}>
                          {org.description || 'No description'}
                          {org.public_repos && ` • ${org.public_repos} repositories`}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 style={{ margin: '0 0 16px 0', fontSize: 24 }}>
                Configure Preferences
              </h2>
              <p style={{ color: '#94a3b8', marginBottom: 24 }}>
                Customize your AI Agent Village Monitor experience.
              </p>

              <div style={{ display: 'grid', gap: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={setupData.preferences.notifications}
                    onChange={(e) => updatePreferences('notifications', e.target.checked)}
                    style={{ width: 18, height: 18 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>Enable Notifications</div>
                    <div style={{ fontSize: 14, color: '#94a3b8' }}>
                      Get notified about important agent activities and system updates
                    </div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={setupData.preferences.autoSync}
                    onChange={(e) => updatePreferences('autoSync', e.target.checked)}
                    style={{ width: 18, height: 18 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>Auto-sync Repositories</div>
                    <div style={{ fontSize: 14, color: '#94a3b8' }}>
                      Automatically sync repository changes and updates
                    </div>
                  </div>
                </label>

                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                    Theme Preference
                  </label>
                  <select
                    value={setupData.preferences.theme}
                    onChange={(e) => updatePreferences('theme', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: '#0f172a',
                      color: '#e2e8f0',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      fontSize: 16,
                    }}
                  >
                    <option value="system">System Default</option>
                    <option value="dark">Dark Mode</option>
                    <option value="light">Light Mode</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 style={{ margin: '0 0 16px 0', fontSize: 24 }}>
                Beta Features
              </h2>
              <p style={{ color: '#94a3b8', marginBottom: 24 }}>
                Enable experimental features and help us test cutting-edge functionality.
              </p>

              <div style={{ display: 'grid', gap: 16 }}>
                {betaFeatures.map((feature) => (
                  <label
                    key={feature.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 16,
                      padding: 16,
                      background: setupData.betaFeatures.includes(feature.id)
                        ? 'rgba(139, 92, 246, 0.1)'
                        : 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid',
                      borderColor: setupData.betaFeatures.includes(feature.id)
                        ? '#8b5cf6'
                        : '#334155',
                      borderRadius: 12,
                      cursor: feature.status !== 'coming-soon' ? 'pointer' : 'not-allowed',
                      opacity: feature.status === 'coming-soon' ? 0.6 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={setupData.betaFeatures.includes(feature.id)}
                      onChange={() => toggleBetaFeature(feature.id)}
                      disabled={feature.status === 'coming-soon'}
                      style={{ width: 18, height: 18, marginTop: 2 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{feature.title}</span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          background: feature.status === 'experimental' ? '#fbbf24' :
                                     feature.status === 'preview' ? '#60a5fa' : '#6b7280',
                          color: '#000',
                        }}>
                          {feature.status.replace('-', ' ')}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, color: '#94a3b8' }}>
                        {feature.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{
                marginTop: 20,
                padding: 16,
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: 8,
                fontSize: 14,
                color: '#cbd5e1',
              }}>
                <strong>🧪 Beta Tester Note:</strong> Your feedback on these features is invaluable!
                Please report any issues or suggestions through the feedback system.
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 32,
          gap: 16,
        }}>
          <button
            onClick={prevStep}
            style={buttonSecondaryStyles}
          >
            {currentStep === 0 ? 'Back to Welcome' : 'Previous'}
          </button>

          <button
            onClick={nextStep}
            disabled={currentStep === 1 && setupData.selectedOrgs.length === 0}
            style={{
              ...buttonPrimaryStyles,
              opacity: currentStep === 1 && setupData.selectedOrgs.length === 0 ? 0.6 : 1,
              cursor: currentStep === 1 && setupData.selectedOrgs.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {currentStep === steps.length - 1 ? 'Complete Setup' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}