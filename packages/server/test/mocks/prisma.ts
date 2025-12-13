/**
 * Prisma Client Mock
 * Provides a mock implementation of PrismaClient for testing
 */

import type { PrismaClient } from '@prisma/client';
import { vi } from 'vitest';

/**
 * Create a mock Prisma client for testing
 * Uses Vitest's mock functions to track calls
 */
export function createMockPrisma(): MockPrismaClient {
  return {
    // User operations
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },

    // Village operations
    village: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },

    // Agent operations
    agent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
    },

    // House operations
    house: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },

    // Room operations
    room: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },

    // Transaction support
    $transaction: vi.fn((callback) => callback(this as any)),

    // Connection management
    $connect: vi.fn(),
    $disconnect: vi.fn(),

    // Raw queries
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),

    // Metrics
    $metrics: {
      json: vi.fn(),
      prometheus: vi.fn(),
    },
  } as unknown as MockPrismaClient;
}

/**
 * Type for mocked Prisma client
 */
export type MockPrismaClient = {
  [K in keyof PrismaClient]: PrismaClient[K] extends (...args: any[]) => any
    ? ReturnType<typeof vi.fn>
    : PrismaClient[K] extends object
      ? {
          [M in keyof PrismaClient[K]]: ReturnType<typeof vi.fn>;
        }
      : PrismaClient[K];
};

/**
 * Reset all mocks on a Prisma client
 */
export function resetPrismaMocks(prisma: MockPrismaClient) {
  Object.values(prisma).forEach((model) => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach((method) => {
        if (typeof method === 'function' && 'mockReset' in method) {
          (method as any).mockReset();
        }
      });
    } else if (typeof model === 'function' && 'mockReset' in model) {
      (model as any).mockReset();
    }
  });
}

/**
 * Example usage in tests:
 *
 * import { createMockPrisma } from '../test/mocks/prisma';
 * import { generateMockVillage } from '../test/helpers';
 *
 * describe('VillageService', () => {
 *   let mockPrisma: MockPrismaClient;
 *
 *   beforeEach(() => {
 *     mockPrisma = createMockPrisma();
 *   });
 *
 *   it('should create a village', async () => {
 *     const mockVillage = generateMockVillage();
 *     mockPrisma.village.create.mockResolvedValue(mockVillage);
 *
 *     const result = await villageService.create(mockPrisma, { name: 'Test' });
 *
 *     expect(mockPrisma.village.create).toHaveBeenCalledWith({
 *       data: expect.objectContaining({ name: 'Test' })
 *     });
 *     expect(result).toEqual(mockVillage);
 *   });
 * });
 */
