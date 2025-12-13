import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LocaleSwitcher } from '../../src/ui/LocaleSwitcher';

// Mock react-i18next
const mockChangeLanguage = vi.fn();
const mockI18n = {
  language: 'en',
  changeLanguage: mockChangeLanguage,
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: mockI18n,
    t: (key: string) => key,
  }),
}));

describe('LocaleSwitcher', () => {
  let localStorageSetItem: ReturnType<typeof vi.spyOn>;
  let localStorageGetItem: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockI18n.language = 'en';
    localStorageSetItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    localStorageGetItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null);
  });

  afterEach(() => {
    localStorageSetItem.mockRestore();
    localStorageGetItem.mockRestore();
  });

  describe('rendering', () => {
    it('renders language buttons for en and es', () => {
      render(<LocaleSwitcher />);

      expect(screen.getByText('EN')).toBeInTheDocument();
      expect(screen.getByText('ES')).toBeInTheDocument();
    });

    it('renders as a group with accessible label', () => {
      render(<LocaleSwitcher />);

      const group = screen.getByRole('group');
      expect(group).toBeInTheDocument();
      expect(group).toHaveAttribute('aria-label', 'Language selection');
    });

    it('displays uppercase language codes', () => {
      render(<LocaleSwitcher />);

      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveTextContent('EN');
      expect(buttons[1]).toHaveTextContent('ES');
    });
  });

  describe('accessibility', () => {
    it('has aria-pressed=true on current language button', () => {
      mockI18n.language = 'en';
      render(<LocaleSwitcher />);

      const enButton = screen.getByRole('button', { name: /switch to english/i });
      const esButton = screen.getByRole('button', { name: /switch to español/i });

      expect(enButton).toHaveAttribute('aria-pressed', 'true');
      expect(esButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('has descriptive aria-labels with full language names', () => {
      render(<LocaleSwitcher />);

      expect(screen.getByRole('button', { name: /switch to english/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /switch to español/i })).toBeInTheDocument();
    });

    it('all buttons have type="button"', () => {
      render(<LocaleSwitcher />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });

    it('updates aria-pressed when language changes', () => {
      const { rerender } = render(<LocaleSwitcher />);

      // Start with English
      mockI18n.language = 'en';
      rerender(<LocaleSwitcher />);

      let enButton = screen.getByRole('button', { name: /switch to english/i });
      expect(enButton).toHaveAttribute('aria-pressed', 'true');

      // Switch to Spanish
      mockI18n.language = 'es';
      rerender(<LocaleSwitcher />);

      const esButton = screen.getByRole('button', { name: /switch to español/i });
      enButton = screen.getByRole('button', { name: /switch to english/i });

      expect(esButton).toHaveAttribute('aria-pressed', 'true');
      expect(enButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('keyboard navigation', () => {
    it('activates language on Enter key', () => {
      mockI18n.language = 'en';
      render(<LocaleSwitcher />);

      const esButton = screen.getByRole('button', { name: /switch to español/i });
      fireEvent.keyDown(esButton, { key: 'Enter' });

      expect(mockChangeLanguage).toHaveBeenCalledWith('es');
    });

    it('activates language on Space key', () => {
      mockI18n.language = 'en';
      render(<LocaleSwitcher />);

      const esButton = screen.getByRole('button', { name: /switch to español/i });
      fireEvent.keyDown(esButton, { key: ' ' });

      expect(mockChangeLanguage).toHaveBeenCalledWith('es');
    });

    it('handles Space key press correctly (language changes, action triggered)', () => {
      mockI18n.language = 'en';
      render(<LocaleSwitcher />);

      const esButton = screen.getByRole('button', { name: /switch to español/i });

      // Create a keyboard event with Space key
      const keyDownEvent = new KeyboardEvent('keydown', {
        key: ' ',
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(keyDownEvent, 'preventDefault');

      esButton.dispatchEvent(keyDownEvent);

      // Verify the handler was called
      expect(mockChangeLanguage).toHaveBeenCalledWith('es');
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('handles Enter key press correctly (language changes, action triggered)', () => {
      mockI18n.language = 'en';
      render(<LocaleSwitcher />);

      const esButton = screen.getByRole('button', { name: /switch to español/i });

      // Create a keyboard event with Enter key
      const keyDownEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(keyDownEvent, 'preventDefault');

      esButton.dispatchEvent(keyDownEvent);

      // Verify the handler was called
      expect(mockChangeLanguage).toHaveBeenCalledWith('es');
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('does not activate on other keys', () => {
      render(<LocaleSwitcher />);

      const esButton = screen.getByRole('button', { name: /switch to español/i });
      fireEvent.keyDown(esButton, { key: 'Tab' });
      fireEvent.keyDown(esButton, { key: 'Escape' });
      fireEvent.keyDown(esButton, { key: 'a' });

      expect(mockChangeLanguage).not.toHaveBeenCalled();
    });
  });

  describe('click behavior', () => {
    it('changes language on click', () => {
      mockI18n.language = 'en';
      render(<LocaleSwitcher />);

      const esButton = screen.getByRole('button', { name: /switch to español/i });
      fireEvent.click(esButton);

      expect(mockChangeLanguage).toHaveBeenCalledWith('es');
    });

    it('persists language to localStorage on click', () => {
      mockI18n.language = 'en';
      render(<LocaleSwitcher />);

      const esButton = screen.getByRole('button', { name: /switch to español/i });
      fireEvent.click(esButton);

      expect(localStorageSetItem).toHaveBeenCalledWith('lang', 'es');
    });

    it('handles localStorage errors gracefully', () => {
      localStorageSetItem.mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });

      render(<LocaleSwitcher />);

      const esButton = screen.getByRole('button', { name: /switch to español/i });

      // Should not throw
      expect(() => fireEvent.click(esButton)).not.toThrow();
      expect(mockChangeLanguage).toHaveBeenCalledWith('es');
    });

    it('changes to English when Spanish is active', () => {
      mockI18n.language = 'es';
      render(<LocaleSwitcher />);

      const enButton = screen.getByRole('button', { name: /switch to english/i });
      fireEvent.click(enButton);

      expect(mockChangeLanguage).toHaveBeenCalledWith('en');
      expect(localStorageSetItem).toHaveBeenCalledWith('lang', 'en');
    });
  });

  describe('visual state', () => {
    it('active button has different background color', () => {
      mockI18n.language = 'en';
      render(<LocaleSwitcher />);

      const enButton = screen.getByRole('button', { name: /switch to english/i });
      const esButton = screen.getByRole('button', { name: /switch to español/i });

      // Active button should have #1f2937 background
      expect(enButton).toHaveStyle({ background: '#1f2937' });
      // Inactive button should have #0b1220 background
      expect(esButton).toHaveStyle({ background: '#0b1220' });
    });

    it('buttons have consistent styling', () => {
      render(<LocaleSwitcher />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveStyle({
          padding: '4px 8px',
          borderRadius: '6px',
          border: '1px solid #334155',
          color: '#e5e7eb',
          cursor: 'pointer',
        });
      });
    });
  });

  describe('edge cases', () => {
    it('defaults to en when i18n.language is undefined', () => {
      mockI18n.language = undefined as unknown as string;
      render(<LocaleSwitcher />);

      const enButton = screen.getByRole('button', { name: /switch to english/i });
      expect(enButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('defaults to en when i18n.language is empty string', () => {
      mockI18n.language = '';
      render(<LocaleSwitcher />);

      const enButton = screen.getByRole('button', { name: /switch to english/i });
      expect(enButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('can click same language button multiple times', () => {
      mockI18n.language = 'en';
      render(<LocaleSwitcher />);

      const enButton = screen.getByRole('button', { name: /switch to english/i });
      fireEvent.click(enButton);
      fireEvent.click(enButton);

      expect(mockChangeLanguage).toHaveBeenCalledTimes(2);
    });
  });
});
