import { useEffect, useState } from 'react';
import { queueAwarePost } from '../utils/queueFetch';
import { useParams } from 'react-router-dom';
import { useViewerRole } from '../hooks/useViewerRole';
import { eventBus } from '../realtime/EventBus';
import { track } from '../analytics/client';
import { useToast } from './Toast';
import { RolePill } from './RolePill';

export function ControlTab({ agentId }: { agentId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [ref, setRef] = useState('main');
  const [workflows, setWorkflows] = useState<Array<{ id: string; name: string; path: string }>>([]);
  const [wfLoading, setWfLoading] = useState(false);
  const [selectedWf, setSelectedWf] = useState<string>('');
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

  // Load workflows when owner/repo are populated
  useEffect(() => {
    const o = owner.trim();
    const r = repo.trim();
    if (!o || !r) return;
    let abort = false;
    (async () => {
      setWfLoading(true);
      try {
        const res = await fetch(
          `/api/github/workflows?owner=${encodeURIComponent(o)}&repo=${encodeURIComponent(r)}`,
          {
            credentials: 'include',
          },
        );
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        if (abort) return;
        const items = (j?.items || []) as Array<{ id: string; name: string; path: string }>;
        setWorkflows(items);
        if (items.length && !selectedWf) setSelectedWf(items[0].path || items[0].id);
      } catch (e: any) {
        showError(`Failed to load workflows (${e?.message || 'error'})`);
        setWorkflows([]);
      } finally {
        setWfLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo]);

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
        {/* GitHub Actions: list & dispatch */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            style={inpStyle}
            aria-label="GitHub owner"
          />
          <input
            placeholder="repo"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            style={inpStyle}
            aria-label="GitHub repo"
          />
          <select
            value={selectedWf}
            onChange={(e) => setSelectedWf(e.target.value)}
            disabled={!workflows.length || wfLoading || !canControl || !!busy}
            style={selStyle}
            aria-label="Workflow"
          >
            {wfLoading && <option>Loading…</option>}
            {!wfLoading && workflows.length === 0 && <option>— no workflows —</option>}
            {workflows.map((w) => (
              <option key={w.id} value={w.path || w.id}>
                {w.name || w.path}
              </option>
            ))}
          </select>
          <input
            placeholder="ref (main)"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            style={inpStyle}
            aria-label="Ref"
          />
          <button
            style={btnStyle}
            disabled={!!busy || !canControl || !owner.trim() || !repo.trim() || !selectedWf}
            onClick={() =>
              confirmAndPost(
                {
                  command: 'workflow_dispatch',
                  owner: owner.trim(),
                  repo: repo.trim(),
                  workflow: selectedWf,
                  ref: ref.trim() || 'main',
                },
                `Dispatch workflow ${selectedWf} on ${owner.trim()}/${repo.trim()}@${ref || 'main'}?`,
              )
            }
            title={canControl ? undefined : 'Owner role required'}
          >
            {busy === 'workflow_dispatch' ? 'Dispatching…' : 'Run Workflow'}
          </button>
        </div>
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

const inpStyle: React.CSSProperties = {
  padding: '8px 10px',
  background: '#0b1220',
  color: '#e5e7eb',
  border: '1px solid #334155',
  borderRadius: 6,
};

const selStyle: React.CSSProperties = {
  padding: '8px 10px',
  background: '#0b1220',
  color: '#e5e7eb',
  border: '1px solid #334155',
  borderRadius: 6,
};
