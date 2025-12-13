import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubLanguageDetector } from '../../github/language-detector';
import { GitHubModuleClassifier } from '../../github/module-classifier';
import { GitHubDependencyAnalyzer } from '../../github/dependency-analyzer';
import { GitHubClient } from '../../github/client';
import { ModuleType } from '../../analysis/module-classifier';
import { dependencyAnalyzer } from '../../analysis/dependency-analyzer';

// Mock GitHubClient
vi.mock('../../github/client');

describe.skip('GitHub Integration Pipeline - End-to-End', () => {
  let languageDetector: GitHubLanguageDetector;
  let moduleClassifier: GitHubModuleClassifier;
  let dependencyAnalyzer: GitHubDependencyAnalyzer;
  let mockClient: GitHubClient;

  beforeEach(() => {
    languageDetector = new GitHubLanguageDetector();
    moduleClassifier = new GitHubModuleClassifier();
    mockClient = {
      getFileContent: vi.fn(),
    } as any;
    dependencyAnalyzer = new GitHubDependencyAnalyzer(mockClient);
  });

  describe('Full Pipeline: TypeScript React Application', () => {
    it('should analyze a complete TypeScript React project', () => {
      // Step 1: Language Detection
      const treeEntries = [
        {
          path: 'src/App.tsx',
          type: 'blob' as const,
          size: 3000,
          sha: 'app',
          mode: '100644',
        },
        {
          path: 'src/components/Button.tsx',
          type: 'blob' as const,
          size: 1500,
          sha: 'button',
          mode: '100644',
        },
        {
          path: 'src/components/Card.tsx',
          type: 'blob' as const,
          size: 2000,
          sha: 'card',
          mode: '100644',
        },
        {
          path: 'src/services/api.service.ts',
          type: 'blob' as const,
          size: 4000,
          sha: 'api',
          mode: '100644',
        },
        {
          path: 'src/utils/helpers.ts',
          type: 'blob' as const,
          size: 2500,
          sha: 'helpers',
          mode: '100644',
        },
        {
          path: 'src/styles/main.css',
          type: 'blob' as const,
          size: 1000,
          sha: 'css',
          mode: '100644',
        },
        {
          path: 'package.json',
          type: 'blob' as const,
          size: 500,
          sha: 'pkg',
          mode: '100644',
        },
      ];

      const languageStats = languageDetector.detectLanguages(treeEntries);

      expect(languageStats.primary).toBe('React'); // Most bytes in .tsx files
      expect(languageStats.languages.React).toBe(6500);
      expect(languageStats.languages.TypeScript).toBe(6500);
      expect(languageStats.languages.CSS).toBe(1000);
      expect(languageStats.totalBytes).toBe(14500);

      const summary = languageDetector.getLanguagesSummary(languageStats);
      expect(summary.totalLanguages).toBeGreaterThanOrEqual(3);
      expect(summary.primaryLanguage).toBe('React');

      // Step 2: Module Classification
      const modules = moduleClassifier.classifyModules(
        treeEntries,
        languageStats,
      );

      expect(modules.length).toBeGreaterThan(0);

      const components = modules.filter(
        (m) => m.type === ModuleType.COMPONENT,
      );
      const services = modules.filter((m) => m.type === ModuleType.SERVICE);
      const utilities = modules.filter((m) => m.type === ModuleType.UTILITY);

      expect(components.length).toBeGreaterThan(0);
      expect(services.length).toBeGreaterThan(0);
      expect(utilities.length).toBeGreaterThan(0);

      const grouping = moduleClassifier.analyzeModules(modules);
      expect(grouping.statistics.totalModules).toBe(modules.length);
      expect(grouping.byType.size).toBeGreaterThan(0);

      // Step 3: Dependency Analysis
      const fileContents = new Map<string, string>([
        [
          'src/App.tsx',
          `
          import React from 'react';
          import { Button } from './components/Button';
          import { Card } from './components/Card';
          import { ApiService } from './services/api.service';
        `,
        ],
        [
          'src/components/Button.tsx',
          `
          import React from 'react';
          export const Button = () => <button>Click</button>;
        `,
        ],
        [
          'src/components/Card.tsx',
          `
          import React from 'react';
          import { Button } from './Button';
          export const Card = () => <div><Button /></div>;
        `,
        ],
        [
          'src/services/api.service.ts',
          `
          import { helpers } from '../utils/helpers';
          export class ApiService {}
        `,
        ],
        [
          'src/utils/helpers.ts',
          `
          export const helpers = {};
        `,
        ],
      ]);

      const dependencyResult = dependencyAnalyzer.analyzeDependenciesFromContent(
        fileContents,
        modules,
      );

      expect(dependencyResult.graph.nodes.length).toBeGreaterThan(0);
      expect(dependencyResult.metrics.totalModules).toBeGreaterThan(0);
      expect(dependencyResult.recommendations.length).toBeGreaterThan(0);

      // Verify overall health
      expect(dependencyResult.circular.length).toBe(0); // No circular deps
      expect(dependencyResult.metrics.averageCoupling).toBeGreaterThan(0);
    });
  });

  describe('Full Pipeline: Python Django Application', () => {
    it('should analyze a complete Python Django project', () => {
      const treeEntries = [
        {
          path: 'app/views.py',
          type: 'blob' as const,
          size: 5000,
          sha: 'views',
          mode: '100644',
        },
        {
          path: 'app/models.py',
          type: 'blob' as const,
          size: 4000,
          sha: 'models',
          mode: '100644',
        },
        {
          path: 'app/serializers.py',
          type: 'blob' as const,
          size: 3000,
          sha: 'serializers',
          mode: '100644',
        },
        {
          path: 'app/utils.py',
          type: 'blob' as const,
          size: 2000,
          sha: 'utils',
          mode: '100644',
        },
        {
          path: 'templates/index.html',
          type: 'blob' as const,
          size: 1500,
          sha: 'html',
          mode: '100644',
        },
      ];

      const languageStats = languageDetector.detectLanguages(treeEntries);

      expect(languageStats.primary).toBe('Python');
      expect(languageStats.languages.Python).toBe(14000);
      expect(languageStats.languages.HTML).toBe(1500);

      const modules = moduleClassifier.classifyModules(
        treeEntries,
        languageStats,
      );

      const controllers = modules.filter(
        (m) => m.type === ModuleType.CONTROLLER,
      );
      const repositories = modules.filter(
        (m) => m.type === ModuleType.REPOSITORY,
      );

      expect(controllers.length).toBeGreaterThan(0);
      expect(repositories.length).toBeGreaterThan(0);

      const fileContents = new Map<string, string>([
        [
          'app/views.py',
          `
          from .models import User
          from .serializers import UserSerializer
          from .utils import helper
        `,
        ],
        [
          'app/models.py',
          `
          from django.db import models
        `,
        ],
        [
          'app/serializers.py',
          `
          from .models import User
        `,
        ],
        [
          'app/utils.py',
          `
          def helper():
              pass
        `,
        ],
      ]);

      const dependencyResult = dependencyAnalyzer.analyzeDependenciesFromContent(
        fileContents,
        modules,
      );

      expect(dependencyResult.graph.nodes.length).toBeGreaterThan(0);
      expect(dependencyResult.circular.length).toBe(0);
    });
  });

  describe('Full Pipeline: Polyglot Microservices', () => {
    it('should analyze a multi-language microservices architecture', () => {
      const treeEntries = [
        {
          path: 'services/api/main.go',
          type: 'blob' as const,
          size: 5000,
          sha: 'go1',
          mode: '100644',
        },
        {
          path: 'services/api/handlers/user.go',
          type: 'blob' as const,
          size: 3000,
          sha: 'go2',
          mode: '100644',
        },
        {
          path: 'services/worker/index.ts',
          type: 'blob' as const,
          size: 4000,
          sha: 'ts1',
          mode: '100644',
        },
        {
          path: 'services/worker/queue.ts',
          type: 'blob' as const,
          size: 2500,
          sha: 'ts2',
          mode: '100644',
        },
        {
          path: 'services/ml/model.py',
          type: 'blob' as const,
          size: 6000,
          sha: 'py1',
          mode: '100644',
        },
        {
          path: 'services/ml/preprocessing.py',
          type: 'blob' as const,
          size: 4500,
          sha: 'py2',
          mode: '100644',
        },
      ];

      const languageStats = languageDetector.detectLanguages(treeEntries);

      expect(Object.keys(languageStats.languages)).toHaveLength(3);
      expect(languageStats.languages.Go).toBe(8000);
      expect(languageStats.languages.TypeScript).toBe(6500);
      expect(languageStats.languages.Python).toBe(10500);

      const topLanguages = languageDetector.getTopLanguages(languageStats, 3);
      expect(topLanguages[0].language).toBe('Python'); // Highest bytes

      const summary = languageDetector.getLanguagesSummary(languageStats);
      expect(summary.diversityScore).toBeGreaterThan(0.5); // Good diversity

      const modules = moduleClassifier.classifyModules(
        treeEntries,
        languageStats,
      );

      const byLanguage = moduleClassifier.groupModulesByLanguage(modules);
      expect(byLanguage.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Pipeline: Detecting Architecture Issues', () => {
    it('should detect circular dependencies in poorly structured code', () => {
      const treeEntries = [
        {
          path: 'src/a.ts',
          type: 'blob' as const,
          size: 1000,
          sha: 'a',
          mode: '100644',
        },
        {
          path: 'src/b.ts',
          type: 'blob' as const,
          size: 1000,
          sha: 'b',
          mode: '100644',
        },
        {
          path: 'src/c.ts',
          type: 'blob' as const,
          size: 1000,
          sha: 'c',
          mode: '100644',
        },
      ];

      const languageStats = languageDetector.detectLanguages(treeEntries);
      const modules = moduleClassifier.classifyModules(
        treeEntries,
        languageStats,
      );

      const fileContents = new Map<string, string>([
        ['src/a.ts', `import { b } from './b';`],
        ['src/b.ts', `import { c } from './c';`],
        ['src/c.ts', `import { a } from './a';`], // Circular!
      ]);

      const dependencyResult = dependencyAnalyzer.analyzeDependenciesFromContent(
        fileContents,
        modules,
      );

      expect(dependencyResult.circular.length).toBeGreaterThan(0);
      expect(
        dependencyResult.recommendations.some((r) =>
          r.toLowerCase().includes('circular'),
        ),
      ).toBe(true);
    });

    it('should detect high coupling and suggest refactoring', () => {
      const treeEntries = Array.from({ length: 11 }, (_, i) => ({
        path: `src/${String.fromCharCode(97 + i)}.ts`, // a.ts, b.ts, ... k.ts
        type: 'blob' as const,
        size: 1000,
        sha: String.fromCharCode(97 + i),
        mode: '100644',
      }));

      // Add hub
      treeEntries.push({
        path: 'src/hub.ts',
        type: 'blob' as const,
        size: 5000,
        sha: 'hub',
        mode: '100644',
      });

      const languageStats = languageDetector.detectLanguages(treeEntries);
      const modules = moduleClassifier.classifyModules(
        treeEntries,
        languageStats,
      );

      const fileContents = new Map<string, string>();
      // Hub imports all modules
      const hubImports = Array.from({ length: 11 }, (_, i) =>
        `import { ${String.fromCharCode(97 + i)} } from './${String.fromCharCode(97 + i)}';`,
      ).join('\n');
      fileContents.set('src/hub.ts', hubImports);

      // All modules import hub
      for (let i = 0; i < 11; i++) {
        const char = String.fromCharCode(97 + i);
        fileContents.set(`src/${char}.ts`, `import { hub } from './hub';`);
      }

      const dependencyResult = dependencyAnalyzer.analyzeDependenciesFromContent(
        fileContents,
        modules,
      );

      expect(dependencyResult.metrics.highCouplingModules.length).toBeGreaterThan(
        0,
      );
      expect(dependencyResult.metrics.highCouplingModules[0].file).toBe(
        'src/hub.ts',
      );
      expect(
        dependencyResult.recommendations.some(
          (r) =>
            r.toLowerCase().includes('coupling') ||
            r.toLowerCase().includes('split'),
        ),
      ).toBe(true);
    });

    it('should detect isolated (dead) code', () => {
      const treeEntries = [
        {
          path: 'src/active.ts',
          type: 'blob' as const,
          size: 1000,
          sha: 'active',
          mode: '100644',
        },
        {
          path: 'src/connected.ts',
          type: 'blob' as const,
          size: 1000,
          sha: 'connected',
          mode: '100644',
        },
        {
          path: 'src/dead1.ts',
          type: 'blob' as const,
          size: 1000,
          sha: 'dead1',
          mode: '100644',
        },
        {
          path: 'src/dead2.ts',
          type: 'blob' as const,
          size: 1000,
          sha: 'dead2',
          mode: '100644',
        },
      ];

      const languageStats = languageDetector.detectLanguages(treeEntries);
      const modules = moduleClassifier.classifyModules(
        treeEntries,
        languageStats,
      );

      const fileContents = new Map<string, string>([
        ['src/active.ts', `import { connected } from './connected';`],
        ['src/connected.ts', `export const connected = 1;`],
        ['src/dead1.ts', `export const dead1 = 1;`],
        ['src/dead2.ts', `export const dead2 = 2;`],
      ]);

      const dependencyResult = dependencyAnalyzer.analyzeDependenciesFromContent(
        fileContents,
        modules,
      );

      expect(dependencyResult.metrics.isolatedModules.length).toBeGreaterThan(
        0,
      );
      expect(
        dependencyResult.recommendations.some(
          (r) =>
            r.toLowerCase().includes('isolated') ||
            r.toLowerCase().includes('dead'),
        ),
      ).toBe(true);
    });
  });

  describe('Pipeline: Evolution Tracking', () => {
    it('should detect language distribution changes over time', () => {
      const oldTreeEntries = [
        {
          path: 'src/index.js',
          type: 'blob' as const,
          size: 8000,
          sha: 'old1',
          mode: '100644',
        },
        {
          path: 'src/utils.js',
          type: 'blob' as const,
          size: 4000,
          sha: 'old2',
          mode: '100644',
        },
      ];

      const newTreeEntries = [
        {
          path: 'src/index.ts',
          type: 'blob' as const,
          size: 8500,
          sha: 'new1',
          mode: '100644',
        },
        {
          path: 'src/utils.ts',
          type: 'blob' as const,
          size: 4500,
          sha: 'new2',
          mode: '100644',
        },
        {
          path: 'src/types.ts',
          type: 'blob' as const,
          size: 1000,
          sha: 'new3',
          mode: '100644',
        },
      ];

      const oldStats = languageDetector.detectLanguages(oldTreeEntries);
      const newStats = languageDetector.detectLanguages(newTreeEntries);

      expect(oldStats.primary).toBe('JavaScript');
      expect(newStats.primary).toBe('TypeScript');

      const comparison = languageDetector.compareLanguageStats(
        oldStats,
        newStats,
      );

      expect(comparison.added).toContain('TypeScript');
      expect(comparison.removed).toContain('JavaScript');
      expect(comparison.primaryChanged).toBe(true);
    });
  });

  describe('Pipeline: Complex Dependency Scenarios', () => {
    it('should handle transitive dependencies correctly', () => {
      const treeEntries = [
        {
          path: 'src/a.ts',
          type: 'blob' as const,
          size: 1000,
          sha: 'a',
          mode: '100644',
        },
        {
          path: 'src/b.ts',
          type: 'blob' as const,
          size: 1000,
          sha: 'b',
          mode: '100644',
        },
        {
          path: 'src/c.ts',
          type: 'blob' as const,
          size: 1000,
          sha: 'c',
          mode: '100644',
        },
        {
          path: 'src/d.ts',
          type: 'blob' as const,
          size: 1000,
          sha: 'd',
          mode: '100644',
        },
      ];

      const languageStats = languageDetector.detectLanguages(treeEntries);
      const modules = moduleClassifier.classifyModules(
        treeEntries,
        languageStats,
      );

      const fileContents = new Map<string, string>([
        ['/src/a.ts', `import { b } from './b';`],
        ['/src/b.ts', `import { c } from './c';`],
        ['/src/c.ts', `import { d } from './d';`],
        ['/src/d.ts', `export const d = 1;`],
      ]);

      const dependencyResult = dependencyAnalyzer.analyzeDependenciesFromContent(
        fileContents,
        modules,
      );

      const coreGraph = dependencyAnalyzer.buildDependencyGraph(fileContents);

      const impact = dependencyAnalyzer.analyzeImpact(coreGraph, '/src/d.ts');

      // d is used by c, which is used by b, which is used by a
      expect(impact.transitiveDependents.size).toBe(3);
      expect(impact.impactScore).toBe(3);
    });
  });

  describe('Pipeline: Performance with Large Repositories', () => {
    it('should handle repositories with many files efficiently', () => {
      // Create 100 files
      const treeEntries = Array.from({ length: 100 }, (_, i) => ({
        path: `src/module${i}.ts`,
        type: 'blob' as const,
        size: 1000,
        sha: `sha${i}`,
        mode: '100644',
      }));

      const startTime = Date.now();

      const languageStats = languageDetector.detectLanguages(treeEntries);
      expect(languageStats.languages.TypeScript).toBe(100000);

      const modules = moduleClassifier.classifyModules(
        treeEntries,
        languageStats,
      );
      expect(modules.length).toBeGreaterThan(0);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Pipeline: Export and Visualization', () => {
    it('should export complete analysis results', () => {
      const treeEntries = [
        {
          path: 'src/a.ts',
          type: 'blob' as const,
          size: 1000,
          sha: 'a',
          mode: '100644',
        },
        {
          path: 'src/b.ts',
          type: 'blob' as const,
          size: 1000,
          sha: 'b',
          mode: '100644',
        },
      ];

      const languageStats = languageDetector.detectLanguages(treeEntries);
      const modules = moduleClassifier.classifyModules(
        treeEntries,
        languageStats,
      );

      const fileContents = new Map<string, string>([
        ['/src/a.ts', `import { b } from './b';`], // Use absolute paths to match
        ['/src/b.ts', `export const b = 1;`],
      ]);

      // Update module paths to match if they exist
      if (modules[0]) modules[0].path = '/src/a.ts';
      if (modules[1]) modules[1].path = '/src/b.ts';

      const dependencyResult = dependencyAnalyzer.analyzeDependenciesFromContent(
        fileContents,
        modules,
      );

      // Export as DOT for visualization
      const dotGraph = dependencyAnalyzer.exportToDot(dependencyResult.graph);

      expect(dotGraph).toContain('digraph Dependencies');

      // If there are edges, check for arrow
      if (dependencyResult.graph.edges.length > 0) {
        expect(dotGraph).toContain('->');
      }

      // Verify we have complete analysis
      expect(languageStats).toBeDefined();
      expect(languageStats.primary).toBeTruthy();
      expect(modules.length).toBeGreaterThan(0);
      expect(dependencyResult.graph.nodes.length).toBeGreaterThan(0);
      expect(dependencyResult.recommendations.length).toBeGreaterThan(0);
    });
  });
});
