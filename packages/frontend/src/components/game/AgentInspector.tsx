import React from 'react';

export interface Agent {
  id: string;
  name: string;
  state: string;
  metrics: Record<string, number>;
  events: Array<{ timestamp: number; message: string }>;
}

export interface AgentInspectorProps {
  agent: Agent;
  onAction?: (action: string) => void;
}

/**
 * AgentInspector - Display detailed agent information
 *
 * Features:
 * - Agent name and current state
 * - Performance metrics
 * - Event history
 * - Action buttons
 */
export function AgentInspector({ agent, onAction }: AgentInspectorProps) {
  const handleAction = (action: string) => {
    if (onAction) {
      onAction(action);
    }
  };

  return (
    <div style={styles.container}>
      {/* Agent Header */}
      <div style={styles.header}>
        <div style={styles.avatar}>{agent.name.charAt(0).toUpperCase()}</div>
        <div style={styles.headerInfo}>
          <h3 style={styles.name}>{agent.name}</h3>
          <span style={styles.state}>{agent.state}</span>
        </div>
      </div>

      {/* Metrics */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Metrics</h4>
        <div style={styles.metricsGrid}>
          {Object.entries(agent.metrics).map(([key, value]) => (
            <div key={key} style={styles.metric}>
              <span style={styles.metricLabel}>{formatMetricName(key)}</span>
              <span style={styles.metricValue}>{formatMetricValue(value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Event History */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Recent Events</h4>
        <div style={styles.eventList}>
          {agent.events.slice(0, 5).map((event, index) => (
            <div key={index} style={styles.event}>
              <span style={styles.eventTime}>{formatTimestamp(event.timestamp)}</span>
              <span style={styles.eventMessage}>{event.message}</span>
            </div>
          ))}
          {agent.events.length === 0 && (
            <div style={styles.noEvents}>No recent events</div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={styles.actions}>
        <button style={styles.actionButton} onClick={() => handleAction('follow')}>
          Follow
        </button>
        <button style={styles.actionButton} onClick={() => handleAction('inspect')}>
          Details
        </button>
        <button style={styles.actionButton} onClick={() => handleAction('reset')}>
          Reset
        </button>
      </div>
    </div>
  );
}

function formatMetricName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatMetricValue(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  } else if (value % 1 !== 0) {
    return value.toFixed(2);
  }
  return value.toString();
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    color: '#ffffff',
    fontFamily: 'monospace',
    fontSize: 12,
    minWidth: 300,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '1px solid rgba(96, 165, 250, 0.3)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'rgba(96, 165, 250, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    margin: 0,
    fontSize: 16,
    fontWeight: 'bold',
  },
  state: {
    fontSize: 12,
    color: '#94a3b8',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    margin: '0 0 8px 0',
    fontSize: 14,
    color: '#60a5fa',
    fontWeight: 'bold',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  metric: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: 8,
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  eventList: {
    maxHeight: 150,
    overflowY: 'auto' as const,
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 4,
    padding: 8,
  },
  event: {
    display: 'flex',
    flexDirection: 'column' as const,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  eventTime: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 2,
  },
  eventMessage: {
    fontSize: 12,
    color: '#ffffff',
  },
  noEvents: {
    textAlign: 'center' as const,
    color: '#94a3b8',
    padding: 16,
  },
  actions: {
    display: 'flex',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    padding: '8px 12px',
    background: 'rgba(96, 165, 250, 0.8)',
    border: 'none',
    borderRadius: 4,
    color: '#ffffff',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 12,
  },
};
