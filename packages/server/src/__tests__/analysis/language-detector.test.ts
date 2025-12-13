import { describe, it, expect } from 'vitest';
import { LanguageDetector } from '../../analysis/language-detector';

describe('LanguageDetector', () => {
  const detector = new LanguageDetector();

  describe('detectLanguage', () => {
    describe('JavaScript/TypeScript', () => {
      it('should detect TypeScript files', () => {
        const result = detector.detectLanguage('src/utils/helper.ts');
        expect(result.name).toBe('TypeScript');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#3178c6');
      });

      it('should detect TSX (React TypeScript) files', () => {
        const result = detector.detectLanguage('src/components/Button.tsx');
        expect(result.name).toBe('React');
        expect(result.confidence).toBeGreaterThan(0.9);
      });

      it('should detect JavaScript files', () => {
        const result = detector.detectLanguage('src/index.js');
        expect(result.name).toBe('JavaScript');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#f1e05a');
      });

      it('should detect JSX (React) files', () => {
        const result = detector.detectLanguage('src/App.jsx');
        expect(result.name).toBe('React');
        expect(result.confidence).toBeGreaterThan(0.9);
      });

      it('should detect module JS files', () => {
        const result = detector.detectLanguage('src/module.mjs');
        expect(result.name).toBe('JavaScript');
        expect(result.confidence).toBeGreaterThan(0.9);
      });
    });

    describe('Python', () => {
      it('should detect Python files', () => {
        const result = detector.detectLanguage('src/main.py');
        expect(result.name).toBe('Python');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#3572A5');
      });

      it('should detect Python window files', () => {
        const result = detector.detectLanguage('scripts/windows.pyw');
        expect(result.name).toBe('Python');
        expect(result.confidence).toBeGreaterThan(0.9);
      });

      it('should detect Cython files', () => {
        const result = detector.detectLanguage('lib/optimized.pyx');
        expect(result.name).toBe('Python');
        expect(result.confidence).toBeGreaterThan(0.9);
      });
    });

    describe('Java/JVM Languages', () => {
      it('should detect Java files', () => {
        const result = detector.detectLanguage('src/Main.java');
        expect(result.name).toBe('Java');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#b07219');
      });

      it('should detect Kotlin files', () => {
        const result = detector.detectLanguage('src/MainActivity.kt');
        expect(result.name).toBe('Kotlin');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#A97BFF');
      });

      it('should detect Kotlin script files', () => {
        const result = detector.detectLanguage('build.gradle.kts');
        expect(result.name).toBe('Kotlin');
        expect(result.confidence).toBeGreaterThan(0.9);
      });

      it('should detect Scala files', () => {
        const result = detector.detectLanguage('src/App.scala');
        expect(result.name).toBe('Scala');
        expect(result.confidence).toBeGreaterThan(0.9);
      });
    });

    describe('C/C++', () => {
      it('should detect C files', () => {
        const result = detector.detectLanguage('src/main.c');
        expect(result.name).toBe('C');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#555555');
      });

      it('should detect C header files', () => {
        const result = detector.detectLanguage('include/types.h');
        expect(result.name).toBe('C');
        expect(result.confidence).toBeGreaterThan(0.9);
      });

      it('should detect C++ files', () => {
        const result = detector.detectLanguage('src/main.cpp');
        expect(result.name).toBe('C++');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#f34b7d');
      });

      it('should detect C++ header files', () => {
        const result = detector.detectLanguage('include/vector.hpp');
        expect(result.name).toBe('C++');
        expect(result.confidence).toBeGreaterThan(0.9);
      });
    });

    describe('Other Languages', () => {
      it('should detect Go files', () => {
        const result = detector.detectLanguage('cmd/server/main.go');
        expect(result.name).toBe('Go');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#00ADD8');
      });

      it('should detect Rust files', () => {
        const result = detector.detectLanguage('src/main.rs');
        expect(result.name).toBe('Rust');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#dea584');
      });

      it('should detect Ruby files', () => {
        const result = detector.detectLanguage('lib/server.rb');
        expect(result.name).toBe('Ruby');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#701516');
      });

      it('should detect PHP files', () => {
        const result = detector.detectLanguage('index.php');
        expect(result.name).toBe('PHP');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#4F5D95');
      });

      it('should detect Swift files', () => {
        const result = detector.detectLanguage('Sources/App.swift');
        expect(result.name).toBe('Swift');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#ffac45');
      });

      it('should detect C# files', () => {
        const result = detector.detectLanguage('Program.cs');
        expect(result.name).toBe('C#');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#178600');
      });
    });

    describe('Web Languages', () => {
      it('should detect HTML files', () => {
        const result = detector.detectLanguage('public/index.html');
        expect(result.name).toBe('HTML');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#e34c26');
      });

      it('should detect CSS files', () => {
        const result = detector.detectLanguage('styles/main.css');
        expect(result.name).toBe('CSS');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#563d7c');
      });

      it('should detect SCSS files', () => {
        const result = detector.detectLanguage('styles/theme.scss');
        expect(result.name).toBe('CSS');
        expect(result.confidence).toBeGreaterThan(0.9);
      });

      it('should detect Vue files', () => {
        const result = detector.detectLanguage('src/App.vue');
        expect(result.name).toBe('Vue');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#41b883');
      });

      it('should detect Svelte files', () => {
        const result = detector.detectLanguage('src/App.svelte');
        expect(result.name).toBe('Svelte');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.color).toBe('#ff3e00');
      });
    });

    describe('Config/Data files', () => {
      it('should detect JSON files', () => {
        const result = detector.detectLanguage('config.json');
        expect(result.name).toBe('JSON');
        expect(result.confidence).toBeGreaterThan(0.9);
      });

      it('should detect YAML files', () => {
        const result = detector.detectLanguage('.github/workflows/ci.yml');
        expect(result.name).toBe('YAML');
        expect(result.confidence).toBeGreaterThan(0.9);
      });

      it('should detect Markdown files', () => {
        const result = detector.detectLanguage('README.md');
        expect(result.name).toBe('Markdown');
        expect(result.confidence).toBeGreaterThan(0.9);
      });
    });

    describe('Special file patterns', () => {
      it('should detect Dockerfile', () => {
        const result = detector.detectLanguage('Dockerfile');
        expect(result.name).toBe('Dockerfile');
        expect(result.confidence).toBe(1.0);
      });

      it('should detect Dockerfile with suffix', () => {
        const result = detector.detectLanguage('Dockerfile.prod');
        expect(result.name).toBe('Dockerfile');
        expect(result.confidence).toBe(1.0);
      });

      it('should detect Makefile', () => {
        const result = detector.detectLanguage('Makefile');
        expect(result.name).toBe('Makefile');
        expect(result.confidence).toBe(1.0);
      });

      it('should detect package.json', () => {
        const result = detector.detectLanguage('package.json');
        expect(result.name).toBe('JSON');
        expect(result.confidence).toBe(1.0);
      });
    });

    describe('Unknown files', () => {
      it('should return Unknown for files without extension', () => {
        const result = detector.detectLanguage('LICENSE');
        expect(result.name).toBe('Unknown');
        expect(result.confidence).toBe(0);
      });

      it('should return Unknown for unrecognized extensions', () => {
        const result = detector.detectLanguage('file.xyz');
        expect(result.name).toBe('Unknown');
        expect(result.confidence).toBe(0);
      });
    });
  });

  describe('detectPrimaryLanguage', () => {
    it('should detect primary language from file list', () => {
      const files = [
        'src/index.ts',
        'src/utils.ts',
        'src/types.ts',
        'src/main.py',
        'README.md',
      ];

      const result = detector.detectPrimaryLanguage(files);
      expect(result.name).toBe('TypeScript');
      expect(result.confidence).toBe(1.0);
    });

    it('should handle mixed language files', () => {
      const files = [
        'src/index.js',
        'src/utils.js',
        'lib/helper.py',
        'lib/db.py',
        'lib/models.py',
      ];

      const result = detector.detectPrimaryLanguage(files);
      expect(result.name).toBe('Python'); // 3 Python files vs 2 JS
      expect(result.confidence).toBe(1.0);
    });

    it('should return Unknown for empty file list', () => {
      const result = detector.detectPrimaryLanguage([]);
      expect(result.name).toBe('Unknown');
      expect(result.confidence).toBe(0);
    });
  });

  describe('detectPrimaryLanguageFromStats', () => {
    it('should detect primary language from byte stats', () => {
      const stats = {
        TypeScript: 50000,
        JavaScript: 20000,
        Python: 10000,
      };

      const result = detector.detectPrimaryLanguageFromStats(stats);
      expect(result.name).toBe('TypeScript');
      expect(result.confidence).toBe(1.0);
    });

    it('should return Unknown for empty stats', () => {
      const result = detector.detectPrimaryLanguageFromStats({});
      expect(result.name).toBe('Unknown');
      expect(result.confidence).toBe(0);
    });
  });

  describe('classifyFiles', () => {
    it('should classify multiple files', () => {
      const files = [
        'src/index.ts',
        'src/App.tsx',
        'lib/utils.py',
        'main.go',
      ];

      const results = detector.classifyFiles(files);

      expect(results).toHaveLength(4);
      expect(results[0].language).toBe('TypeScript');
      expect(results[1].language).toBe('React');
      expect(results[2].language).toBe('Python');
      expect(results[3].language).toBe('Go');
    });
  });

  describe('getLanguageStats', () => {
    it('should calculate language statistics', () => {
      const files = [
        'src/a.ts',
        'src/b.ts',
        'src/c.ts',
        'lib/x.py',
        'lib/y.py',
        'main.go',
      ];

      const stats = detector.getLanguageStats(files);

      expect(stats.TypeScript).toBe(3);
      expect(stats.Python).toBe(2);
      expect(stats.Go).toBe(1);
    });

    it('should ignore unknown files', () => {
      const files = ['src/a.ts', 'LICENSE', 'file.xyz'];

      const stats = detector.getLanguageStats(files);

      expect(stats.TypeScript).toBe(1);
      expect(stats.Unknown).toBeUndefined();
    });
  });

  describe('Language style and colors', () => {
    it('should provide language style with gradient', () => {
      const result = detector.detectLanguage('src/main.ts');

      expect(result.style).toBeDefined();
      expect(result.style.primaryColor).toBe('#3178c6');
      expect(result.style.secondaryColor).toBeDefined();
      expect(result.style.gradient).toContain('linear-gradient');
    });

    it('should provide default color for unknown languages', () => {
      const result = detector.detectLanguage('file.xyz');

      expect(result.color).toBe('#cccccc');
    });
  });

  describe('getLanguageColor', () => {
    it('should return correct color for known languages', () => {
      expect(detector.getLanguageColor('TypeScript')).toBe('#3178c6');
      expect(detector.getLanguageColor('Python')).toBe('#3572A5');
      expect(detector.getLanguageColor('Go')).toBe('#00ADD8');
    });

    it('should return default color for unknown language', () => {
      expect(detector.getLanguageColor('UnknownLang')).toBe('#cccccc');
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return sorted list of supported languages', () => {
      const languages = detector.getSupportedLanguages();

      expect(languages.length).toBeGreaterThan(0);
      expect(languages).toContain('TypeScript');
      expect(languages).toContain('Python');
      expect(languages).toContain('JavaScript');

      // Check if sorted
      const sorted = [...languages].sort();
      expect(languages).toEqual(sorted);
    });
  });

  describe('isKnownLanguage', () => {
    it('should return true for known languages', () => {
      expect(detector.isKnownLanguage('TypeScript')).toBe(true);
      expect(detector.isKnownLanguage('Python')).toBe(true);
      expect(detector.isKnownLanguage('Go')).toBe(true);
    });

    it('should return false for unknown languages', () => {
      expect(detector.isKnownLanguage('UnknownLang')).toBe(false);
      expect(detector.isKnownLanguage('RandomLanguage')).toBe(false);
    });
  });
});
