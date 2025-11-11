import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define available feature flags
export interface FeatureFlags {
  // Beta features
  advancedAnalytics: boolean;
  aiRecommendations: boolean;
  teamCollaboration: boolean;
  customDashboards: boolean;

  // UI features
  newVillageThemes: boolean;
  enhancedDialogue: boolean;
  realTimeNotifications: boolean;

  // Developer features
  debugMode: boolean;
  performanceMetrics: boolean;
  experimentalSync: boolean;
}

export interface FeatureFlagContextType {
  flags: FeatureFlags;
  isFeatureEnabled: (flag: keyof FeatureFlags) => boolean;
  enableFeature: (flag: keyof FeatureFlags) => void;
  disableFeature: (flag: keyof FeatureFlags) => void;
  resetToDefaults: () => void;
  isBetaTester: boolean;
  setBetaTester: (isBeta: boolean) => void;
}

// Default feature flag states
const defaultFlags: FeatureFlags = {
  // Beta features - disabled by default
  advancedAnalytics: false,
  aiRecommendations: false,
  teamCollaboration: false,
  customDashboards: false,

  // UI features - some enabled by default
  newVillageThemes: true,
  enhancedDialogue: true,
  realTimeNotifications: true,

  // Developer features - disabled by default
  debugMode: false,
  performanceMetrics: false,
  experimentalSync: false,
};

// Beta tester default overrides
const betaTesterFlags: Partial<FeatureFlags> = {
  advancedAnalytics: true,
  aiRecommendations: true,
  customDashboards: true,
  debugMode: true,
  performanceMetrics: true,
};

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

interface FeatureFlagProviderProps {
  children: ReactNode;
  initialFlags?: Partial<FeatureFlags>;
}

