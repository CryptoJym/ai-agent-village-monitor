/**
 * Example frontend test demonstrating test utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  render,
  screen,
  waitFor,
  generateMockVillage,
  generateMockAgent,
  createMockScene,
  mockFetchSuccess,
  mockFetchError,
  mockLocalStorage,
} from './helpers';

describe('Frontend Test Utilities Example', () => {
  describe('Mock Data Generators', () => {
    it('should generate mock village data', () => {
      const village = generateMockVillage({ name: 'Test Village' });

      expect(village).toMatchObject({
        id: expect.any(Number),
        name: 'Test Village',
        githubOrgId: expect.any(String),
        visibility: expect.any(String),
      });
    });

    it('should generate mock agent data', () => {
      const agent = generateMockAgent({ name: 'Test Agent', status: 'ACTIVE' });

      expect(agent).toMatchObject({
        id: expect.any(Number),
        name: 'Test Agent',
        status: 'ACTIVE',
        villageId: expect.any(Number),
      });
    });
  });

  describe('Phaser Mocks', () => {
    it('should create a mock scene', () => {
      const scene = createMockScene();

      expect(scene.add.container).toBeDefined();
      expect(scene.add.image).toBeDefined();
      expect(scene.cameras.main).toBeDefined();

      // Test that mocks work
      const container = scene.add.container();
      container.setSize(100, 100);

      expect(scene.add.container).toHaveBeenCalled();
      expect(container.setSize).toHaveBeenCalledWith(100, 100);
    });

    it('should create mock game objects', () => {
      const scene = createMockScene();
      const image = scene.add.image();

      image.setOrigin(0.5, 0.5).setTint(0xff0000);

      expect(image.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
      expect(image.setTint).toHaveBeenCalledWith(0xff0000);
    });
  });

  describe('Fetch Mocks', () => {
    it('should mock successful fetch', async () => {
      const mockData = { id: 1, name: 'Test' };
      mockFetchSuccess(mockData);

      const response = await fetch('/api/test');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data).toEqual(mockData);
    });

    it('should mock fetch error', async () => {
      mockFetchError(404, 'Not Found');

      const response = await fetch('/api/test');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });

  describe('LocalStorage Mock', () => {
    let storage: ReturnType<typeof mockLocalStorage>;

    beforeEach(() => {
      storage = mockLocalStorage();
      global.localStorage = storage as any;
    });

    it('should set and get items', () => {
      storage.setItem('key', 'value');
      const value = storage.getItem('key');

      expect(value).toBe('value');
      expect(storage.setItem).toHaveBeenCalledWith('key', 'value');
      expect(storage.getItem).toHaveBeenCalledWith('key');
    });

    it('should remove items', () => {
      storage.setItem('key', 'value');
      storage.removeItem('key');
      const value = storage.getItem('key');

      expect(value).toBeNull();
      expect(storage.removeItem).toHaveBeenCalledWith('key');
    });

    it('should clear all items', () => {
      storage.setItem('key1', 'value1');
      storage.setItem('key2', 'value2');
      storage.clear();

      expect(storage.length).toBe(0);
      expect(storage.clear).toHaveBeenCalled();
    });
  });

  describe('Component Rendering', () => {
    it('should render a simple component', () => {
      const TestComponent = () => <div>Hello, World!</div>;

      render(<TestComponent />);

      expect(screen.getByText('Hello, World!')).toBeInTheDocument();
    });

    it('should render with custom route', () => {
      const TestComponent = () => {
        const path = window.location.pathname;
        return <div>Current path: {path}</div>;
      };

      render(<TestComponent />, { initialRoute: '/villages/123' });

      expect(screen.getByText(/Current path:/)).toBeInTheDocument();
    });
  });

  describe('Async Testing', () => {
    it('should wait for async updates', async () => {
      const TestComponent = () => {
        const [text, setText] = React.useState('Loading...');

        React.useEffect(() => {
          const id = setTimeout(() => setText('Loaded!'), 10);
          return () => clearTimeout(id);
        }, []);

        return <div>{text}</div>;
      };

      render(<TestComponent />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Loaded!')).toBeInTheDocument();
      });
    });
  });
});

// Import React for the async test
import React from 'react';
