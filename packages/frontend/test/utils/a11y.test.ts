import { describe, it, expect, beforeEach } from 'vitest';
import { createLiveRegion, announce } from '../../src/utils/a11y';

describe('a11y live region', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('creates a single live region and updates content', () => {
    createLiveRegion();
    createLiveRegion(); // idempotent
    const el = document.body.querySelector('[role="status"][aria-live="polite"]') as HTMLElement;
    expect(el).toBeTruthy();
    announce('hello');
    expect(el.textContent).toBe('hello');
  });
});
