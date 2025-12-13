import { languageDetector, LanguageInfo } from '../analysis/language-detector';
import { FileMetadata } from './types';

export interface DetectedLanguageStats {
  languages: Record<string, number>; // language -> byte count
  primary: string; // most used language
  percentages: Record<string, number>; // language -> percentage
  totalBytes: number;
}

export interface GitHubTreeEntry {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  size?: number;
  sha: string;
  mode: string;
}

/**
 * Detects programming languages from GitHub repository tree entries
 * Uses the analysis/language-detector for core detection logic
 */
export class GitHubLanguageDetector {
  /**
   * Detect languages from a list of GitHub tree entries (files)
   * Calculates byte counts and percentages for each language
   */
  detectLanguages(files: GitHubTreeEntry[]): DetectedLanguageStats {
    const languageByteCounts: Record<string, number> = {};
    let totalBytes = 0;

    // Calculate byte counts per language
    for (const file of files) {
      if (file.type !== 'blob') continue;

      const { name, confidence } = languageDetector.detectLanguage(file.path);

      // Only count files with confident language detection
      if (confidence > 0.5 && name !== 'Unknown') {
        const size = file.size || 0;
        languageByteCounts[name] = (languageByteCounts[name] || 0) + size;
        totalBytes += size;
      }
    }

    // Find primary language (most bytes)
    let primary = 'Unknown';
    let maxBytes = 0;
    for (const [lang, bytes] of Object.entries(languageByteCounts)) {
      if (bytes > maxBytes) {
        maxBytes = bytes;
        primary = lang;
      }
    }

    // Calculate percentages
    const percentages: Record<string, number> = {};
    if (totalBytes > 0) {
      for (const [lang, bytes] of Object.entries(languageByteCounts)) {
        percentages[lang] = (bytes / totalBytes) * 100;
      }
    }

    return {
      languages: languageByteCounts,
      primary,
      percentages,
      totalBytes,
    };
  }

  /**
   * Detect languages from FileMetadata array
   */
  detectLanguagesFromMetadata(files: FileMetadata[]): DetectedLanguageStats {
    const treeEntries: GitHubTreeEntry[] = files.map((file) => ({
      path: file.path,
      type: 'blob' as const,
      size: file.size,
      sha: file.sha,
      mode: file.mode,
    }));

    return this.detectLanguages(treeEntries);
  }

  /**
   * Get language info for a single file
   */
  getFileLanguage(filePath: string): LanguageInfo {
    return languageDetector.detectLanguage(filePath);
  }

  /**
   * Get top N languages by byte count
   */
  getTopLanguages(stats: DetectedLanguageStats, count: number = 5): Array<{
    language: string;
    bytes: number;
    percentage: number;
  }> {
    const entries = Object.entries(stats.languages)
      .map(([language, bytes]) => ({
        language,
        bytes,
        percentage: stats.percentages[language] || 0,
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, count);

    return entries;
  }

  /**
   * Filter files by language
   */
  filterFilesByLanguage(
    files: GitHubTreeEntry[],
    language: string,
  ): GitHubTreeEntry[] {
    return files.filter((file) => {
      if (file.type !== 'blob') return false;
      const { name, confidence } = languageDetector.detectLanguage(file.path);
      return name === language && confidence > 0.5;
    });
  }

  /**
   * Group files by language
   */
  groupFilesByLanguage(
    files: GitHubTreeEntry[],
  ): Record<string, GitHubTreeEntry[]> {
    const grouped: Record<string, GitHubTreeEntry[]> = {};

    for (const file of files) {
      if (file.type !== 'blob') continue;

      const { name, confidence } = languageDetector.detectLanguage(file.path);

      if (confidence > 0.5 && name !== 'Unknown') {
        if (!grouped[name]) {
          grouped[name] = [];
        }
        grouped[name].push(file);
      }
    }

    return grouped;
  }

  /**
   * Check if a file is a specific language
   */
  isLanguage(filePath: string, language: string): boolean {
    const { name, confidence } = languageDetector.detectLanguage(filePath);
    return name === language && confidence > 0.5;
  }

  /**
   * Get language statistics summary
   */
  getLanguagesSummary(stats: DetectedLanguageStats): {
    totalLanguages: number;
    primaryLanguage: string;
    primaryPercentage: number;
    diversityScore: number; // 0-1, where 1 is perfectly diverse
  } {
    const totalLanguages = Object.keys(stats.languages).length;
    const primaryPercentage = stats.percentages[stats.primary] || 0;

    // Calculate diversity using entropy
    let entropy = 0;
    if (totalLanguages > 0) {
      for (const percentage of Object.values(stats.percentages) as number[]) {
        const p = percentage / 100;
        if (p > 0) {
          entropy -= p * Math.log2(p);
        }
      }
    }

    // Normalize entropy to 0-1 range
    const maxEntropy = totalLanguages > 1 ? Math.log2(totalLanguages) : 1;
    const diversityScore = maxEntropy > 0 ? entropy / maxEntropy : 0;

    return {
      totalLanguages,
      primaryLanguage: stats.primary,
      primaryPercentage,
      diversityScore,
    };
  }

  /**
   * Compare language statistics between two repositories or snapshots
   */
  compareLanguageStats(
    stats1: DetectedLanguageStats,
    stats2: DetectedLanguageStats,
  ): {
    added: string[];
    removed: string[];
    changed: Array<{
      language: string;
      oldPercentage: number;
      newPercentage: number;
      change: number;
    }>;
    primaryChanged: boolean;
  } {
    const langs1 = new Set(Object.keys(stats1.languages));
    const langs2 = new Set(Object.keys(stats2.languages));

    const added = [...langs2].filter((lang) => !langs1.has(lang));
    const removed = [...langs1].filter((lang) => !langs2.has(lang));

    const commonLangs = [...langs1].filter((lang) => langs2.has(lang));
    const changed = commonLangs
      .map((language) => {
        const oldPercentage = stats1.percentages[language] || 0;
        const newPercentage = stats2.percentages[language] || 0;
        const change = newPercentage - oldPercentage;

        return {
          language,
          oldPercentage,
          newPercentage,
          change,
        };
      })
      .filter((item) => Math.abs(item.change) > 0.1); // Only changes > 0.1%

    const primaryChanged = stats1.primary !== stats2.primary;

    return {
      added,
      removed,
      changed,
      primaryChanged,
    };
  }
}

export const githubLanguageDetector = new GitHubLanguageDetector();
