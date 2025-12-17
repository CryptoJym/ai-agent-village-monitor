import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubDependencyAnalyzer, DependencyGraph } from '../../github/dependency-analyzer';
import { GitHubClient } from '../../github/client';
import { ModuleInfo } from '../../github/module-classifier';
import { ModuleType } from '../../analysis/module-classifier';
import { dependencyAnalyzer } from '../../analysis/dependency-analyzer';

// Mock GitHubClient
vi.mock('../../github/client');

describe('GitHubDependencyAnalyzer', () => {
  let analyzer: GitHubDependencyAnalyzer;
  let mockClient: GitHubClient;

  beforeEach(() => {
    mockClient = {
      getFileContent: vi.fn(),
    } as any;

    analyzer = new GitHubDependencyAnalyzer(mockClient);
  });

  describe('analyzeDependenciesFromContent', () => {
    it('should analyze dependencies from file contents', () => {
      const files = new Map<string, string>([
        [
          '/src/a.ts',
          `
          import { b } from './b';
          import { c } from './c';
        `,
        ],
        ['/src/b.ts', `import { c } from './c';`],
        ['/src/c.ts', 'export const c = 1;'],
      ]);

      const modules: ModuleInfo[] = [
        {
          path: '/src/a.ts',
          type: ModuleType.SERVICE,
          language: 'TypeScript',
          complexity: 2,
          fileCount: 1,
          importCount: 0,
          confidence: 1,
          reason: 'Service file',
        },
        {
          path: '/src/b.ts',
          type: ModuleType.SERVICE,
          language: 'TypeScript',
          complexity: 1,
          fileCount: 1,
          importCount: 0,
          confidence: 1,
          reason: 'Service file',
        },
        {
          path: '/src/c.ts',
          type: ModuleType.UTILITY,
          language: 'TypeScript',
          complexity: 1,
          fileCount: 1,
          importCount: 0,
          confidence: 1,
          reason: 'Utility file',
        },
      ];

      const result = analyzer.analyzeDependenciesFromContent(files, modules);

      expect(result.graph.nodes).toHaveLength(3);
      expect(result.graph.edges.length).toBeGreaterThan(0);
      expect(result.metrics).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should detect circular dependencies', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { b } from './b';`],
        ['/src/b.ts', `import { a } from './a';`],
      ]);

      const modules: ModuleInfo[] = [
        {
          path: '/src/a.ts',
          type: ModuleType.SERVICE,
          language: 'TypeScript',
          complexity: 1,
          fileCount: 1,
          importCount: 0,
          confidence: 1,
          reason: 'Service',
        },
        {
          path: '/src/b.ts',
          type: ModuleType.SERVICE,
          language: 'TypeScript',
          complexity: 1,
          fileCount: 1,
          importCount: 0,
          confidence: 1,
          reason: 'Service',
        },
      ];

      const result = analyzer.analyzeDependenciesFromContent(files, modules);

      expect(result.circular.length).toBeGreaterThan(0);
      expect(result.graph.circular.length).toBeGreaterThan(0);
    });

    it('should calculate metrics correctly', () => {
      const files = new Map<string, string>([
        [
          '/src/hub.ts',
          `
          import { a } from './a';
          import { b } from './b';
          import { c } from './c';
          import { d } from './d';
          import { e } from './e';
        `,
        ],
        ['/src/a.ts', `import { hub } from './hub';`],
        ['/src/b.ts', `import { hub } from './hub';`],
        ['/src/c.ts', `import { hub } from './hub';`],
        ['/src/d.ts', `import { hub } from './hub';`],
        ['/src/e.ts', `import { hub } from './hub';`],
      ]);

      const modules: ModuleInfo[] = [
        '/src/hub.ts',
        '/src/a.ts',
        '/src/b.ts',
        '/src/c.ts',
        '/src/d.ts',
        '/src/e.ts',
      ].map((path) => ({
        path,
        type: ModuleType.SERVICE,
        language: 'TypeScript',
        complexity: 1,
        fileCount: 1,
        importCount: 0,
        confidence: 1,
        reason: 'Service',
      }));

      const result = analyzer.analyzeDependenciesFromContent(files, modules);

      expect(result.metrics.totalModules).toBe(6);
      expect(result.metrics.averageCoupling).toBeGreaterThan(0);
      expect(result.metrics.highCouplingModules.length).toBeGreaterThan(0);
    });

    it('should identify isolated modules', () => {
      const files = new Map<string, string>([
        ['/src/connected.ts', `import { other } from './other';`],
        ['/src/other.ts', 'export const other = 1;'],
        ['/src/isolated.ts', 'export const isolated = 1;'],
      ]);

      const modules: ModuleInfo[] = [
        {
          path: '/src/connected.ts',
          type: ModuleType.SERVICE,
          language: 'TypeScript',
          complexity: 1,
          fileCount: 1,
          importCount: 0,
          confidence: 1,
          reason: 'Service',
        },
        {
          path: '/src/other.ts',
          type: ModuleType.UTILITY,
          language: 'TypeScript',
          complexity: 1,
          fileCount: 1,
          importCount: 0,
          confidence: 1,
          reason: 'Utility',
        },
        {
          path: '/src/isolated.ts',
          type: ModuleType.UTILITY,
          language: 'TypeScript',
          complexity: 1,
          fileCount: 1,
          importCount: 0,
          confidence: 1,
          reason: 'Utility',
        },
      ];

      const result = analyzer.analyzeDependenciesFromContent(files, modules);

      expect(result.metrics.isolatedModules).toContain('/src/isolated.ts');
    });

    it('should generate appropriate recommendations', () => {
      // Create a longer circular chain for high severity
      const files = new Map<string, string>([
        ['/src/a.ts', `import { b } from './b';`],
        ['/src/b.ts', `import { c } from './c';`],
        ['/src/c.ts', `import { d } from './d';`],
        ['/src/d.ts', `import { e } from './e';`],
        ['/src/e.ts', `import { a } from './a';`], // Close the loop
      ]);

      const modules: ModuleInfo[] = [
        '/src/a.ts',
        '/src/b.ts',
        '/src/c.ts',
        '/src/d.ts',
        '/src/e.ts',
      ].map((path) => ({
        path,
        type: ModuleType.SERVICE,
        language: 'TypeScript',
        complexity: 1,
        fileCount: 1,
        importCount: 0,
        confidence: 1,
        reason: 'Service',
      }));

      const result = analyzer.analyzeDependenciesFromContent(files, modules);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some((r) => r.toLowerCase().includes('circular'))).toBe(true);
    });
  });

  describe('findHotspots', () => {
    it('should identify highly coupled modules', () => {
      const files = new Map<string, string>([
        [
          '/src/hub.ts',
          `
          import { a } from './a';
          import { b } from './b';
          import { c } from './c';
          import { d } from './d';
        `,
        ],
        ['/src/a.ts', `import { hub } from './hub';`],
        ['/src/b.ts', `import { hub } from './hub';`],
        ['/src/c.ts', `import { hub } from './hub';`],
        ['/src/d.ts', `import { hub } from './hub';`],
      ]);

      const modules: ModuleInfo[] = Array.from(files.keys()).map((path) => ({
        path,
        type: ModuleType.SERVICE,
        language: 'TypeScript',
        complexity: 1,
        fileCount: 1,
        importCount: 0,
        confidence: 1,
        reason: 'Service',
      }));

      const result = analyzer.analyzeDependenciesFromContent(files, modules);

      // Build core graph to test hotspots
      const coreGraph = dependencyAnalyzer.buildDependencyGraph(files);

      const hotspots = analyzer.findHotspots(
        result.graph,
        coreGraph,
        5, // threshold
      );

      expect(hotspots.length).toBeGreaterThan(0);
      expect(hotspots[0].module).toBe('/src/hub.ts');
      expect(hotspots[0].coupling).toBeGreaterThanOrEqual(5);
    });
  });

  describe('analyzeImpact', () => {
    it('should calculate module impact correctly', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { util } from './util';`],
        ['/src/b.ts', `import { util } from './util';`],
        ['/src/c.ts', `import { util } from './util';`],
        ['/src/util.ts', 'export const util = 1;'],
      ]);

      const modules: ModuleInfo[] = Array.from(files.keys()).map((path) => ({
        path,
        type: ModuleType.UTILITY,
        language: 'TypeScript',
        complexity: 1,
        fileCount: 1,
        importCount: 0,
        confidence: 1,
        reason: 'Utility',
      }));

      analyzer.analyzeDependenciesFromContent(files, modules);

      const coreGraph = dependencyAnalyzer.buildDependencyGraph(files);

      const impact = analyzer.analyzeImpact(coreGraph, '/src/util.ts');

      expect(impact.directDependents).toHaveLength(3);
      expect(impact.impactScore).toBeGreaterThan(0);
    });

    it('should calculate transitive impact', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { b } from './b';`],
        ['/src/b.ts', `import { c } from './c';`],
        ['/src/c.ts', `import { d } from './d';`],
        ['/src/d.ts', 'export const d = 1;'],
      ]);

      const modules: ModuleInfo[] = Array.from(files.keys()).map((path) => ({
        path,
        type: ModuleType.SERVICE,
        language: 'TypeScript',
        complexity: 1,
        fileCount: 1,
        importCount: 0,
        confidence: 1,
        reason: 'Service',
      }));

      analyzer.analyzeDependenciesFromContent(files, modules);

      const coreGraph = dependencyAnalyzer.buildDependencyGraph(files);

      const impact = analyzer.analyzeImpact(coreGraph, '/src/d.ts');

      // d is imported by c, c by b, b by a
      expect(impact.transitiveDependents.size).toBe(3);
      expect(impact.impactScore).toBe(3);
    });
  });

  describe('findEntryPoints', () => {
    it('should identify entry point modules', () => {
      const files = new Map<string, string>([
        ['/src/index.ts', `import { app } from './app';`],
        ['/src/app.ts', `import { config } from './config';`],
        ['/src/config.ts', 'export const config = {};'],
      ]);

      const modules: ModuleInfo[] = Array.from(files.keys()).map((path) => ({
        path,
        type: ModuleType.SERVICE,
        language: 'TypeScript',
        complexity: 1,
        fileCount: 1,
        importCount: 0,
        confidence: 1,
        reason: 'Service',
      }));

      analyzer.analyzeDependenciesFromContent(files, modules);

      const coreGraph = dependencyAnalyzer.buildDependencyGraph(files);

      const entryPoints = analyzer.findEntryPoints(coreGraph);

      // Entry points have no imports but have importedBy
      expect(entryPoints.length).toBeGreaterThan(0);
    });
  });

  describe('calculateModuleImportance', () => {
    it('should rank modules by importance', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { util } from './util';`],
        ['/src/b.ts', `import { util } from './util';`],
        ['/src/c.ts', `import { util } from './util';`],
        ['/src/util.ts', 'export const util = 1;'],
        ['/src/isolated.ts', 'export const x = 1;'],
      ]);

      const modules: ModuleInfo[] = Array.from(files.keys()).map((path) => ({
        path,
        type: ModuleType.UTILITY,
        language: 'TypeScript',
        complexity: 1,
        fileCount: 1,
        importCount: 0,
        confidence: 1,
        reason: 'Utility',
      }));

      analyzer.analyzeDependenciesFromContent(files, modules);

      const coreGraph = dependencyAnalyzer.buildDependencyGraph(files);

      const importance = analyzer.calculateModuleImportance(coreGraph);

      expect(importance.length).toBeGreaterThan(0);
      // util should be most important (has most dependents)
      expect(importance[0].module).toBe('/src/util.ts');
      expect(importance[0].importance).toBeGreaterThan(0);
    });
  });

  describe('suggestPackageExtractions', () => {
    it('should suggest utilities with many dependents for extraction', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { util } from './utils/helper';`],
        ['/src/b.ts', `import { util } from './utils/helper';`],
        ['/src/c.ts', `import { util } from './utils/helper';`],
        ['/src/d.ts', `import { util } from './utils/helper';`],
        ['/src/e.ts', `import { util } from './utils/helper';`],
        ['/src/f.ts', `import { util } from './utils/helper';`],
        ['/src/g.ts', `import { util } from './utils/helper';`],
        ['/src/h.ts', `import { util } from './utils/helper';`],
        ['/src/i.ts', `import { util } from './utils/helper';`],
        ['/src/j.ts', `import { util } from './utils/helper';`],
        ['/src/k.ts', `import { util } from './utils/helper';`],
        ['/src/utils/helper.ts', 'export const util = 1;'],
      ]);

      const modules: ModuleInfo[] = [
        ...Array.from(files.keys())
          .filter((p) => !p.includes('helper'))
          .map((path) => ({
            path,
            type: ModuleType.SERVICE,
            language: 'TypeScript',
            complexity: 1,
            fileCount: 1,
            importCount: 0,
            confidence: 1,
            reason: 'Service',
          })),
        {
          path: '/src/utils/helper.ts',
          type: ModuleType.UTILITY,
          language: 'TypeScript',
          complexity: 1,
          fileCount: 1,
          importCount: 0,
          confidence: 1,
          reason: 'Utility',
        },
      ];

      analyzer.analyzeDependenciesFromContent(files, modules);

      const coreGraph = dependencyAnalyzer.buildDependencyGraph(files);

      const suggestions = analyzer.suggestPackageExtractions(coreGraph, modules);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].modulePath).toBe('/src/utils/helper.ts');
      expect(suggestions[0].reusePotential).toBe('high');
    });

    it('should not suggest modules with few dependents', () => {
      const files = new Map<string, string>([
        ['/src/a.ts', `import { util } from './utils/helper';`],
        ['/src/utils/helper.ts', 'export const util = 1;'],
      ]);

      const modules: ModuleInfo[] = [
        {
          path: '/src/a.ts',
          type: ModuleType.SERVICE,
          language: 'TypeScript',
          complexity: 1,
          fileCount: 1,
          importCount: 0,
          confidence: 1,
          reason: 'Service',
        },
        {
          path: '/src/utils/helper.ts',
          type: ModuleType.UTILITY,
          language: 'TypeScript',
          complexity: 1,
          fileCount: 1,
          importCount: 0,
          confidence: 1,
          reason: 'Utility',
        },
      ];

      analyzer.analyzeDependenciesFromContent(files, modules);

      const coreGraph = dependencyAnalyzer.buildDependencyGraph(files);

      const suggestions = analyzer.suggestPackageExtractions(coreGraph, modules);

      // Should not suggest extraction for utility with only 1 dependent
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('exportToDot', () => {
    it('should export graph in DOT format', () => {
      const graph: DependencyGraph = {
        nodes: ['/src/a.ts', '/src/b.ts'],
        edges: [{ from: '/src/a.ts', to: '/src/b.ts' }],
        circular: [],
        metrics: {
          avgCoupling: 1,
          maxDependents: 1,
          orphanModules: [],
        },
      };

      const dot = analyzer.exportToDot(graph);

      expect(dot).toContain('digraph Dependencies');
      expect(dot).toContain('a.ts');
      expect(dot).toContain('b.ts');
      expect(dot).toContain('->');
    });

    it('should highlight circular dependencies in DOT format', () => {
      const graph: DependencyGraph = {
        nodes: ['/src/a.ts', '/src/b.ts'],
        edges: [
          { from: '/src/a.ts', to: '/src/b.ts' },
          { from: '/src/b.ts', to: '/src/a.ts' },
        ],
        circular: [['/src/a.ts', '/src/b.ts', '/src/a.ts']],
        metrics: {
          avgCoupling: 2,
          maxDependents: 1,
          orphanModules: [],
        },
      };

      const dot = analyzer.exportToDot(graph);

      expect(dot).toContain('color=red');
      expect(dot).toContain('style=bold');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complex TypeScript project structure', () => {
      const files = new Map<string, string>([
        [
          '/src/controllers/user.controller.ts',
          `
          import { UserService } from '../services/user.service';
          import { UserRepository } from '../repositories/user.repository';
        `,
        ],
        [
          '/src/services/user.service.ts',
          `
          import { UserRepository } from '../repositories/user.repository';
        `,
        ],
        [
          '/src/repositories/user.repository.ts',
          `
          import { db } from '../utils/db';
        `,
        ],
        ['/src/utils/db.ts', 'export const db = {};'],
      ]);

      const modules: ModuleInfo[] = [
        {
          path: '/src/controllers/user.controller.ts',
          type: ModuleType.CONTROLLER,
          language: 'TypeScript',
          complexity: 2,
          fileCount: 1,
          importCount: 0,
          confidence: 1,
          reason: 'Controller',
        },
        {
          path: '/src/services/user.service.ts',
          type: ModuleType.SERVICE,
          language: 'TypeScript',
          complexity: 1,
          fileCount: 1,
          importCount: 0,
          confidence: 1,
          reason: 'Service',
        },
        {
          path: '/src/repositories/user.repository.ts',
          type: ModuleType.REPOSITORY,
          language: 'TypeScript',
          complexity: 1,
          fileCount: 1,
          importCount: 0,
          confidence: 1,
          reason: 'Repository',
        },
        {
          path: '/src/utils/db.ts',
          type: ModuleType.UTILITY,
          language: 'TypeScript',
          complexity: 1,
          fileCount: 1,
          importCount: 0,
          confidence: 1,
          reason: 'Utility',
        },
      ];

      const result = analyzer.analyzeDependenciesFromContent(files, modules);

      expect(result.graph.nodes).toHaveLength(4);
      expect(result.circular).toHaveLength(0); // Should not have circular deps
      expect(result.metrics.totalModules).toBe(4);
    });
  });
});
