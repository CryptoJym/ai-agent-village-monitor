import React, { useState, useEffect } from 'react';
import { BetaWelcome } from './BetaWelcome';
import { VillageTour } from './VillageTour';
import { SetupWizard } from './SetupWizard';

interface BetaOnboardingProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (setupData?: any) => void;
}

type OnboardingStep = 'welcome' | 'setup' | 'tour' | 'complete';

interface UserState {
  isFirstTime: boolean;
  hasCompletedBetaWelcome: boolean;
  hasCompletedSetup: boolean;
  hasCompletedTour: boolean;
}

export function BetaOnboarding({ isOpen, onComplete }: BetaOnboardingProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [userState, setUserState] = useState<UserState>({
    isFirstTime: true,
    hasCompletedBetaWelcome: false,
    hasCompletedSetup: false,
    hasCompletedTour: false,
  });
  const [setupData, setSetupData] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadUserState();
    }
  }, [isOpen]);

  const loadUserState = () => {
    try {
      // Check localStorage for previous onboarding state
      const storedState = localStorage.getItem('ai-village-monitor-onboarding');
      if (storedState) {
        const parsed = JSON.parse(storedState);
        setUserState(parsed);

        // Determine starting step based on completed stages
        if (!parsed.hasCompletedBetaWelcome) {
          setCurrentStep('welcome');
        } else if (!parsed.hasCompletedSetup) {
          setCurrentStep('setup');
        } else if (!parsed.hasCompletedTour) {
          setCurrentStep('tour');
        } else {
          // All steps completed, might be a returning user
          setCurrentStep('tour'); // Allow them to retake the tour
        }
      } else {
        // Completely new user
        setCurrentStep('welcome');
      }
    } catch (error) {
      console.warn('Failed to load onboarding state:', error);
      setCurrentStep('welcome');
    }
  };

  const saveUserState = (updates: Partial<UserState>) => {
    const newState = { ...userState, ...updates };
    setUserState(newState);

    try {
      localStorage.setItem('ai-village-monitor-onboarding', JSON.stringify(newState));
    } catch (error) {
      console.warn('Failed to save onboarding state:', error);
    }
  };

  const handleWelcomeComplete = () => {
    saveUserState({ hasCompletedBetaWelcome: true });
    setCurrentStep('setup');
  };

  const handleWelcomeSkip = () => {
    saveUserState({ hasCompletedBetaWelcome: true });
    // Skip to tour for users who just want to explore
    setCurrentStep('tour');
  };

  const handleSetupComplete = (data: any) => {
    setSetupData(data);
    saveUserState({ hasCompletedSetup: true });
    setCurrentStep('tour');
  };

  const handleSetupBack = () => {
    setCurrentStep('welcome');
  };

  const handleTourComplete = () => {
    saveUserState({ hasCompletedTour: true });
    setCurrentStep('complete');

    // Complete the entire onboarding process
    onComplete(setupData);
  };

  const handleTourSkip = () => {
    // Allow users to skip the tour but still complete onboarding
    saveUserState({ hasCompletedTour: true });
    onComplete(setupData);
  };

  const isFirstTimeUser = () => {
    try {
      const storedState = localStorage.getItem('ai-village-monitor-onboarding');
      if (!storedState) return true;

      const parsed = JSON.parse(storedState);
      return !parsed.hasCompletedBetaWelcome;
    } catch {
      return true;
    }
  };

  // Track analytics for beta testing
  useEffect(() => {
    if (isOpen && currentStep) {
      try {
        // Send analytics event (if analytics is set up)
        const event = {
          type: 'beta_onboarding_step',
          step: currentStep,
          timestamp: new Date().toISOString(),
          isFirstTime: isFirstTimeUser(),
        };

        // Use existing analytics system if available
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'onboarding_step', {
            custom_parameter: currentStep,
            is_first_time: isFirstTimeUser(),
          });
        }

        console.info('[Beta Analytics] Onboarding step:', event);
      } catch (error) {
        console.warn('Analytics tracking failed:', error);
      }
    }
  }, [currentStep, isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {currentStep === 'welcome' && (
        <BetaWelcome onContinue={handleWelcomeComplete} onSkip={handleWelcomeSkip} />
      )}

      {currentStep === 'setup' && (
        <SetupWizard onComplete={handleSetupComplete} onBack={handleSetupBack} />
      )}

      {currentStep === 'tour' && (
        <VillageTour isVisible={true} onComplete={handleTourComplete} onSkip={handleTourSkip} />
      )}
    </>
  );
}

// Utility function to check if user should see beta onboarding
export function shouldShowBetaOnboarding(): boolean {
  try {
    const storedState = localStorage.getItem('ai-village-monitor-onboarding');
    if (!storedState) return true;

    const parsed = JSON.parse(storedState);

    // Show if they haven't completed the full flow
    return !parsed.hasCompletedBetaWelcome || !parsed.hasCompletedSetup;
  } catch {
    return true;
  }
}

// Utility function to reset onboarding state (for testing)
export function resetBetaOnboarding(): void {
  try {
    localStorage.removeItem('ai-village-monitor-onboarding');
    console.info('[Beta Onboarding] State reset successfully');
  } catch (error) {
    console.warn('[Beta Onboarding] Failed to reset state:', error);
  }
}

// Utility function to get onboarding completion status
export function getBetaOnboardingStatus(): UserState {
  try {
    const storedState = localStorage.getItem('ai-village-monitor-onboarding');
    if (!storedState) {
      return {
        isFirstTime: true,
        hasCompletedBetaWelcome: false,
        hasCompletedSetup: false,
        hasCompletedTour: false,
      };
    }

    return JSON.parse(storedState);
  } catch {
    return {
      isFirstTime: true,
      hasCompletedBetaWelcome: false,
      hasCompletedSetup: false,
      hasCompletedTour: false,
    };
  }
}
