import React, { useState } from 'react';
import { useToast } from './Toast';
import { getErrorMessage } from '../utils/errors';
import { csrfFetch } from '../api/csrf';

type Category = 'bug' | 'feature' | 'question' | 'other';

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showError, showSuccess } = useToast();
  const [category, setCategory] = useState<Category>('feature');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [nps, setNps] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [openedAt] = useState<number>(() => Date.now());

  // Draft persistence
  const draftKey = 'feedback.draft.v1';
  React.useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.category) setCategory(d.category);
        if (d.description) setDescription(d.description);
        if (d.email) setEmail(d.email);
        if (typeof d.nps === 'number') setNps(d.nps);
      }
    } catch (e) {
      void e;
    }
  }, [open]);
  React.useEffect(() => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ category, description, email, nps: nps === '' ? undefined : nps }),
      );
    } catch (e) {
      void e;
    }
  }, [category, description, email, nps]);

  // Show NPS after first week of usage
  const firstSeenKey = 'app.firstSeenAt';
  const showNps = React.useMemo(() => {
    try {
      let ts = Number(localStorage.getItem(firstSeenKey) || '');
      if (!ts) {
        ts = Date.now();
        localStorage.setItem(firstSeenKey, String(ts));
      }
      return Date.now() - ts > 7 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }, []);

  if (!open) return null;

  async function submit() {
    const desc = description.trim();
    if (desc.length < 10) {
      showError('Please provide at least 10 characters');
      return;
    }
    setBusy(true);
    try {
      const res = await csrfFetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          description: desc,
          email: email.trim() || undefined,
          nps_score: typeof nps === 'number' ? nps : undefined,
          metadata: {
            path: location.pathname,
            userAgent: navigator.userAgent,
            ttsMs: Date.now() - openedAt,
          },
          // Honeypot field; keep empty
          website: '',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showSuccess('Thanks for your feedback!');
      onClose();
      setCategory('feature');
      setDescription('');
      setEmail('');
      setNps('');
      try {
        localStorage.removeItem(draftKey);
      } catch (e) {
        void e;
      }
    } catch (e: unknown) {
      showError(getErrorMessage(e, 'Failed to send feedback'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-labelledby="feedback-title"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2,8,23,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
      }}
    >
      <div
        style={{
          width: 520,
          maxWidth: '95vw',
          background: '#0b1220',
          color: '#e2e8f0',
          border: '1px solid #334155',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 id="feedback-title" style={{ margin: 0 }}>
            Send Feedback
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
              Category
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              style={{
                width: '100%',
                padding: 8,
                background: '#0f172a',
                color: '#e5e7eb',
                border: '1px solid #334155',
                borderRadius: 6,
              }}
            >
              <option value="feature">Feature</option>
              <option value="bug">Bug</option>
              <option value="question">Question</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
              Description
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Describe your feedback..."
              style={{
                width: '100%',
                padding: 8,
                background: '#0f172a',
                color: '#e5e7eb',
                border: '1px solid #334155',
                borderRadius: 6,
              }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
              Email (optional)
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%',
                padding: 8,
                background: '#0f172a',
                color: '#e5e7eb',
                border: '1px solid #334155',
                borderRadius: 6,
              }}
            />
          </label>
          {showNps && (
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                How likely are you to recommend us to a friend? (0–10)
              </span>
              <input
                type="number"
                min={0}
                max={10}
                value={nps}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') setNps('');
                  else setNps(Math.max(0, Math.min(10, Number(v))));
                }}
                style={{
                  width: '100%',
                  padding: 8,
                  background: '#0f172a',
                  color: '#e5e7eb',
                  border: '1px solid #334155',
                  borderRadius: 6,
                }}
              />
            </label>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              disabled={busy}
              style={{
                padding: '8px 12px',
                background: 'transparent',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || !description.trim()}
              style={{
                padding: '8px 12px',
                background: '#2563eb',
                color: '#fff',
                border: '1px solid #1d4ed8',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
