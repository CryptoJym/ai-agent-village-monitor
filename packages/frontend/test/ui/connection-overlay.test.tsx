import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionOverlay } from '../../src/ui/ConnectionOverlay';
import { eventBus } from '../../src/realtime/EventBus';

describe('ConnectionOverlay', () => {
  it('shows on disconnected', async () => {
    render(<ConnectionOverlay />);
    eventBus.emit('connection_status', { status: 'disconnected' });
    expect(await screen.findByText(/Disconnected/i)).toBeInTheDocument();
  });
});
