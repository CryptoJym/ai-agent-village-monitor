import * as path from 'path';

export enum ModuleType {
  COMPONENT = 'component',
  SERVICE = 'service',
  REPOSITORY = 'repository',
  CONTROLLER = 'controller',
  UTILITY = 'utility',
  CONFIG = 'config',
  TYPE_DEF = 'type_def',
  TEST = 'test',
  ASSET = 'asset',
  ROOT = 'root',
  UNKNOWN = 'unknown',
}

export interface ModuleClassification {
  type: ModuleType;
  confidence: number;
  reason: string;
}

export interface ClassificationRule {
  type: ModuleType;
  patterns: Array<{
    test: RegExp | ((filePath: string, basename: string, ext: string) => boolean);
    confidence: number;
    reason: string;
  }>;
}

export class ModuleClassifier {
  private rules: ClassificationRule[];

  constructor() {
    this.rules = this.initializeRules();
  }

  classify(filePath: string): ModuleClassification {
    const basename = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const normalizedPath = filePath.toLowerCase();

    // Check each rule in order of priority
    for (const rule of this.rules) {
      for (const pattern of rule.patterns) {
        let matches = false;

        if (pattern.test instanceof RegExp) {
          matches = pattern.test.test(normalizedPath) || pattern.test.test(basename);
        } else if (typeof pattern.test === 'function') {
          matches = pattern.test(normalizedPath, basename, ext);
        }

        if (matches) {
          return {
            type: rule.type,
            confidence: pattern.confidence,
            reason: pattern.reason,
          };
        }
      }
    }

    return {
      type: ModuleType.UNKNOWN,
      confidence: 0,
      reason: 'No matching classification rule found',
    };
  }

  classifyBatch(filePaths: string[]): Map<string, ModuleClassification> {
    const results = new Map<string, ModuleClassification>();

    for (const filePath of filePaths) {
      results.set(filePath, this.classify(filePath));
    }

    return results;
  }

  getModulesByType(filePaths: string[]): Map<ModuleType, string[]> {
    const modulesByType = new Map<ModuleType, string[]>();

    for (const filePath of filePaths) {
      const classification = this.classify(filePath);
      const existing = modulesByType.get(classification.type) || [];
      existing.push(filePath);
      modulesByType.set(classification.type, existing);
    }

    return modulesByType;
  }

  getStatistics(filePaths: string[]): {
    totalFiles: number;
    byType: Record<ModuleType, number>;
    averageConfidence: number;
  } {
    const byType: Record<ModuleType, number> = {} as any;
    let totalConfidence = 0;

    for (const filePath of filePaths) {
      const classification = this.classify(filePath);
      byType[classification.type] = (byType[classification.type] || 0) + 1;
      totalConfidence += classification.confidence;
    }

    return {
      totalFiles: filePaths.length,
      byType,
      averageConfidence: filePaths.length > 0 ? totalConfidence / filePaths.length : 0,
    };
  }

