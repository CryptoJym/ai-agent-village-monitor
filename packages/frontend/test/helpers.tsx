/**
 * Frontend test helpers
 * Provides utilities for rendering React components with providers and creating test data
 */

import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Custom render function that wraps components with necessary providers
 */
export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {},
) {
  const { initialRoute = '/', ...renderOptions } = options;

  // Set initial route if provided
  if (initialRoute !== '/') {
    window.history.pushState({}, 'Test page', initialRoute);
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return <BrowserRouter>{children}</BrowserRouter>;
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

/**
 * Mock data generators for frontend entities
 */

export interface MockVillage {
  id: number;
  name: string;
  githubOrgId: string;
  ownerId: number;
  visibility: 'PUBLIC' | 'PRIVATE';
  createdAt: string;
  updatedAt: string;
}

export function generateMockVillage(override: Partial<MockVillage> = {}): MockVillage {
  return {
    id: 1,
    name: 'Mock Village',
    githubOrgId: '123456',
    ownerId: 1,
    visibility: 'PUBLIC',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...override,
  };
}

export interface MockAgent {
  id: number;
  githubRepoId: string;
  name: string;
  villageId: number;
  status: 'ACTIVE' | 'IDLE' | 'OFFLINE';
  lastSeenAt: string;
  x?: number;
  y?: number;
}

export function generateMockAgent(override: Partial<MockAgent> = {}): MockAgent {
  return {
    id: 1,
    githubRepoId: '789012',
    name: 'Mock Agent',
    villageId: 1,
    status: 'ACTIVE',
    lastSeenAt: new Date().toISOString(),
    x: 10,
    y: 20,
    ...override,
  };
}

export interface MockHouse {
  id: number;
  villageId: number;
  x: number;
  y: number;
  houseType: string;
}

export function generateMockHouse(override: Partial<MockHouse> = {}): MockHouse {
  return {
    id: 1,
    villageId: 1,
    x: 10,
    y: 20,
    houseType: 'COTTAGE',
    ...override,
  };
}

export interface MockRoom {
  id: number;
  houseId: number;
  name: string;
  roomType: string;
}

export function generateMockRoom(override: Partial<MockRoom> = {}): MockRoom {
  return {
    id: 1,
    houseId: 1,
    name: 'Mock Room',
    roomType: 'OFFICE',
    ...override,
  };
}

export interface MockUser {
  id: number;
  username: string;
  email: string;
  githubId: string;
}

export function generateMockUser(override: Partial<MockUser> = {}): MockUser {
  return {
    id: 1,
    username: 'mockuser',
    email: 'mock@example.com',
    githubId: '123456',
    ...override,
  };
}

/**
 * Mock Phaser game objects for testing
 */

export function createMockScene() {
  return {
    add: {
      container: vi.fn(() => createMockContainer()),
      image: vi.fn(() => createMockImage()),
      text: vi.fn(() => createMockText()),
      rectangle: vi.fn(() => createMockRectangle()),
      graphics: vi.fn(() => createMockGraphics()),
    },
    cameras: {
      main: {
        scrollX: 0,
        scrollY: 0,
        zoom: 1,
        centerOn: vi.fn(),
        setZoom: vi.fn(),
      },
    },
    input: {
      on: vi.fn(),
      off: vi.fn(),
    },
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
    game: {
      scale: {
        width: 800,
        height: 600,
      },
    },
    sys: {
      game: {
        events: {
          on: vi.fn(),
          off: vi.fn(),
        },
      },
    },
  };
}

export function createMockContainer() {
  return {
    x: 0,
    y: 0,
    add: vi.fn(),
    remove: vi.fn(),
    setSize: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}

export function createMockImage() {
  return {
    x: 0,
    y: 0,
    key: 'mock-image',
    setOrigin: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
    setTint: vi.fn().mockReturnThis(),
    clearTint: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}

export function createMockText() {
  return {
    x: 0,
    y: 0,
    text: '',
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setStyle: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}

export function createMockRectangle() {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    setOrigin: vi.fn().mockReturnThis(),
    setFillStyle: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}

export function createMockGraphics() {
  return {
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    strokeRect: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}

/**
 * Mock Socket.IO client
 */

export function createMockSocket() {
  return {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  };
}

/**
 * Wait utilities
 */

export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Async utilities for testing
 */

export async function waitForNextUpdate() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Mock API responses
 */

export function mockFetchSuccess<T>(data: T) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  });
}

export function mockFetchError(status: number, message: string) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: message,
    json: async () => ({ error: message }),
    text: async () => message,
  });
}

/**
 * Local storage mock
 */

export function mockLocalStorage() {
  const storage: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      Object.keys(storage).forEach((key) => delete storage[key]);
    }),
    get length() {
      return Object.keys(storage).length;
    },
    key: vi.fn((index: number) => Object.keys(storage)[index] || null),
  };
}

/**
 * Re-export commonly used testing library functions
 */
export * from '@testing-library/react';
export { renderWithProviders as render };
