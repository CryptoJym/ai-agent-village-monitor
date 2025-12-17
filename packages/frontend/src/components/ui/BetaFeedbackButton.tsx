import React, { useState } from 'react';
import { useFeatureFlags } from '../../contexts/FeatureFlags';
import { csrfFetch } from '../../api/csrf';

interface BetaFeedbackButtonProps {
  variant?: 'floating' | 'inline' | 'menu-item';
  size?: 'small' | 'medium' | 'large';
  onFeedbackSubmit?: (feedback: FeedbackData) => void;
}

interface FeedbackData {
  type: 'bug' | 'feature' | 'improvement' | 'general';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  feature?: string;
  reproductionSteps?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  browserInfo: string;
  userAgent: string;
  timestamp: string;
}

export function BetaFeedbackButton({
  variant = 'floating',
  size = 'medium',
  onFeedbackSubmit,
}: BetaFeedbackButtonProps) {
  const { isBetaTester } = useFeatureFlags();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Don't render if user is not a beta tester
  if (!isBetaTester) return null;

  const openFeedbackModal = () => {
    setIsModalOpen(true);
  };

  const closeFeedbackModal = () => {
    setIsModalOpen(false);
  };

  const renderButton = () => {
    const baseStyles: React.CSSProperties = {
      fontFamily: 'system-ui, sans-serif',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      border: 'none',
      userSelect: 'none',
    };

    const sizeStyles = {
      small: { padding: '6px 12px', fontSize: '12px' },
      medium: { padding: '10px 16px', fontSize: '14px' },
      large: { padding: '12px 20px', fontSize: '16px' },
    };

    const variantStyles = {
      floating: {
        position: 'fixed' as const,
        bottom: '20px',
        right: '20px',
        background: 'linear-gradient(135deg, #10b981, #059669)',
        color: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
        zIndex: 1000,
      },
      inline: {
        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        color: '#ffffff',
        borderRadius: '8px',
      },
      'menu-item': {
        background: 'transparent',
        color: '#10b981',
        border: '1px solid #10b981',
        borderRadius: '6px',
        width: '100%',
        textAlign: 'left' as const,
      },
    };

    const buttonStyles = {
      ...baseStyles,
      ...sizeStyles[size],
      ...variantStyles[variant],
    };

    return (
      <button
        style={buttonStyles}
        onClick={openFeedbackModal}
        onMouseEnter={(e) => {
          if (variant === 'floating') {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
          }
        }}
        onMouseLeave={(e) => {
          if (variant === 'floating') {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
          }
        }}
        aria-label="Submit beta feedback"
      >
        {variant === 'floating' ? '💬 Feedback' : '📝 Beta Feedback'}
      </button>
    );
  };

  return (
    <>
      {renderButton()}
      {isModalOpen && (
        <BetaFeedbackModal onClose={closeFeedbackModal} onSubmit={onFeedbackSubmit} />
      )}
    </>
  );
}

// Feedback Modal Component
interface BetaFeedbackModalProps {
  onClose: () => void;
  onSubmit?: (feedback: FeedbackData) => void;
}

function BetaFeedbackModal({ onClose, onSubmit }: BetaFeedbackModalProps) {
  const [formData, setFormData] = useState({
    type: 'general' as FeedbackData['type'],
    priority: 'medium' as FeedbackData['priority'],
    title: '',
    description: '',
    feature: '',
    reproductionSteps: '',
    expectedBehavior: '',
    actualBehavior: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const feedbackData: FeedbackData = {
      ...formData,
      browserInfo: getBrowserInfo(),
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    try {
      // Submit to feedback endpoint
      await submitFeedback(feedbackData);

      if (onSubmit) {
        onSubmit(feedbackData);
      }

      // Show success message
      alert('Thank you for your feedback! It has been submitted successfully.');
      onClose();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert('Failed to submit feedback. Please try again or contact support.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const modalStyles: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(2, 8, 23, 0.9)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 2000,
  };

  const contentStyles: React.CSSProperties = {
    width: 'min(600px, 95vw)',
    maxHeight: '90vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    border: '1px solid #334155',
    borderRadius: 16,
    padding: 24,
    color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
    overflowY: 'auto',
  };

  const fieldStyles: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: '#1e293b',
    color: '#e2e8f0',
    border: '1px solid #475569',
    borderRadius: 8,
    fontSize: 14,
  };

  return (
    <div style={modalStyles} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={contentStyles}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20, color: '#10b981' }}>🧪 Beta Feedback</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #475569',
              color: '#94a3b8',
              borderRadius: 6,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>
                Feedback Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => updateFormData('type', e.target.value)}
                style={fieldStyles}
                required
              >
                <option value="general">General Feedback</option>
                <option value="bug">Bug Report</option>
                <option value="feature">Feature Request</option>
                <option value="improvement">Improvement Suggestion</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => updateFormData('priority', e.target.value)}
                style={fieldStyles}
                required
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => updateFormData('title', e.target.value)}
              style={fieldStyles}
              placeholder="Brief summary of your feedback"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => updateFormData('description', e.target.value)}
              style={{ ...fieldStyles, minHeight: 100, resize: 'vertical' }}
              placeholder="Detailed description of your feedback"
              required
            />
          </div>

          {formData.type === 'bug' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>
                  Steps to Reproduce
                </label>
                <textarea
                  value={formData.reproductionSteps}
                  onChange={(e) => updateFormData('reproductionSteps', e.target.value)}
                  style={{ ...fieldStyles, minHeight: 80, resize: 'vertical' }}
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. Observe..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label
                    style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}
                  >
                    Expected Behavior
                  </label>
                  <textarea
                    value={formData.expectedBehavior}
                    onChange={(e) => updateFormData('expectedBehavior', e.target.value)}
                    style={{ ...fieldStyles, minHeight: 60, resize: 'vertical' }}
                    placeholder="What should happen?"
                  />
                </div>

                <div>
                  <label
                    style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}
                  >
                    Actual Behavior
                  </label>
                  <textarea
                    value={formData.actualBehavior}
                    onChange={(e) => updateFormData('actualBehavior', e.target.value)}
                    style={{ ...fieldStyles, minHeight: 60, resize: 'vertical' }}
                    placeholder="What actually happened?"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600 }}>
              Related Feature (Optional)
            </label>
            <input
              type="text"
              value={formData.feature}
              onChange={(e) => updateFormData('feature', e.target.value)}
              style={fieldStyles}
              placeholder="e.g., Village Navigation, Agent Monitoring, Setup Process"
            />
          </div>

          <div
            style={{
              padding: 12,
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: 8,
              fontSize: 12,
              color: '#a7f3d0',
            }}
          >
            💡 <strong>Tip:</strong> The more details you provide, the better we can address your
            feedback. Include screenshots if helpful!
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                color: '#94a3b8',
                border: '1px solid #475569',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '10px 20px',
                background: isSubmitting ? '#6b7280' : 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Utility functions
function getBrowserInfo(): string {
  const browser = navigator.userAgent;
  const platform = navigator.platform;
  const language = navigator.language;
  const viewport = `${window.innerWidth}x${window.innerHeight}`;

  return `${browser} | Platform: ${platform} | Language: ${language} | Viewport: ${viewport}`;
}

async function submitFeedback(feedback: FeedbackData): Promise<void> {
  try {
    const response = await csrfFetch('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(feedback),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Log successful submission
    console.info('[Beta Feedback] Submitted successfully:', {
      type: feedback.type,
      priority: feedback.priority,
      timestamp: feedback.timestamp,
    });
  } catch (error) {
    console.error('[Beta Feedback] Submission failed:', error);
    throw error;
  }
}
