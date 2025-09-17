import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { CommandPalette } from '../../src/ui/CommandPalette';
import * as ActionRegistry from '../../src/actions/ActionRegistry';
import * as SI from '../../src/search/SearchIndex';

describe('CommandPalette', () => {
  beforeEach(() => {
    SI.setData({
      agents: [
        { type: 'agent', id: 'a-1', name: 'Claude', status: 'idle' },
        { type: 'agent', id: 'a-2', name: 'Sage', status: 'working' },
      ],
      houses: [
        { type: 'house', id: 'h-1', name: 'Main', location: 'North' },
        { type: 'house', id: 'h-2', name: 'Ops', location: 'South' },
      ],
      actions: [
        { type: 'action', id: 'startAgent', label: 'Start Agent' },
        { type: 'action', id: 'stopAgent', label: 'Stop Agent' },
      ],
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('opens via Ctrl+K and closes with Esc', () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: /command palette/i })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /command palette/i })).not.toBeInTheDocument();
  });

  it('shows and filters results, executes selected action on Enter', () => {
    const spy = vi.spyOn(ActionRegistry, 'executeAction').mockResolvedValue();
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = screen.getByRole('textbox');
    // filter to Claude
    fireEvent.change(input, { target: { value: 'clau' } });
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent(/claude/i);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(spy).toHaveBeenCalled();
  });

  it('shows recent actions when empty query', async () => {
    // seed a recent action using real implementation
    await ActionRegistry.executeAction('startAgent', { agentId: 'a-1' } as any);
    const spy = vi.spyOn(ActionRegistry, 'executeAction').mockResolvedValue();
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    // no query typed → shows recent
    const list = screen.getAllByRole('listbox');
    expect(list.length).toBeGreaterThan(0);
    // click the first recent item (an option)
    const first = screen.getAllByRole('option')[0];
    fireEvent.click(first);
    expect(spy).toHaveBeenCalled();
  });
});
