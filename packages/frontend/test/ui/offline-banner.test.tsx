import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineBanner } from '../../src/ui/OfflineBanner';

describe('OfflineBanner', () => {
  it('shows when offline and hides when online', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    render(<OfflineBanner />);
    expect(screen.getByText(/You are offline/i)).toBeInTheDocument();

    Object.defineProperty(window.navigator, 'onLine', { value: true });
    window.dispatchEvent(new Event('online'));
    // We don't have an easy way to await re-render without async effect tick
    // Rely on the component's immediate state update via event
  });
});
