import { useEffect, useRef, useState } from 'react';
import { eventBus } from '../../realtime/EventBus';
import { csrfFetch } from '../../api/csrf';

interface RunnerSession {
  sessionId: string;
  agentId: string;
  villageId: string;
  providerId: 'codex' | 'claude_code';
  repoPath: string;
  status: 'running' | 'stopped';
}

interface WorkStreamEvent {
  id?: string;
  agentId: string;
  sessionId?: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export function RunnerSessionPanel() {
  const [session, setSession] = useState<RunnerSession | null>(null);
  const [villageId, setVillageId] = useState('demo');
  const [providerId, setProviderId] = useState<'codex' | 'claude_code'>('codex');
  const [repoPath, setRepoPath] = useState('');
  const [checkoutRef, setCheckoutRef] = useState('main');
  const [roomPath, setRoomPath] = useState('');
  const [agentName, setAgentName] = useState('');
  const [taskTitle, setTaskTitle] = useState('Smoke');
  const [taskGoal, setTaskGoal] = useState(
    'Run a quick sanity command and describe the repo at a high level.',
  );
  const [output, setOutput] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isSendingInput, setIsSendingInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  // Subscribe to work_stream_event for live output
  useEffect(() => {
    const handleWorkStreamEvent = (event: WorkStreamEvent) => {
      // Filter events for our session
      if (session && event.sessionId === session.sessionId) {
        const timestamp = new Date(event.timestamp).toLocaleTimeString();
        const payloadStr = JSON.stringify(event.payload, null, 2);
        setOutput((prev) => [...prev, `[${timestamp}] ${event.type}: ${payloadStr}`]);
      }
    };

    eventBus.on('work_stream_event', handleWorkStreamEvent);
    return () => {
      eventBus.off('work_stream_event', handleWorkStreamEvent);
    };
  }, [session]);

  const startSession = async () => {
    setIsStarting(true);
    setError(null);
    setOutput([]);

    try {
      const trimmedRepoPath = repoPath.trim();
      const trimmedVillageId = villageId.trim() || 'demo';
      const trimmedCheckoutRef = checkoutRef.trim() || 'main';
      const trimmedRoomPath = roomPath.trim();
      const trimmedAgentName = agentName.trim();
      const trimmedTaskTitle = taskTitle.trim();
      const trimmedTaskGoal = taskGoal.trim();

      if (!trimmedRepoPath) {
        throw new Error('Repo path is required (local checkout path on the server host).');
      }
      if (!trimmedTaskTitle) {
        throw new Error('Task title is required.');
      }
      if (!trimmedTaskGoal) {
        throw new Error('Task goal is required.');
      }

      const response = await csrfFetch('/api/runner/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          villageId: trimmedVillageId,
          agentName: trimmedAgentName || undefined,
          providerId,
          repoRef: { provider: 'local', path: trimmedRepoPath },
          checkout: { type: 'branch', ref: trimmedCheckoutRef },
          roomPath: trimmedRoomPath || undefined,
          task: {
            title: trimmedTaskTitle,
            goal: trimmedTaskGoal,
            constraints: [],
            acceptance: [],
            roomPath: trimmedRoomPath || undefined,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to start session: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      setSession({
        sessionId: data.sessionId,
        agentId: data.agentId,
        villageId: trimmedVillageId,
        providerId,
        repoPath: trimmedRepoPath,
        status: 'running',
      });
      setOutput((prev) => [
        ...prev,
        `Session started: ${data.sessionId} (agentId=${data.agentId})`,
        'Listening for work_stream_event updates...',
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setOutput((prev) => [...prev, `ERROR: ${message}`]);
    } finally {
      setIsStarting(false);
    }
  };

  const stopSession = async () => {
    if (!session) return;

    setIsStopping(true);
    setError(null);

    try {
      const response = await csrfFetch(`/api/runner/sessions/${session.sessionId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ graceful: true }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to stop session: ${response.status} ${errorText}`);
      }

      setOutput((prev) => [...prev, `Session stopped: ${session.sessionId}`]);
      setSession((prev) => (prev ? { ...prev, status: 'stopped' } : null));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setOutput((prev) => [...prev, `ERROR stopping session: ${message}`]);
    } finally {
      setIsStopping(false);
    }
  };

  const sendInput = async () => {
    if (!session || !inputText.trim()) return;

    setIsSendingInput(true);
    setError(null);

    try {
      const response = await csrfFetch(`/api/runner/sessions/${session.sessionId}/input`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: inputText }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send input: ${response.status} ${errorText}`);
      }

      setOutput((prev) => [...prev, `> ${inputText}`]);
      setInputText('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setOutput((prev) => [...prev, `ERROR sending input: ${message}`]);
    } finally {
      setIsSendingInput(false);
    }
  };

  const clearOutput = () => {
    setOutput([]);
    setError(null);
  };

  const clearSession = () => {
    setSession(null);
    setOutput([]);
    setError(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '500px',
        maxHeight: '600px',
        backgroundColor: '#1e293b',
        border: '2px solid #fbbf24',
        borderRadius: '8px',
        padding: '16px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#e2e8f0',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '8px',
          borderBottom: '1px solid #fbbf24',
        }}
      >
        <h3 style={{ margin: 0, color: '#fbbf24', fontSize: '14px' }}>
          Runner Session Panel (DEV)
        </h3>
        <div style={{ fontSize: '11px', color: '#94a3b8' }}>VITE_DEV_RUNNER_PANEL</div>
      </div>

      {/* Error display */}
      {error && (
        <div
          style={{
            backgroundColor: '#7f1d1d',
            color: '#fca5a5',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          {error}
        </div>
      )}

      {/* Session info */}
      {session && (
        <div
          style={{
            backgroundColor: '#0f172a',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        >
          <div>Session ID: {session.sessionId}</div>
          <div>Agent ID: {session.agentId}</div>
          <div>Village: {session.villageId}</div>
          <div>Provider: {session.providerId}</div>
          <div>Repo: {session.repoPath}</div>
          <div>
            Status:{' '}
            <span
              style={{
                color: session.status === 'running' ? '#4ade80' : '#94a3b8',
              }}
            >
              {session.status}
            </span>
          </div>
        </div>
      )}

      {/* Controls */}
      {!session ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px' }}>
            Village ID:
            <input
              type="text"
              value={villageId}
              onChange={(e) => setVillageId(e.target.value)}
              style={{
                width: '100%',
                padding: '6px',
                marginTop: '4px',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}
            />
          </label>
          <label style={{ fontSize: '12px' }}>
            Provider:
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value as RunnerSession['providerId'])}
              style={{
                width: '100%',
                padding: '6px',
                marginTop: '4px',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}
            >
              <option value="codex">codex</option>
              <option value="claude_code">claude_code</option>
            </select>
          </label>
          <label style={{ fontSize: '12px' }}>
            Repo path (local):
            <input
              type="text"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="/absolute/path/to/a/git/repo"
              style={{
                width: '100%',
                padding: '6px',
                marginTop: '4px',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}
            />
          </label>
          <label style={{ fontSize: '12px' }}>
            Checkout branch:
            <input
              type="text"
              value={checkoutRef}
              onChange={(e) => setCheckoutRef(e.target.value)}
              style={{
                width: '100%',
                padding: '6px',
                marginTop: '4px',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}
            />
          </label>
          <label style={{ fontSize: '12px' }}>
            Room path (optional):
            <input
              type="text"
              value={roomPath}
              onChange={(e) => setRoomPath(e.target.value)}
              placeholder="packages/server"
              style={{
                width: '100%',
                padding: '6px',
                marginTop: '4px',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}
            />
          </label>
          <label style={{ fontSize: '12px' }}>
            Agent name (optional):
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="dev-smoke"
              style={{
                width: '100%',
                padding: '6px',
                marginTop: '4px',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}
            />
          </label>
          <label style={{ fontSize: '12px' }}>
            Task title:
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '6px',
                marginTop: '4px',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: '4px',
                fontFamily: 'monospace',
              }}
            />
          </label>
          <label style={{ fontSize: '12px' }}>
            Task goal:
            <textarea
              value={taskGoal}
              onChange={(e) => setTaskGoal(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '6px',
                marginTop: '4px',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #475569',
                borderRadius: '4px',
                fontFamily: 'monospace',
                resize: 'vertical',
              }}
            />
          </label>
          <button
            onClick={startSession}
            disabled={isStarting || !repoPath.trim() || !taskTitle.trim() || !taskGoal.trim()}
            style={{
              padding: '8px 12px',
              backgroundColor: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor:
                isStarting || !repoPath.trim() || !taskTitle.trim() || !taskGoal.trim()
                  ? 'not-allowed'
                  : 'pointer',
              opacity:
                isStarting || !repoPath.trim() || !taskTitle.trim() || !taskGoal.trim() ? 0.6 : 1,
            }}
          >
            {isStarting ? 'Starting...' : 'Start Session'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={stopSession}
            disabled={isStopping || session.status === 'stopped'}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isStopping || session.status === 'stopped' ? 'not-allowed' : 'pointer',
              opacity: isStopping || session.status === 'stopped' ? 0.6 : 1,
            }}
          >
            {isStopping ? 'Stopping...' : 'Stop Session'}
          </button>
          <button
            onClick={clearSession}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: '#6b7280',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Clear Session
          </button>
        </div>
      )}

      {/* Output area */}
      <div
        style={{
          flex: 1,
          backgroundColor: '#0f172a',
          border: '1px solid #475569',
          borderRadius: '4px',
          padding: '8px',
          overflowY: 'auto',
          minHeight: '200px',
          maxHeight: '300px',
          fontFamily: 'monospace',
          fontSize: '11px',
          lineHeight: '1.5',
        }}
      >
        {output.length === 0 ? (
          <div style={{ color: '#64748b', fontStyle: 'italic' }}>
            No output yet. Start a session to see live events.
          </div>
        ) : (
          <>
            {output.map((line, index) => (
              <div key={index} style={{ marginBottom: '4px' }}>
                {line}
              </div>
            ))}
            <div ref={outputEndRef} />
          </>
        )}
      </div>

      {/* Clear output button */}
      {output.length > 0 && (
        <button
          onClick={clearOutput}
          style={{
            padding: '6px 10px',
            backgroundColor: '#475569',
            color: '#e2e8f0',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          Clear Output
        </button>
      )}

      {/* Input area (only when session is running) */}
      {session && session.status === 'running' && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendInput();
              }
            }}
            placeholder="Send input to session..."
            style={{
              flex: 1,
              padding: '6px',
              backgroundColor: '#0f172a',
              color: '#e2e8f0',
              border: '1px solid #475569',
              borderRadius: '4px',
              fontFamily: 'monospace',
            }}
          />
          <button
            onClick={sendInput}
            disabled={isSendingInput || !inputText.trim()}
            style={{
              padding: '6px 12px',
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isSendingInput || !inputText.trim() ? 'not-allowed' : 'pointer',
              opacity: isSendingInput || !inputText.trim() ? 0.6 : 1,
            }}
          >
            {isSendingInput ? 'Sending...' : 'Send'}
          </button>
        </div>
      )}

      {/* Footer info */}
      <div
        style={{
          fontSize: '10px',
          color: '#64748b',
          paddingTop: '8px',
          borderTop: '1px solid #334155',
        }}
      >
        Dev-only panel for testing runner sessions. Uses work_stream_event feed.
      </div>
    </div>
  );
}