  private initializeRules(): ClassificationRule[] {
    return [
      // Test files (highest priority)
      {
        type: ModuleType.TEST,
        patterns: [
          {
            test: /\.(test|spec)\.(ts|tsx|js|jsx|py|java|go|rs)$/,
            confidence: 1.0,
            reason: 'File has test extension pattern',
          },
          {
            test: /__tests__\//,
            confidence: 1.0,
            reason: 'File is in __tests__ directory',
          },
          {
            test: /(^|\/)(test|tests|spec|specs)\//,
            confidence: 0.95,
            reason: 'File is in test directory',
          },
          {
            test: /_test\.(py|go)$/,
            confidence: 1.0,
            reason: 'Python/Go test file pattern',
          },
        ],
      },

      // Config files
      {
        type: ModuleType.CONFIG,
        patterns: [
          {
            test: /\.(config|conf)\.(ts|js|json|yaml|yml|toml)$/,
            confidence: 1.0,
            reason: 'Config file extension',
          },
          {
            test: /^(\.env|\.eslintrc|\.prettierrc|tsconfig|jest\.config|vite\.config|webpack\.config)/,
            confidence: 1.0,
            reason: 'Common config file pattern',
          },
          {
            test: /\/(config|configuration)\//,
            confidence: 0.9,
            reason: 'File is in config directory',
          },
          {
            test: /settings\.(py|json|yaml|toml)$/,
            confidence: 0.95,
            reason: 'Settings file pattern',
          },
        ],
      },

      // Type definitions
      {
        type: ModuleType.TYPE_DEF,
        patterns: [
          {
            test: /\.d\.ts$/,
            confidence: 1.0,
            reason: 'TypeScript declaration file',
          },
          {
            test: /\/(types|@types|interfaces|models\/types)\//,
            confidence: 0.95,
            reason: 'File is in types directory',
          },
          {
            test: /(types|interfaces)\.(ts|tsx)$/,
            confidence: 0.9,
            reason: 'Types/interfaces file pattern',
          },
        ],
      },

      // Components (React, Vue, Svelte)
      {
        type: ModuleType.COMPONENT,
        patterns: [
          {
            test: /\/(components|ui|widgets)\//,
            confidence: 0.95,
            reason: 'File is in components directory',
          },
          {
            test: /\.(vue|svelte)$/,
            confidence: 1.0,
            reason: 'Vue or Svelte component file',
          },
          {
            test: (path, basename, ext) => {
              return (
                (ext === '.tsx' || ext === '.jsx') &&
                /^[A-Z]/.test(basename) &&
                path.includes('component')
              );
            },
            confidence: 0.9,
            reason: 'React component pattern (PascalCase in components dir)',
          },
        ],
      },

      // Controllers/Routes
      {
        type: ModuleType.CONTROLLER,
        patterns: [
          {
            test: /\.(controller|route|router|handler)\.(ts|js|py|java|go|rs)$/,
            confidence: 1.0,
            reason: 'Controller/route file extension pattern',
          },
          {
            test: /\/(controllers|routes|handlers|endpoints|api)\//,
            confidence: 0.95,
            reason: 'File is in controllers/routes directory',
          },
          {
            test: /views\.py$/,
            confidence: 0.9,
            reason: 'Django views file',
          },
        ],
      },

      // Services
      {
        type: ModuleType.SERVICE,
        patterns: [
          {
            test: /\.(service|provider|manager)\.(ts|js|py|java|go|rs)$/,
            confidence: 1.0,
            reason: 'Service file extension pattern',
          },
          {
            test: /\/(services|providers|managers|business|domain)\//,
            confidence: 0.95,
            reason: 'File is in services directory',
          },
        ],
      },

      // Repository/Data access
      {
        type: ModuleType.REPOSITORY,
        patterns: [
          {
            test: /\.(repository|repo|dao|mapper)\.(ts|js|py|java|go|rs)$/,
            confidence: 1.0,
            reason: 'Repository file extension pattern',
          },
          {
            test: /\/(repositories|repos|dao|data|persistence|db)\//,
            confidence: 0.95,
            reason: 'File is in repository/data directory',
          },
          {
            test: /\/(models|entities|schemas)\//,
            confidence: 0.85,
            reason: 'File is in models/entities directory',
          },
          {
            test: /models\.py$/,
            confidence: 0.9,
            reason: 'Django/SQLAlchemy models file',
          },
        ],
      },

      // Utilities
      {
        type: ModuleType.UTILITY,
        patterns: [
          {
            test: /\.(util|helper|utils|helpers|lib)\.(ts|js|py|java|go|rs)$/,
            confidence: 1.0,
            reason: 'Utility file extension pattern',
          },
          {
            test: /\/(utils|helpers|utilities|lib|common|shared)\//,
            confidence: 0.95,
            reason: 'File is in utilities directory',
          },
        ],
      },

      // Assets
      {
        type: ModuleType.ASSET,
        patterns: [
          {
            test: /\.(png|jpg|jpeg|gif|svg|ico|webp|mp4|webm|mp3|wav|woff|woff2|ttf|eot)$/,
            confidence: 1.0,
            reason: 'Asset file extension',
          },
          {
            test: /\/(public|static|assets|media|images|fonts)\//,
            confidence: 0.95,
            reason: 'File is in assets directory',
          },
          {
            test: /\.(css|scss|sass|less)$/,
            confidence: 0.9,
            reason: 'Stylesheet file',
          },
        ],
      },

      // Root files
      {
        type: ModuleType.ROOT,
        patterns: [
          {
            test: /^(package\.json|cargo\.toml|go\.mod|pom\.xml|build\.gradle|requirements\.txt|setup\.py|readme\.md)$/i,
            confidence: 1.0,
            reason: 'Root project file',
          },
          {
            test: (path) => {
              const depth = path.split('/').length;
              return depth <= 2 && /\.(md|txt|json|yaml|toml)$/i.test(path);
            },
            confidence: 0.8,
            reason: 'Top-level documentation or config file',
          },
        ],
      },
    ];
  }
}

export const moduleClassifier = new ModuleClassifier();
