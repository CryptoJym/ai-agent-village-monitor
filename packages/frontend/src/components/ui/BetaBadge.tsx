import React from 'react';
import { useFeatureFlags } from '../../contexts/FeatureFlags';

interface BetaBadgeProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inline';
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'gradient' | 'minimal';
  showLabel?: boolean;
  onClick?: () => void;
}

export function BetaBadge({
  position = 'top-right',
  size = 'medium',
  variant = 'gradient',
  showLabel = true,
  onClick,
}: BetaBadgeProps) {
  const { isBetaTester } = useFeatureFlags();

  // Don't render if user is not a beta tester
  if (!isBetaTester) return null;

  const sizeStyles = {
    small: {
      padding: '4px 8px',
      fontSize: '10px',
      borderRadius: '8px',
    },
    medium: {
      padding: '6px 12px',
      fontSize: '12px',
      borderRadius: '10px',
    },
    large: {
      padding: '8px 16px',
      fontSize: '14px',
      borderRadius: '12px',
    },
  };

  const variantStyles = {
    primary: {
      background: '#3b82f6',
      color: '#ffffff',
      border: '1px solid #2563eb',
    },
    gradient: {
      background: 'linear-gradient(45deg, #3b82f6, #8b5cf6)',
      color: '#ffffff',
      border: 'none',
    },
    minimal: {
      background: 'rgba(59, 130, 246, 0.1)',
      color: '#60a5fa',
      border: '1px solid rgba(59, 130, 246, 0.3)',
    },
  };

  const positionStyles = {
    'top-left': {
      position: 'fixed' as const,
      top: '16px',
      left: '16px',
      zIndex: 1000,
    },
    'top-right': {
      position: 'fixed' as const,
      top: '16px',
      right: '16px',
      zIndex: 1000,
    },
    'bottom-left': {
      position: 'fixed' as const,
      bottom: '16px',
      left: '16px',
      zIndex: 1000,
    },
    'bottom-right': {
      position: 'fixed' as const,
      bottom: '16px',
      right: '16px',
      zIndex: 1000,
    },
    inline: {
      position: 'relative' as const,
      display: 'inline-block',
    },
  };

  const badgeStyles: React.CSSProperties = {
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...positionStyles[position],
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.3s ease',
    boxShadow: variant === 'gradient' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
    userSelect: 'none' as const,
    fontFamily: 'system-ui, sans-serif',
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick) {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = variant === 'gradient' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none';
    }
  };

  return (
    <div
      style={badgeStyles}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role={onClick ? 'button' : 'img'}
      aria-label={showLabel ? 'Beta version indicator' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      } : undefined}
    >
      {showLabel ? 'Beta' : 'β'}
    </div>
  );
}

// Specialized version for header/navigation areas
export function HeaderBetaBadge() {
  return (
    <BetaBadge
      position="inline"
      size="small"
      variant="minimal"
      showLabel={true}
    />
  );
}

// Floating beta badge with feedback action
export function FloatingBetaBadge({ onFeedbackClick }: { onFeedbackClick?: () => void }) {
  return (
    <BetaBadge
      position="bottom-right"
      size="medium"
      variant="gradient"
      showLabel={true}
      onClick={onFeedbackClick}
    />
  );
}