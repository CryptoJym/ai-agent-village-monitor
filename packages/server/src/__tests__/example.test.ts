/**
 * Example test file demonstrating test utilities
 * This shows how to use the test helpers and mocks
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockPrisma, resetPrismaMocks, type MockPrismaClient } from '../../test/mocks/prisma';
import {
  generateMockVillage,
  generateMockAgent,
  createTestVillageData,
  createTestAgentData,
} from '../../test/helpers';

describe('Test Utilities Example', () => {
  let mockPrisma: MockPrismaClient;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  describe('Mock Prisma Client', () => {
    it('should create a village using mock', async () => {
      const mockVillage = generateMockVillage({ name: 'Test Village' });
      mockPrisma.village.create.mockResolvedValue(mockVillage);

      const result = await mockPrisma.village.create({
        data: createTestVillageData({ name: 'Test Village' }),
      });

      expect(mockPrisma.village.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Test Village' }),
      });
      expect(result).toEqual(mockVillage);
      expect(result.name).toBe('Test Village');
    });

    it('should find a village by ID', async () => {
      const mockVillage = generateMockVillage({ id: 123 });
      mockPrisma.village.findUnique.mockResolvedValue(mockVillage);

      const result = await mockPrisma.village.findUnique({
        where: { id: 123 },
      });

      expect(mockPrisma.village.findUnique).toHaveBeenCalledWith({
        where: { id: 123 },
      });
      expect(result).toEqual(mockVillage);
    });

    it('should list villages', async () => {
      const mockVillages = [
        generateMockVillage({ id: 1, name: 'Village 1' }),
        generateMockVillage({ id: 2, name: 'Village 2' }),
      ];
      mockPrisma.village.findMany.mockResolvedValue(mockVillages);

      const result = await mockPrisma.village.findMany();

      expect(mockPrisma.village.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Village 1');
    });

    it('should update a village', async () => {
      const updatedVillage = generateMockVillage({ id: 1, name: 'Updated Village' });
      mockPrisma.village.update.mockResolvedValue(updatedVillage);

      const result = await mockPrisma.village.update({
        where: { id: 1 },
        data: { name: 'Updated Village' },
      });

      expect(mockPrisma.village.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Updated Village' },
      });
      expect(result.name).toBe('Updated Village');
    });

    it('should delete a village', async () => {
      const deletedVillage = generateMockVillage({ id: 1 });
      mockPrisma.village.delete.mockResolvedValue(deletedVillage);

      const result = await mockPrisma.village.delete({
        where: { id: 1 },
      });

      expect(mockPrisma.village.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual(deletedVillage);
    });
  });

  describe('Agent Operations', () => {
    it('should create an agent', async () => {
      const mockAgent = generateMockAgent({ name: 'Test Agent', villageId: 1 });
      mockPrisma.agent.create.mockResolvedValue(mockAgent);

      const result = await mockPrisma.agent.create({
        data: createTestAgentData({ name: 'Test Agent', villageId: 1 }),
      });

      expect(result.name).toBe('Test Agent');
      expect(result.villageId).toBe(1);
    });

    it('should upsert an agent', async () => {
      const mockAgent = generateMockAgent({ githubRepoId: '123456' });
      mockPrisma.agent.upsert.mockResolvedValue(mockAgent);

      const result = await mockPrisma.agent.upsert({
        where: { githubRepoId: '123456' },
        create: createTestAgentData({ githubRepoId: '123456' }),
        update: { lastSeenAt: new Date() },
      });

      expect(mockPrisma.agent.upsert).toHaveBeenCalled();
      expect(result).toEqual(mockAgent);
    });
  });

  describe('Transaction Support', () => {
    it('should execute operations in a transaction', async () => {
      const mockVillage = generateMockVillage();
      const mockAgent = generateMockAgent({ villageId: mockVillage.id });

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrisma as any);
      });

      mockPrisma.village.create.mockResolvedValue(mockVillage);
      mockPrisma.agent.create.mockResolvedValue(mockAgent);

      const result = await mockPrisma.$transaction(async (tx) => {
        const village = await tx.village.create({ data: createTestVillageData() });
        const agent = await tx.agent.create({
          data: createTestAgentData({ villageId: village.id }),
        });
        return { village, agent };
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result.village).toEqual(mockVillage);
      expect(result.agent).toEqual(mockAgent);
    });
  });

  describe('Mock Reset', () => {
    it('should reset all mocks', () => {
      mockPrisma.village.create.mockResolvedValue(generateMockVillage());
      expect(mockPrisma.village.create).toHaveBeenCalledTimes(0);

      mockPrisma.village.create({ data: createTestVillageData() });
      expect(mockPrisma.village.create).toHaveBeenCalledTimes(1);

      resetPrismaMocks(mockPrisma);
      expect(mockPrisma.village.create).toHaveBeenCalledTimes(0);
    });
  });
});
