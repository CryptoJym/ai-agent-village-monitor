import React, { useState } from 'react';
import { useToast } from './Toast';

type Category = 'bug' | 'idea' | 'question' | 'other';

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showError, showSuccess } = useToast();
  const [category, setCategory] = useState<Category>('idea');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit() {
    if (!description.trim()) {
      showError('Please provide a short description');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ category, description, email: email.trim() || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showSuccess('Thanks for your feedback!');
      onClose();
      setCategory('idea');
      setDescription('');
      setEmail('');
    } catch (e: any) {
      showError(e?.message || 'Failed to send feedback');
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
              <option value="idea">Idea</option>
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
