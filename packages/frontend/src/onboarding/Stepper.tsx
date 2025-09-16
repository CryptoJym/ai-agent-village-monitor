import React from 'react';

type Step = {
  id: string;
  title: string;
  description?: string;
};

export function Stepper({ steps, active }: { steps: readonly Step[]; active: number }) {
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: '12px 0', display: 'flex', gap: 16 }}>
      {steps.map((s, idx) => {
        const isActive = idx === active;
        const isDone = idx < active;
        return (
          <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              aria-hidden
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: isDone ? '#22c55e' : isActive ? '#60a5fa' : '#1f2937',
                border: '2px solid #374151',
                display: 'inline-block',
              }}
            />
            <div>
              <div
                style={{
                  color: isActive ? '#ffffff' : '#cbd5e1',
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                {s.title}
              </div>
            </div>
            {idx < steps.length - 1 && <span style={{ margin: '0 8px', color: '#475569' }}>›</span>}
          </li>
        );
      })}
    </ol>
  );
}