export function FeatureFlagProvider({ children, initialFlags = {} }: FeatureFlagProviderProps) {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
  const [isBetaTester, setIsBetaTesterState] = useState<boolean>(false);

  // Load flags from localStorage on mount
  useEffect(() => {
    try {
      const storedFlags = localStorage.getItem('ai-village-feature-flags');
      const storedBetaStatus = localStorage.getItem('ai-village-beta-tester');

      let savedFlags: Partial<FeatureFlags> = {};
      let betaStatus = false;

      if (storedFlags) {
        savedFlags = JSON.parse(storedFlags);
      }

      if (storedBetaStatus) {
        betaStatus = JSON.parse(storedBetaStatus);
      }

      // Determine if user is a beta tester
      const isBeta = betaStatus || checkBetaTesterStatus();
      setIsBetaTesterState(isBeta);

      // Merge flags: defaults -> beta overrides (if beta) -> saved preferences -> initial props
      const mergedFlags = {
        ...defaultFlags,
        ...(isBeta ? betaTesterFlags : {}),
        ...savedFlags,
        ...initialFlags,
      };

      setFlags(mergedFlags);
    } catch (error) {
      console.warn('Failed to load feature flags from localStorage:', error);
      setFlags({ ...defaultFlags, ...initialFlags });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount; initialFlags is intentionally excluded to prevent infinite loops

  // Save flags to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('ai-village-feature-flags', JSON.stringify(flags));
    } catch (error) {
      console.warn('Failed to save feature flags to localStorage:', error);
    }
  }, [flags]);

  // Save beta tester status
  useEffect(() => {
    try {
      localStorage.setItem('ai-village-beta-tester', JSON.stringify(isBetaTester));
    } catch (error) {
      console.warn('Failed to save beta tester status:', error);
    }
  }, [isBetaTester]);

  const checkBetaTesterStatus = (): boolean => {
    // Check if user has completed beta onboarding
    try {
      const onboardingState = localStorage.getItem('ai-village-monitor-onboarding');
      if (onboardingState) {
        const parsed = JSON.parse(onboardingState);
        return parsed.hasCompletedBetaWelcome || false;
      }
    } catch (error) {
      console.warn('Failed to check beta tester status:', error);
    }

    // Check URL parameters for beta access
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('beta') === 'true' || urlParams.get('beta-tester') === 'true';
    }

    return false;
  };

  const isFeatureEnabled = (flag: keyof FeatureFlags): boolean => {
    return flags[flag];
  };

  const enableFeature = (flag: keyof FeatureFlags): void => {
    setFlags((prev) => ({ ...prev, [flag]: true }));

    // Analytics tracking
    trackFeatureToggle(flag, true);
  };

  const disableFeature = (flag: keyof FeatureFlags): void => {
    setFlags((prev) => ({ ...prev, [flag]: false }));

    // Analytics tracking
    trackFeatureToggle(flag, false);
  };

  const resetToDefaults = (): void => {
    const resetFlags = isBetaTester ? { ...defaultFlags, ...betaTesterFlags } : defaultFlags;

    setFlags(resetFlags);

    try {
      localStorage.removeItem('ai-village-feature-flags');
    } catch (error) {
      console.warn('Failed to clear feature flags from localStorage:', error);
    }
  };

  const setBetaTester = (isBeta: boolean): void => {
    setIsBetaTesterState(isBeta);

    if (isBeta) {
      // Enable beta features
      setFlags((prev) => ({ ...prev, ...betaTesterFlags }));
    } else {
      // Reset to non-beta defaults
      setFlags(defaultFlags);
    }
  };

  const trackFeatureToggle = (flag: keyof FeatureFlags, enabled: boolean): void => {
    try {
      // Use existing analytics system if available
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'feature_toggle', {
          feature_name: flag,
          enabled: enabled,
          is_beta_tester: isBetaTester,
        });
      }

      console.info(`[Feature Flags] ${flag} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.warn('Feature flag analytics tracking failed:', error);
    }
  };

  const contextValue: FeatureFlagContextType = {
    flags,
    isFeatureEnabled,
    enableFeature,
    disableFeature,
    resetToDefaults,
    isBetaTester,
    setBetaTester,
  };

  return <FeatureFlagContext.Provider value={contextValue}>{children}</FeatureFlagContext.Provider>;
}

// Hook to use feature flags
export function useFeatureFlags(): FeatureFlagContextType {
  const context = useContext(FeatureFlagContext);
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
}

// Utility hook for individual feature checks
export function useFeature(flag: keyof FeatureFlags): boolean {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled(flag);
}

// Higher-order component for feature gating
export function withFeatureFlag<P extends object>(
  flag: keyof FeatureFlags,
  fallbackComponent?: React.ComponentType<P>,
) {
  return function FeatureGatedComponent(Component: React.ComponentType<P>) {
    return function WrappedComponent(props: P) {
      const isEnabled = useFeature(flag);

      if (!isEnabled) {
        return fallbackComponent ? React.createElement(fallbackComponent, props) : null;
      }

      return React.createElement(Component, props);
    };
  };
}

// Feature flag debugging component (only for beta testers)
export function FeatureFlagDebugPanel() {
  const { flags, enableFeature, disableFeature, resetToDefaults, isBetaTester } = useFeatureFlags();

  if (!isBetaTester) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 10,
        right: 10,
        width: 300,
        background: '#1f2937',
        border: '1px solid #374151',
        borderRadius: 8,
        padding: 16,
        color: '#e5e7eb',
        fontSize: 12,
        zIndex: 9999,
        maxHeight: '80vh',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <strong>🧪 Feature Flags (Beta)</strong>
        <button
          onClick={resetToDefaults}
          style={{
            padding: '4px 8px',
            background: '#ef4444',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 10,
          }}
        >
          Reset
        </button>
      </div>

      {Object.entries(flags).map(([key, value]) => (
        <div
          key={key}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 11 }}>{key}</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => {
                if (e.target.checked) {
                  enableFeature(key as keyof FeatureFlags);
                } else {
                  disableFeature(key as keyof FeatureFlags);
                }
              }}
              style={{ width: 14, height: 14 }}
            />
          </label>
        </div>
      ))}
    </div>
  );
}
