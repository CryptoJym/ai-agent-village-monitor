import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { DialogueUI } from '../../src/ui/DialogueUI';

function Shell() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <h1>AI Agent Village Monitor</h1>
      <button type="button" aria-label="Dialogue" onClick={() => setOpen(true)}>
        Dialogue
      </button>
      <DialogueUI open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

describe('App mount', () => {
  it('renders the app title and toggles dialogue', () => {
    render(<Shell />);
    expect(screen.getByText('AI Agent Village Monitor')).toBeInTheDocument();

    const btn = screen.getByRole('button', { name: 'Dialogue' });
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });
});
