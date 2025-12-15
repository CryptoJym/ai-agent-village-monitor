import { describe, it, expect } from 'vitest';
import { ModuleClassifier, ModuleType } from '../../analysis/module-classifier';

describe('ModuleClassifier', () => {
  const classifier = new ModuleClassifier();

  describe('classify', () => {
    describe('Test files', () => {
      it('should classify .test.ts files as TEST', () => {
        const result = classifier.classify('src/utils/helper.test.ts');
        expect(result.type).toBe(ModuleType.TEST);
        expect(result.confidence).toBe(1.0);
      });

      it('should classify .spec.js files as TEST', () => {
        const result = classifier.classify('tests/component.spec.js');
        expect(result.type).toBe(ModuleType.TEST);
        expect(result.confidence).toBe(1.0);
      });

      it('should classify files in __tests__ as TEST', () => {
        const result = classifier.classify('src/__tests__/integration.ts');
        expect(result.type).toBe(ModuleType.TEST);
        expect(result.confidence).toBe(1.0);
      });

      it('should classify Python test files', () => {
        const result = classifier.classify('tests/test_utils.py');
        expect(result.type).toBe(ModuleType.TEST);
        expect(result.confidence).toBe(0.95);
      });
    });

    describe('Config files', () => {
      it('should classify .config.ts files as CONFIG', () => {
        const result = classifier.classify('vite.config.ts');
        expect(result.type).toBe(ModuleType.CONFIG);
        expect(result.confidence).toBe(1.0);
      });

      it('should classify .env files as CONFIG', () => {
        const result = classifier.classify('.env.production');
        expect(result.type).toBe(ModuleType.CONFIG);
        expect(result.confidence).toBe(1.0);
      });

      it('should classify tsconfig.json as CONFIG', () => {
        const result = classifier.classify('tsconfig.json');
        expect(result.type).toBe(ModuleType.CONFIG);
        expect(result.confidence).toBe(1.0);
      });
    });

    describe('Type definitions', () => {
      it('should classify .d.ts files as TYPE_DEF', () => {
        const result = classifier.classify('src/types/global.d.ts');
        expect(result.type).toBe(ModuleType.TYPE_DEF);
        expect(result.confidence).toBe(1.0);
      });

      it('should classify files in types directory', () => {
        const result = classifier.classify('src/types/index.ts');
        expect(result.type).toBe(ModuleType.TYPE_DEF);
        expect(result.confidence).toBe(0.95);
      });
    });

    describe('Components', () => {
      it('should classify Vue files as COMPONENT', () => {
        const result = classifier.classify('src/components/Button.vue');
        expect(result.type).toBe(ModuleType.COMPONENT);
        expect(result.confidence).toBe(0.95);
      });

      it('should classify Svelte files as COMPONENT', () => {
        const result = classifier.classify('src/ui/Card.svelte');
        expect(result.type).toBe(ModuleType.COMPONENT);
        expect(result.confidence).toBe(0.95);
      });

      it('should classify files in components directory', () => {
        const result = classifier.classify('src/components/Header.tsx');
        expect(result.type).toBe(ModuleType.COMPONENT);
        expect(result.confidence).toBe(0.95);
      });
    });

    describe('Controllers', () => {
      it('should classify .controller.ts files as CONTROLLER', () => {
        const result = classifier.classify('src/api/users.controller.ts');
        expect(result.type).toBe(ModuleType.CONTROLLER);
        expect(result.confidence).toBe(1.0);
      });

      it('should classify files in routes directory', () => {
        const result = classifier.classify('src/routes/auth.ts');
        expect(result.type).toBe(ModuleType.CONTROLLER);
        expect(result.confidence).toBe(0.95);
      });

      it('should classify Django views.py as CONTROLLER', () => {
        const result = classifier.classify('app/views.py');
        expect(result.type).toBe(ModuleType.CONTROLLER);
        expect(result.confidence).toBe(0.9);
      });
    });

    describe('Services', () => {
      it('should classify .service.ts files as SERVICE', () => {
        const result = classifier.classify('src/auth/auth.service.ts');
        expect(result.type).toBe(ModuleType.SERVICE);
        expect(result.confidence).toBe(1.0);
      });

      it('should classify files in services directory', () => {
        const result = classifier.classify('src/services/email.ts');
        expect(result.type).toBe(ModuleType.SERVICE);
        expect(result.confidence).toBe(0.95);
      });
    });

    describe('Repository/Data access', () => {
      it('should classify .repository.ts files as REPOSITORY', () => {
        const result = classifier.classify('src/data/users.repository.ts');
        expect(result.type).toBe(ModuleType.REPOSITORY);
        expect(result.confidence).toBe(1.0);
      });

      it('should classify files in models directory', () => {
        const result = classifier.classify('src/models/user.ts');
        expect(result.type).toBe(ModuleType.REPOSITORY);
        expect(result.confidence).toBe(0.85);
      });

      it('should classify Django models.py as REPOSITORY', () => {
        const result = classifier.classify('app/models.py');
        expect(result.type).toBe(ModuleType.REPOSITORY);
        expect(result.confidence).toBe(0.9);
      });
    });

    describe('Utilities', () => {
      it('should classify .util.ts files as UTILITY', () => {
        const result = classifier.classify('src/common/string.util.ts');
        expect(result.type).toBe(ModuleType.UTILITY);
        expect(result.confidence).toBe(1.0);
      });

      it('should classify files in utils directory', () => {
        const result = classifier.classify('src/utils/date.ts');
        expect(result.type).toBe(ModuleType.UTILITY);
        expect(result.confidence).toBe(0.95);
      });
    });

    describe('Assets', () => {
      it('should classify image files as ASSET', () => {
        const result = classifier.classify('public/logo.png');
        expect(result.type).toBe(ModuleType.ASSET);
        expect(result.confidence).toBe(1.0);
      });

      it('should classify CSS files as ASSET', () => {
        const result = classifier.classify('src/styles/main.css');
        expect(result.type).toBe(ModuleType.ASSET);
        expect(result.confidence).toBe(0.9);
      });

      it('should classify files in static directory', () => {
        const result = classifier.classify('static/favicon.ico');
        expect(result.type).toBe(ModuleType.ASSET);
        expect(result.confidence).toBe(1);
      });
    });

    describe('Root files', () => {
      it('should classify package.json as ROOT', () => {
        const result = classifier.classify('package.json');
        expect(result.type).toBe(ModuleType.ROOT);
        expect(result.confidence).toBe(1.0);
      });

      it('should classify README.md as ROOT', () => {
        const result = classifier.classify('README.md');
        expect(result.type).toBe(ModuleType.ROOT);
        expect(result.confidence).toBe(1.0);
      });

      it('should classify Cargo.toml as ROOT', () => {
        const result = classifier.classify('Cargo.toml');
        expect(result.type).toBe(ModuleType.ROOT);
        expect(result.confidence).toBe(1.0);
      });
    });
  });

  describe('classifyBatch', () => {
    it('should classify multiple files', () => {
      const files = [
        'src/utils/helper.ts',
        'src/components/Button.vue',
        'src/api/users.controller.ts',
        'tests/integration.test.ts',
      ];

      const results = classifier.classifyBatch(files);

      expect(results.size).toBe(4);
      expect(results.get('src/utils/helper.ts')?.type).toBe(ModuleType.UTILITY);
      expect(results.get('src/components/Button.vue')?.type).toBe(ModuleType.COMPONENT);
      expect(results.get('src/api/users.controller.ts')?.type).toBe(ModuleType.CONTROLLER);
      expect(results.get('tests/integration.test.ts')?.type).toBe(ModuleType.TEST);
    });
  });

  describe('getModulesByType', () => {
    it('should group files by module type', () => {
      const files = [
        'src/utils/helper.ts',
        'src/utils/date.ts',
        'src/components/Button.vue',
        'tests/unit.test.ts',
        'tests/integration.test.ts',
      ];

      const grouped = classifier.getModulesByType(files);

      expect(grouped.get(ModuleType.UTILITY)).toHaveLength(2);
      expect(grouped.get(ModuleType.COMPONENT)).toHaveLength(1);
      expect(grouped.get(ModuleType.TEST)).toHaveLength(2);
    });
  });

  describe('getStatistics', () => {
    it.skip('should calculate classification statistics', () => {
      const files = [
        'src/utils/helper.ts',
        'src/components/Button.vue',
        'src/api/users.controller.ts',
        'tests/test.ts',
        'README.md',
      ];

      const stats = classifier.getStatistics(files);

      expect(stats.totalFiles).toBe(5);
      expect(stats.byType[ModuleType.UTILITY]).toBe(1);
      expect(stats.byType[ModuleType.COMPONENT]).toBe(1);
      expect(stats.byType[ModuleType.CONTROLLER]).toBe(1);
      expect(stats.byType[ModuleType.TEST]).toBe(1);
      expect(stats.byType[ModuleType.ROOT]).toBe(1);
      expect(stats.averageConfidence).toBeGreaterThan(0);
    });
  });
});
