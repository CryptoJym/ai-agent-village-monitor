import { useState } from 'react';
import { queueAwarePost } from '../utils/queueFetch';
import { useParams } from 'react-router-dom';
import { useViewerRole } from '../hooks/useViewerRole';
import { eventBus } from '../realtime/EventBus';
import { track } from '../analytics/client';
import { useToast } from './Toast';
import { RolePill } from './RolePill';

export function ControlTab({ agentId }: { agentId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  // Future advanced actions can add repo/workflow inputs
  const { showError, showSuccess } = useToast();
  const params = useParams();
  const villageId = params.id as string | undefined;
  const role = useViewerRole(villageId);
  const canControl = !villageId || role === 'owner';

  const post = async (body: any) => {
    setBusy(body?.command ?? 'action');
    try {
      await queueAwarePost(`/api/agents/${encodeURIComponent(agentId)}/command`, body);
      // optimistic feedback in thread
      eventBus.emit('work_stream', {
        agentId,
        message: `Command '${body?.command}' accepted`,
        ts: Date.now(),
      });
      showSuccess(`${pretty(body?.command)} accepted`);
      // track command execution on success
      const cmd = typeof body?.command === 'string' ? body.command : 'action';
      track({ type: 'command_executed', ts: Date.now(), agentId, command: cmd, villageId });
    } catch {
      eventBus.emit('work_stream', {
        agentId,
        message: `Command '${body?.command}' failed to send`,
        ts: Date.now(),
      });
      showError(`${pretty(body?.command)} failed`);
    } finally {
      setBusy(null);
    }
  };

  const confirmAndPost = async (body: any, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    await post(body);
  };

  function pretty(cmd: string | undefined) {
    if (!cmd) return 'Action';
    return cmd.replace('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <h3 style={{ margin: '8px 0', color: '#e2e8f0' }}>Controls</h3>
        {villageId && (
          <div>
            <RolePill role={role === 'none' ? 'public' : (role as any)} you={true} />
          </div>
        )}
      </div>
      <p style={{ color: '#94a3b8', marginBottom: 12 }}>Agent: {agentId}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          style={btnStyle}
          disabled={!!busy || !canControl}
          onClick={() => post({ command: 'run_tool', tool: 'echo', args: ['hello'] })}
          data-testid="btn-run-tool"
          title={canControl ? undefined : 'Owner role required'}
        >
          {busy === 'run_tool' ? 'Running…' : 'Run Tool'}
        </button>
        <button
          style={btnStyle}
          disabled={!!busy || !canControl}
          onClick={() =>
            confirmAndPost(
              { command: 'commit', message: 'chore: demo commit' },
              'Create a commit with message: "chore: demo commit"?',
            )
          }
          data-testid="btn-commit"
          title={canControl ? undefined : 'Owner role required'}
        >
          {busy === 'commit' ? 'Committing…' : 'Commit'}
        </button>
        <button
          style={btnStyle}
          disabled={!!busy || !canControl}
          onClick={() =>
            confirmAndPost(
              { command: 'pull_request', title: 'Demo PR', body: 'Automated change' },
              'Open a Pull Request titled: "Demo PR"?',
            )
          }
          data-testid="btn-pr"
          title={canControl ? undefined : 'Owner role required'}
        >
          {busy === 'pull_request' ? 'Opening PR…' : 'Create PR'}
        </button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '10px 14px',
  background: '#1f2937',
  color: '#e5e7eb',
  border: '1px solid #374151',
  borderRadius: 8,
  cursor: 'pointer',
};
