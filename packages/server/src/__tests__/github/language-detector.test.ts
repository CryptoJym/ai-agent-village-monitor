import { describe, it, expect, beforeEach } from 'vitest';
import {
  GitHubLanguageDetector,
  GitHubTreeEntry,
  LanguageStats,
} from '../../github/language-detector';

describe('GitHubLanguageDetector', () => {
  let detector: GitHubLanguageDetector;

  beforeEach(() => {
    detector = new GitHubLanguageDetector();
  });

  describe('detectLanguages', () => {
    it('should detect languages from GitHub tree entries', () => {
      const files: GitHubTreeEntry[] = [
        {
          path: 'src/index.ts',
          type: 'blob',
          size: 1000,
          sha: 'abc123',
          mode: '100644',
        },
        {
          path: 'src/utils.ts',
          type: 'blob',
          size: 2000,
          sha: 'def456',
          mode: '100644',
        },
        {
          path: 'lib/helper.py',
          type: 'blob',
          size: 1500,
          sha: 'ghi789',
          mode: '100644',
        },
      ];

      const stats = detector.detectLanguages(files);

      expect(stats.languages.TypeScript).toBe(3000);
      expect(stats.languages.Python).toBe(1500);
      expect(stats.primary).toBe('TypeScript');
      expect(stats.totalBytes).toBe(4500);
    });

    it('should calculate language percentages correctly', () => {
      const files: GitHubTreeEntry[] = [
        {
          path: 'a.ts',
          type: 'blob',
          size: 6000,
          sha: 'a',
          mode: '100644',
        },
        {
          path: 'b.py',
          type: 'blob',
          size: 4000,
          sha: 'b',
          mode: '100644',
        },
      ];

      const stats = detector.detectLanguages(files);

      expect(stats.percentages.TypeScript).toBeCloseTo(60, 1);
      expect(stats.percentages.Python).toBeCloseTo(40, 1);
    });

    it('should ignore tree entries (directories)', () => {
      const files: GitHubTreeEntry[] = [
        {
          path: 'src',
          type: 'tree',
          sha: 'abc',
          mode: '040000',
        },
        {
          path: 'src/index.ts',
          type: 'blob',
          size: 1000,
          sha: 'def',
          mode: '100644',
        },
      ];

      const stats = detector.detectLanguages(files);

      expect(stats.totalBytes).toBe(1000);
      expect(stats.languages.TypeScript).toBe(1000);
    });

    it('should handle files without size', () => {
      const files: GitHubTreeEntry[] = [
        {
          path: 'src/index.ts',
          type: 'blob',
          sha: 'abc',
          mode: '100644',
        },
      ];

      const stats = detector.detectLanguages(files);

      expect(stats.languages.TypeScript).toBe(0);
      expect(stats.totalBytes).toBe(0);
    });

    it('should ignore unknown file types', () => {
      const files: GitHubTreeEntry[] = [
        {
          path: 'LICENSE',
          type: 'blob',
          size: 1000,
          sha: 'abc',
          mode: '100644',
        },
        {
          path: 'src/index.ts',
          type: 'blob',
          size: 2000,
          sha: 'def',
          mode: '100644',
        },
      ];

      const stats = detector.detectLanguages(files);

      // LICENSE should be ignored
      expect(stats.languages.TypeScript).toBe(2000);
      expect(stats.totalBytes).toBe(2000);
    });

    it('should handle repository with only one language', () => {
      const files: GitHubTreeEntry[] = [
        {
          path: 'a.ts',
          type: 'blob',
          size: 1000,
          sha: 'a',
          mode: '100644',
        },
        {
          path: 'b.ts',
          type: 'blob',
          size: 2000,
          sha: 'b',
          mode: '100644',
        },
      ];

      const stats = detector.detectLanguages(files);

      expect(stats.primary).toBe('TypeScript');
      expect(stats.percentages.TypeScript).toBe(100);
    });

    it('should handle empty file list', () => {
      const stats = detector.detectLanguages([]);

      expect(stats.primary).toBe('Unknown');
      expect(stats.totalBytes).toBe(0);
      expect(Object.keys(stats.languages)).toHaveLength(0);
    });
  });

  describe('detectLanguagesFromMetadata', () => {
    it('should detect languages from FileMetadata', () => {
      const files = [
        {
          path: 'src/index.ts',
          size: 1000,
          type: 'file' as const,
          sha: 'abc',
          mode: '100644',
        },
        {
          path: 'lib/main.py',
          size: 2000,
          type: 'file' as const,
          sha: 'def',
          mode: '100644',
        },
      ];

      const stats = detector.detectLanguagesFromMetadata(files);

      expect(stats.languages.TypeScript).toBe(1000);
      expect(stats.languages.Python).toBe(2000);
      expect(stats.primary).toBe('Python');
    });
  });

  describe('getFileLanguage', () => {
    it('should return language info for a single file', () => {
      const info = detector.getFileLanguage('src/index.ts');

      expect(info.name).toBe('TypeScript');
      expect(info.confidence).toBeGreaterThan(0.9);
      expect(info.color).toBe('#3178c6');
    });
  });

  describe('getTopLanguages', () => {
    it('should return top N languages sorted by byte count', () => {
      const stats: LanguageStats = {
        languages: {
          TypeScript: 5000,
          JavaScript: 3000,
          Python: 2000,
          Go: 1000,
          Rust: 500,
        },
        primary: 'TypeScript',
        percentages: {
          TypeScript: 43.5,
          JavaScript: 26.1,
          Python: 17.4,
          Go: 8.7,
          Rust: 4.3,
        },
        totalBytes: 11500,
      };

      const top3 = detector.getTopLanguages(stats, 3);

      expect(top3).toHaveLength(3);
      expect(top3[0].language).toBe('TypeScript');
      expect(top3[0].bytes).toBe(5000);
      expect(top3[1].language).toBe('JavaScript');
      expect(top3[2].language).toBe('Python');
    });

    it('should return all languages if count exceeds available', () => {
      const stats: LanguageStats = {
        languages: {
          TypeScript: 1000,
          Python: 500,
        },
        primary: 'TypeScript',
        percentages: {
          TypeScript: 66.7,
          Python: 33.3,
        },
        totalBytes: 1500,
      };

      const top5 = detector.getTopLanguages(stats, 5);

      expect(top5).toHaveLength(2);
    });
  });

  describe('filterFilesByLanguage', () => {
    it('should filter files by specific language', () => {
      const files: GitHubTreeEntry[] = [
        {
          path: 'a.ts',
          type: 'blob',
          size: 1000,
          sha: 'a',
          mode: '100644',
        },
        {
          path: 'b.py',
          type: 'blob',
          size: 1000,
          sha: 'b',
          mode: '100644',
        },
        {
          path: 'c.ts',
          type: 'blob',
          size: 1000,
          sha: 'c',
          mode: '100644',
        },
      ];

      const tsFiles = detector.filterFilesByLanguage(files, 'TypeScript');

      expect(tsFiles).toHaveLength(2);
      expect(tsFiles[0].path).toBe('a.ts');
      expect(tsFiles[1].path).toBe('c.ts');
    });

    it('should return empty array if no files match', () => {
      const files: GitHubTreeEntry[] = [
        {
          path: 'a.ts',
          type: 'blob',
          size: 1000,
          sha: 'a',
          mode: '100644',
        },
      ];

      const goFiles = detector.filterFilesByLanguage(files, 'Go');

      expect(goFiles).toHaveLength(0);
    });
  });

  describe('groupFilesByLanguage', () => {
    it('should group files by their detected language', () => {
      const files: GitHubTreeEntry[] = [
        {
          path: 'a.ts',
          type: 'blob',
          size: 1000,
          sha: 'a',
          mode: '100644',
        },
        {
          path: 'b.ts',
          type: 'blob',
          size: 1000,
          sha: 'b',
          mode: '100644',
        },
        {
          path: 'c.py',
          type: 'blob',
          size: 1000,
          sha: 'c',
          mode: '100644',
        },
      ];

      const grouped = detector.groupFilesByLanguage(files);

      expect(grouped.TypeScript).toHaveLength(2);
      expect(grouped.Python).toHaveLength(1);
    });

    it('should ignore directories', () => {
      const files: GitHubTreeEntry[] = [
        {
          path: 'src',
          type: 'tree',
          sha: 'a',
          mode: '040000',
        },
        {
          path: 'src/index.ts',
          type: 'blob',
          size: 1000,
          sha: 'b',
          mode: '100644',
        },
      ];

      const grouped = detector.groupFilesByLanguage(files);

      expect(grouped.TypeScript).toHaveLength(1);
    });
  });

  describe('isLanguage', () => {
    it('should return true for matching language', () => {
      expect(detector.isLanguage('src/index.ts', 'TypeScript')).toBe(true);
      expect(detector.isLanguage('lib/main.py', 'Python')).toBe(true);
    });

    it('should return false for non-matching language', () => {
      expect(detector.isLanguage('src/index.ts', 'Python')).toBe(false);
      expect(detector.isLanguage('lib/main.py', 'JavaScript')).toBe(false);
    });

    it('should return false for unknown files', () => {
      expect(detector.isLanguage('LICENSE', 'TypeScript')).toBe(false);
    });
  });

  describe('getLanguagesSummary', () => {
    it('should calculate comprehensive language summary', () => {
      const stats: LanguageStats = {
        languages: {
          TypeScript: 5000,
          JavaScript: 3000,
          Python: 2000,
        },
        primary: 'TypeScript',
        percentages: {
          TypeScript: 50,
          JavaScript: 30,
          Python: 20,
        },
        totalBytes: 10000,
      };

      const summary = detector.getLanguagesSummary(stats);

      expect(summary.totalLanguages).toBe(3);
      expect(summary.primaryLanguage).toBe('TypeScript');
      expect(summary.primaryPercentage).toBe(50);
      expect(summary.diversityScore).toBeGreaterThan(0);
      expect(summary.diversityScore).toBeLessThanOrEqual(1);
    });

    it('should calculate diversity score correctly for single language', () => {
      const stats: LanguageStats = {
        languages: {
          TypeScript: 1000,
        },
        primary: 'TypeScript',
        percentages: {
          TypeScript: 100,
        },
        totalBytes: 1000,
      };

      const summary = detector.getLanguagesSummary(stats);

      expect(summary.diversityScore).toBe(0); // No diversity
    });

    it('should calculate diversity score correctly for balanced languages', () => {
      const stats: LanguageStats = {
        languages: {
          TypeScript: 5000,
          JavaScript: 5000,
        },
        primary: 'TypeScript',
        percentages: {
          TypeScript: 50,
          JavaScript: 50,
        },
        totalBytes: 10000,
      };

      const summary = detector.getLanguagesSummary(stats);

      expect(summary.diversityScore).toBeCloseTo(1, 1); // Perfect diversity for 2 languages
    });
  });

  describe('compareLanguageStats', () => {
    it('should detect added languages', () => {
      const stats1: LanguageStats = {
        languages: { TypeScript: 1000 },
        primary: 'TypeScript',
        percentages: { TypeScript: 100 },
        totalBytes: 1000,
      };

      const stats2: LanguageStats = {
        languages: { TypeScript: 1000, Python: 500 },
        primary: 'TypeScript',
        percentages: { TypeScript: 66.7, Python: 33.3 },
        totalBytes: 1500,
      };

      const comparison = detector.compareLanguageStats(stats1, stats2);

      expect(comparison.added).toContain('Python');
      expect(comparison.removed).toHaveLength(0);
    });

    it('should detect removed languages', () => {
      const stats1: LanguageStats = {
        languages: { TypeScript: 1000, Python: 500 },
        primary: 'TypeScript',
        percentages: { TypeScript: 66.7, Python: 33.3 },
        totalBytes: 1500,
      };

      const stats2: LanguageStats = {
        languages: { TypeScript: 1000 },
        primary: 'TypeScript',
        percentages: { TypeScript: 100 },
        totalBytes: 1000,
      };

      const comparison = detector.compareLanguageStats(stats1, stats2);

      expect(comparison.removed).toContain('Python');
      expect(comparison.added).toHaveLength(0);
    });

    it('should detect percentage changes', () => {
      const stats1: LanguageStats = {
        languages: { TypeScript: 8000, Python: 2000 },
        primary: 'TypeScript',
        percentages: { TypeScript: 80, Python: 20 },
        totalBytes: 10000,
      };

      const stats2: LanguageStats = {
        languages: { TypeScript: 5000, Python: 5000 },
        primary: 'TypeScript',
        percentages: { TypeScript: 50, Python: 50 },
        totalBytes: 10000,
      };

      const comparison = detector.compareLanguageStats(stats1, stats2);

      expect(comparison.changed.length).toBeGreaterThan(0);
      const tsChange = comparison.changed.find(
        (c) => c.language === 'TypeScript',
      );
      expect(tsChange).toBeDefined();
      expect(tsChange!.change).toBeLessThan(0); // Decreased
    });

    it('should detect primary language change', () => {
      const stats1: LanguageStats = {
        languages: { TypeScript: 8000, Python: 2000 },
        primary: 'TypeScript',
        percentages: { TypeScript: 80, Python: 20 },
        totalBytes: 10000,
      };

      const stats2: LanguageStats = {
        languages: { TypeScript: 2000, Python: 8000 },
        primary: 'Python',
        percentages: { TypeScript: 20, Python: 80 },
        totalBytes: 10000,
      };

      const comparison = detector.compareLanguageStats(stats1, stats2);

      expect(comparison.primaryChanged).toBe(true);
    });

    it('should ignore small percentage changes', () => {
      const stats1: LanguageStats = {
        languages: { TypeScript: 5000 },
        primary: 'TypeScript',
        percentages: { TypeScript: 100 },
        totalBytes: 5000,
      };

      const stats2: LanguageStats = {
        languages: { TypeScript: 5005 }, // 0.1% change
        primary: 'TypeScript',
        percentages: { TypeScript: 100 },
        totalBytes: 5005,
      };

      const comparison = detector.compareLanguageStats(stats1, stats2);

      expect(comparison.changed).toHaveLength(0); // Below 0.1% threshold
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle a typical TypeScript React project', () => {
      const files: GitHubTreeEntry[] = [
        {
          path: 'src/App.tsx',
          type: 'blob',
          size: 3000,
          sha: 'a',
          mode: '100644',
        },
        {
          path: 'src/components/Button.tsx',
          type: 'blob',
          size: 1500,
          sha: 'b',
          mode: '100644',
        },
        {
          path: 'src/utils/helpers.ts',
          type: 'blob',
          size: 2000,
          sha: 'c',
          mode: '100644',
        },
        {
          path: 'src/styles/main.css',
          type: 'blob',
          size: 1000,
          sha: 'd',
          mode: '100644',
        },
      ];

      const stats = detector.detectLanguages(files);

      expect(stats.primary).toBe('React'); // Most bytes are in .tsx files
      expect(stats.languages.React).toBe(4500);
      expect(stats.languages.TypeScript).toBe(2000);
      expect(stats.languages.CSS).toBe(1000);
    });

    it('should handle a typical Python Django project', () => {
      const files: GitHubTreeEntry[] = [
        {
          path: 'app/views.py',
          type: 'blob',
          size: 5000,
          sha: 'a',
          mode: '100644',
        },
        {
          path: 'app/models.py',
          type: 'blob',
          size: 3000,
          sha: 'b',
          mode: '100644',
        },
        {
          path: 'app/urls.py',
          type: 'blob',
          size: 1000,
          sha: 'c',
          mode: '100644',
        },
        {
          path: 'templates/index.html',
          type: 'blob',
          size: 2000,
          sha: 'd',
          mode: '100644',
        },
      ];

      const stats = detector.detectLanguages(files);

      expect(stats.primary).toBe('Python');
      expect(stats.languages.Python).toBe(9000);
      expect(stats.languages.HTML).toBe(2000);
    });

    it('should handle a polyglot microservices repository', () => {
      const files: GitHubTreeEntry[] = [
        {
          path: 'services/api/main.go',
          type: 'blob',
          size: 5000,
          sha: 'a',
          mode: '100644',
        },
        {
          path: 'services/worker/index.ts',
          type: 'blob',
          size: 4000,
          sha: 'b',
          mode: '100644',
        },
        {
          path: 'services/ml/model.py',
          type: 'blob',
          size: 6000,
          sha: 'c',
          mode: '100644',
        },
      ];

      const stats = detector.detectLanguages(files);

      expect(Object.keys(stats.languages)).toHaveLength(3);
      expect(stats.primary).toBe('Python'); // Largest single language
    });
  });
});
