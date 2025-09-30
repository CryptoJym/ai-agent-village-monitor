import React, { useState, useEffect, useRef } from 'react';

interface VillageTourProps {
  onComplete: () => void;
  onSkip: () => void;
  isVisible: boolean;
}

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  position: { x: number; y: number };
  highlightArea?: { x: number; y: number; width: number; height: number };
}

export function VillageTour({ onComplete, onSkip, isVisible }: VillageTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const tourSteps: TourStep[] = [
    {
      id: 'village-overview',
      title: 'Your Village Overview',
      description: 'This is your AI Agent Village! Each house represents a repository in your GitHub organization. The village layout shows the relationships and activity patterns.',
      icon: '🏘️',
      position: { x: 50, y: 20 },
    },
    {
      id: 'repository-houses',
      title: 'Repository Houses',
      description: 'Houses represent individual repositories. The size, color, and activity indicators show repo health, recent commits, and AI agent activity.',
      icon: '🏠',
      position: { x: 30, y: 40 },
      highlightArea: { x: 20, y: 30, width: 200, height: 150 },
    },
    {
      id: 'ai-agents',
      title: 'AI Agents at Work',
      description: 'Watch AI agents move between houses as they work on different repositories. Agent paths show workflow dependencies and collaboration patterns.',
      icon: '🤖',
      position: { x: 70, y: 35 },
    },
    {
      id: 'activity-indicators',
      title: 'Real-time Activity',
      description: 'Live indicators show current development activity: commits, pull requests, CI/CD runs, and agent operations happening right now.',
      icon: '⚡',
      position: { x: 15, y: 65 },
    },
    {
      id: 'navigation-controls',
      title: 'Navigation & Controls',
      description: 'Use mouse/touch to pan and zoom. The control panel provides quick access to filters, settings, and detailed views.',
      icon: '🎮',
      position: { x: 85, y: 75 },
    },
    {
      id: 'dialogue-system',
      title: 'Interactive Dialogue',
      description: 'Click on houses, agents, or areas to get detailed information and interact with your development environment.',
      icon: '💬',
      position: { x: 50, y: 80 },
    },
  ];

  useEffect(() => {
    if (isVisible && tooltipRef.current) {
      // Focus management for accessibility
      tooltipRef.current.focus();
    }
  }, [currentStep, isVisible]);

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (stepIndex: number) => {
    setCurrentStep(stepIndex);
  };

  const startAutoTour = () => {
    setIsPlaying(true);
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= tourSteps.length - 1) {
          clearInterval(interval);
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 3000);
  };

  if (!isVisible) return null;

  const currentTourStep = tourSteps[currentStep];

  const overlayStyles: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(2, 8, 23, 0.7)',
    zIndex: 1500,
    pointerEvents: 'auto',
  };

  const tooltipStyles: React.CSSProperties = {
    position: 'fixed',
    left: `${currentTourStep.position.x}%`,
    top: `${currentTourStep.position.y}%`,
    transform: 'translate(-50%, -50%)',
    width: 'min(350px, 90vw)',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    border: '1px solid #334155',
    borderRadius: 16,
    padding: 24,
    color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
    zIndex: 1600,
  };

  const highlightStyles: React.CSSProperties = currentTourStep.highlightArea ? {
    position: 'fixed',
    left: `${currentTourStep.highlightArea.x}%`,
    top: `${currentTourStep.highlightArea.y}%`,
    width: `${currentTourStep.highlightArea.width}px`,
    height: `${currentTourStep.highlightArea.height}px`,
    border: '3px solid #60a5fa',
    borderRadius: 12,
    background: 'rgba(96, 165, 250, 0.1)',
    animation: 'pulse 2s infinite',
    zIndex: 1550,
  } : {};

  return (
    <>
      <div style={overlayStyles} onClick={(e) => e.target === e.currentTarget && onSkip()} />

      {currentTourStep.highlightArea && (
        <div style={highlightStyles} />
      )}

      <div
        ref={tooltipRef}
        style={tooltipStyles}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`tour-step-${currentStep}-title`}
        tabIndex={-1}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 24, marginRight: 12 }}>{currentTourStep.icon}</span>
          <h3 id={`tour-step-${currentStep}-title`} style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            {currentTourStep.title}
          </h3>
        </div>

        <p style={{ margin: '0 0 20px 0', color: '#cbd5e1', lineHeight: 1.6 }}>
          {currentTourStep.description}
        </p>

        {/* Progress indicator */}
        <div style={{
          display: 'flex',
          gap: 4,
          marginBottom: 20,
          justifyContent: 'center',
        }}>
          {tourSteps.map((_, index) => (
            <button
              key={index}
              onClick={() => goToStep(index)}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                border: 'none',
                background: index === currentStep ? '#60a5fa' : '#374151',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>

        {/* Tour controls */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            style={{
              padding: '8px 16px',
              background: currentStep === 0 ? '#1e293b' : '#374151',
              color: currentStep === 0 ? '#64748b' : '#e2e8f0',
              border: '1px solid #4b5563',
              borderRadius: 8,
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              fontSize: 14,
            }}
          >
            Previous
          </button>

          <button
            onClick={startAutoTour}
            disabled={isPlaying}
            style={{
              padding: '8px 16px',
              background: isPlaying ? '#1e293b' : '#0f172a',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: 8,
              cursor: isPlaying ? 'not-allowed' : 'pointer',
              fontSize: 14,
            }}
          >
            {isPlaying ? 'Auto-touring...' : 'Auto Tour'}
          </button>

          <button
            onClick={nextStep}
            style={{
              padding: '8px 16px',
              background: currentStep === tourSteps.length - 1 ? '#059669' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {currentStep === tourSteps.length - 1 ? 'Complete Tour' : 'Next'}
          </button>
        </div>

        {/* Quick actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: '#64748b',
        }}>
          <span>Step {currentStep + 1} of {tourSteps.length}</span>
          <button
            onClick={onSkip}
            style={{
              background: 'transparent',
              color: '#64748b',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              textDecoration: 'underline',
            }}
          >
            Skip Tour
          </button>
        </div>

        {/* Beta feedback prompt */}
        {currentStep === tourSteps.length - 1 && (
          <div style={{
            marginTop: 16,
            padding: 12,
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: 8,
            fontSize: 12,
            color: '#cbd5e1',
            textAlign: 'center',
          }}>
            🎯 <strong>Beta Tester Mission:</strong> Try interacting with different village elements and share your experience!
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
      `}</style>
    </>
  );
}