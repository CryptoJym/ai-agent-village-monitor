import React, { useState } from 'react';

interface BetaWelcomeProps {
  onContinue: () => void;
  onSkip: () => void;
}

export function BetaWelcome({ onContinue, onSkip }: BetaWelcomeProps) {
  const [showDetails, setShowDetails] = useState(false);

  const containerStyles: React.CSSProperties = {
    width: 'min(800px, 96vw)',
    background: 'linear-gradient(135deg, #0b1220 0%, #1e293b 100%)',
    border: '1px solid #1f2a3a',
    borderRadius: 16,
    padding: 'clamp(24px, 3vw, 48px)',
    color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
    maxHeight: '90vh',
    overflowY: 'auto',
    position: 'relative',
  };

  const betaBadgeStyles: React.CSSProperties = {
    position: 'absolute',
    top: 16,
    right: 16,
    background: 'linear-gradient(45deg, #3b82f6, #8b5cf6)',
    color: '#fff',
    padding: '4px 12px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  };

  const headerStyles: React.CSSProperties = {
    textAlign: 'center' as const,
    marginBottom: 32,
  };

  const titleStyles: React.CSSProperties = {
    fontSize: 'clamp(2rem, 4vw, 3rem)',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    margin: '0 0 8px 0',
  };

  const subtitleStyles: React.CSSProperties = {
    fontSize: 'clamp(1.1rem, 2vw, 1.3rem)',
    color: '#94a3b8',
    margin: 0,
  };

  const featureGridStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: 20,
    margin: '24px 0',
  };

  const featureCardStyles: React.CSSProperties = {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: 20,
    transition: 'all 0.3s ease',
  };

  const featureIconStyles: React.CSSProperties = {
    fontSize: 24,
    marginBottom: 8,
    display: 'block',
  };

  const buttonPrimaryStyles: React.CSSProperties = {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    fontSize: 16,
    fontWeight: 600,
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
  };

  const buttonSecondaryStyles: React.CSSProperties = {
    padding: '12px 24px',
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid #374151',
    borderRadius: 12,
    cursor: 'pointer',
    fontSize: 16,
    transition: 'all 0.3s ease',
  };

  const features = [
    {
      icon: '🏘️',
      title: 'AI Agent Villages',
      description:
        'Visualize your GitHub organizations as interactive villages where each repository becomes a house.',
    },
    {
      icon: '🤖',
      title: 'Agent Monitoring',
      description:
        'Track AI agents working across your codebase with real-time activity monitoring.',
    },
    {
      icon: '📊',
      title: 'Workflow Insights',
      description: 'Gain insights into development patterns, collaboration, and project health.',
    },
    {
      icon: '🔄',
      title: 'Real-time Sync',
      description:
        'Stay up-to-date with live synchronization of repository changes and agent activities.',
    },
  ];

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
        aria-labelledby="beta-welcome-title"
      >
        <div style={betaBadgeStyles}>Beta</div>

        <div style={headerStyles}>
          <h1 id="beta-welcome-title" style={titleStyles}>
            Welcome to AI Agent Village Monitor
          </h1>
          <p style={subtitleStyles}>
            You&apos;re among the first to experience the future of development visualization
          </p>
        </div>

        <div style={{ textAlign: 'center' as const, marginBottom: 24 }}>
          <p style={{ fontSize: 18, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
            Transform how you monitor and understand AI agents working across your GitHub
            repositories. Our beta platform provides unprecedented visibility into automated
            development workflows.
          </p>
        </div>

        {showDetails && (
          <div style={featureGridStyles}>
            {features.map((feature, index) => (
              <div key={index} style={featureCardStyles}>
                <span style={featureIconStyles}>{feature.icon}</span>
                <h3 style={{ margin: '0 0 8px 0', color: '#e2e8f0', fontSize: 16 }}>
                  {feature.title}
                </h3>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, lineHeight: 1.5 }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            textAlign: 'center' as const,
            marginBottom: 24,
            padding: '16px 20px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: 12,
          }}
        >
          <h3 style={{ margin: '0 0 8px 0', color: '#60a5fa' }}>
            🎯 Your Mission as a Beta Tester
          </h3>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: 14 }}>
            Help us refine the experience by exploring features, providing feedback, and reporting
            any issues you encounter. Your insights will shape the future of AI development
            monitoring.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              ...buttonSecondaryStyles,
              padding: '8px 16px',
              fontSize: 14,
            }}
          >
            {showDetails ? 'Hide Details' : 'Show Key Features'}
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            flexWrap: 'wrap' as const,
          }}
        >
          <button
            onClick={onContinue}
            style={buttonPrimaryStyles}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
            }}
          >
            Start Beta Experience
          </button>
          <button
            onClick={onSkip}
            style={buttonSecondaryStyles}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#4b5563';
              e.currentTarget.style.color = '#d1d5db';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#374151';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            Skip Welcome
          </button>
        </div>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: 8,
            fontSize: 12,
            color: '#64748b',
            textAlign: 'center' as const,
          }}
        >
          💡 <strong>Tip:</strong> You can access the beta feedback form anytime from the user menu
          to share your thoughts and suggestions.
        </div>
      </div>
    </div>
  );
}
