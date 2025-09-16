import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { AgentListItem } from '../../src/ui/ContextMenu';
import * as ActionRegistry from '../../src/actions/ActionRegistry';

describe('Agent context menu', () => {
  afterEach(() => cleanup());
  it('opens on right-click and triggers Start/Stop', async () => {
    const spy = vi.spyOn(ActionRegistry, 'executeAction').mockResolvedValue();
    render(<AgentListItem agentId="a-1" name="Claude" status="idle" />);
    const row = screen.getByTestId('agent-list-item');
    fireEvent.contextMenu(row);
    const menu = screen.getByTestId('context-menu');
    expect(menu).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /start/i }));
    expect(spy).toHaveBeenCalledWith('startAgent', { agentId: 'a-1' });
  });

  it('opens via keyboard (Shift+F10) and runs recent tool', async () => {
    const spy = vi.spyOn(ActionRegistry, 'executeAction').mockResolvedValue();
    const { getByTestId } = render(<AgentListItem agentId="a-2" name="Sage" status="working" />);
    const row = getByTestId('agent-list-item');
    row.focus();
    fireEvent.keyDown(row, { key: 'F10', shiftKey: true });
    expect(screen.getByTestId('context-menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /run recent tool/i }));
    expect(spy).toHaveBeenCalledWith('runRecentTool', { agentId: 'a-2', toolId: 'last' });
  });
});
