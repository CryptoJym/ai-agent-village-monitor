import * as path from 'path';

export interface LanguageInfo {
  name: string;
  color: string;
  style: LanguageStyle;
  confidence: number;
}

export interface LanguageStyle {
  primaryColor: string;
  secondaryColor: string;
  icon?: string;
  gradient?: string;
}

export interface FileLanguageResult {
  filePath: string;
  language: string;
  confidence: number;
}

// Language color mappings based on GitHub's linguist
const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4F5D95',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Swift: '#ffac45',
  Kotlin: '#A97BFF',
  Scala: '#c22d40',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  React: '#61dafb',
  Markdown: '#083fa1',
  JSON: '#292929',
  YAML: '#cb171e',
  Shell: '#89e051',
  Dockerfile: '#384d54',
  SQL: '#e38c00',
};

// Language detection by file extension
const EXTENSION_MAP: Record<string, string> = {
  // JavaScript/TypeScript
  js: 'JavaScript',
  jsx: 'React',
  ts: 'TypeScript',
  tsx: 'React',
  mjs: 'JavaScript',
  cjs: 'JavaScript',

  // Python
  py: 'Python',
  pyw: 'Python',
  pyx: 'Python',

  // Java/JVM
  java: 'Java',
  kt: 'Kotlin',
  kts: 'Kotlin',
  scala: 'Scala',
  groovy: 'Groovy',

  // C/C++
  c: 'C',
  h: 'C',
  cpp: 'C++',
  cc: 'C++',
  cxx: 'C++',
  hpp: 'C++',
  hh: 'C++',
  hxx: 'C++',

  // C#
  cs: 'C#',
  csx: 'C#',

  // Go
  go: 'Go',

  // Rust
  rs: 'Rust',

  // Ruby
  rb: 'Ruby',
  erb: 'Ruby',

  // PHP
  php: 'PHP',
  phtml: 'PHP',

  // Swift
  swift: 'Swift',

  // Web
  html: 'HTML',
  htm: 'HTML',
  css: 'CSS',
  scss: 'CSS',
  sass: 'CSS',
  less: 'CSS',
  vue: 'Vue',
  svelte: 'Svelte',

  // Data/Config
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  md: 'Markdown',
  markdown: 'Markdown',

  // Shell
  sh: 'Shell',
  bash: 'Shell',
  zsh: 'Shell',
  fish: 'Shell',

  // Other
  sql: 'SQL',
  graphql: 'GraphQL',
  gql: 'GraphQL',
};

// Path-based language detection
const PATH_PATTERNS: Array<{ pattern: RegExp; language: string }> = [
  { pattern: /Dockerfile/, language: 'Dockerfile' },
  { pattern: /\.dockerfile$/i, language: 'Dockerfile' },
  { pattern: /Makefile/, language: 'Makefile' },
  { pattern: /\.mk$/, language: 'Makefile' },
  { pattern: /package\.json$/, language: 'JSON' },
  { pattern: /tsconfig.*\.json$/, language: 'JSON' },
  { pattern: /\.eslintrc/, language: 'JSON' },
  { pattern: /\.prettierrc/, language: 'JSON' },
];

export class LanguageDetector {
  detectLanguage(filePath: string): LanguageInfo {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const basename = path.basename(filePath);

    // Check path patterns first
    for (const { pattern, language } of PATH_PATTERNS) {
      if (pattern.test(basename) || pattern.test(filePath)) {
        return this.createLanguageInfo(language, 1.0);
      }
    }

    // Check extension
    const language = EXTENSION_MAP[ext];
    if (language) {
      return this.createLanguageInfo(language, 0.95);
    }

    // Default to unknown
    return this.createLanguageInfo('Unknown', 0.0);
  }

  detectPrimaryLanguage(files: string[]): LanguageInfo {
    const languageCounts: Record<string, number> = {};

    for (const file of files) {
      const { name, confidence } = this.detectLanguage(file);
      if (confidence > 0.5) {
        languageCounts[name] = (languageCounts[name] || 0) + 1;
      }
    }

    // Find the most common language
    let maxCount = 0;
    let primaryLanguage = 'Unknown';

    for (const [lang, count] of Object.entries(languageCounts)) {
      if (count > maxCount) {
        maxCount = count;
        primaryLanguage = lang;
      }
    }

    return this.createLanguageInfo(primaryLanguage, maxCount > 0 ? 1.0 : 0.0);
  }

  detectPrimaryLanguageFromStats(
    languageStats: Record<string, number>,
  ): LanguageInfo {
    let maxBytes = 0;
    let primaryLanguage = 'Unknown';

    for (const [lang, bytes] of Object.entries(languageStats)) {
      if (bytes > maxBytes) {
        maxBytes = bytes;
        primaryLanguage = lang;
      }
    }

    return this.createLanguageInfo(primaryLanguage, maxBytes > 0 ? 1.0 : 0.0);
  }

  classifyFiles(files: string[]): FileLanguageResult[] {
    return files.map((filePath) => {
      const { name, confidence } = this.detectLanguage(filePath);
      return {
        filePath,
        language: name,
        confidence,
      };
    });
  }

  getLanguageStats(files: string[]): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const file of files) {
      const { name, confidence } = this.detectLanguage(file);
      if (confidence > 0.5) {
        stats[name] = (stats[name] || 0) + 1;
      }
    }

    return stats;
  }

  private createLanguageInfo(language: string, confidence: number): LanguageInfo {
    const color = LANGUAGE_COLORS[language] || '#cccccc';
    const style = this.createLanguageStyle(language, color);

    return {
      name: language,
      color,
      style,
      confidence,
    };
  }

  private createLanguageStyle(language: string, color: string): LanguageStyle {
    // Generate complementary color for gradients
    const secondaryColor = this.adjustColor(color, -20);

    return {
      primaryColor: color,
      secondaryColor,
      gradient: `linear-gradient(135deg, ${color}, ${secondaryColor})`,
    };
  }

  private adjustColor(hex: string, percent: number): string {
    // Simple color adjustment
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + percent));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + percent));
    const b = Math.max(0, Math.min(255, (num & 0xff) + percent));

    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  getLanguageColor(language: string): string {
    return LANGUAGE_COLORS[language] || '#cccccc';
  }

  getSupportedLanguages(): string[] {
    return Object.keys(LANGUAGE_COLORS).sort();
  }

  isKnownLanguage(language: string): boolean {
    return language in LANGUAGE_COLORS;
  }
}

export const languageDetector = new LanguageDetector();
