import {
  moduleClassifier,
  ModuleType,
  ModuleClassification,
} from '../analysis/module-classifier';
import { FileMetadata } from './types';
import { GitHubTreeEntry, DetectedLanguageStats } from './language-detector';

export { ModuleType } from '../analysis/module-classifier';

export interface ModuleInfo {
  path: string;
  type: ModuleType;
  language: string;
  complexity: number;
  fileCount: number;
  importCount: number;
  confidence: number;
  reason: string;
}

export interface ModuleGrouping {
  byType: Map<ModuleType, ModuleInfo[]>;
  byLanguage: Map<string, ModuleInfo[]>;
  statistics: ModuleStatistics;
}

export interface ModuleStatistics {
  totalModules: number;
  byType: Record<ModuleType, number>;
  averageComplexity: number;
  highComplexityModules: ModuleInfo[];
}

/**
 * Classifies GitHub repository modules based on file patterns and structure
 * Wraps the core module-classifier with GitHub-specific functionality
 */
export class GitHubModuleClassifier {
  /**
   * Classify a list of GitHub tree entries as modules
   * Groups files by directory and analyzes module type, language, and complexity
   */
  classifyModules(
    tree: GitHubTreeEntry[],
    languageStats: DetectedLanguageStats,
  ): ModuleInfo[] {
    const modules: ModuleInfo[] = [];
    const filesByDirectory = this.groupFilesByDirectory(tree);

    // Classify each directory as a module
    for (const [dirPath, files] of filesByDirectory.entries()) {
      const moduleInfo = this.classifyDirectory(dirPath, files, languageStats);
      if (moduleInfo) {
        modules.push(moduleInfo);
      }
    }

    // Also classify individual files in root or special locations
    const rootFiles = tree.filter((file) => !file.path.includes('/'));
    for (const file of rootFiles) {
      if (file.type === 'blob') {
        const moduleInfo = this.classifyFile(file, languageStats);
        modules.push(moduleInfo);
      }
    }

    return modules;
  }

  /**
   * Classify modules from FileMetadata array
   */
  classifyModulesFromMetadata(
    files: FileMetadata[],
    languageStats: DetectedLanguageStats,
  ): ModuleInfo[] {
    const treeEntries: GitHubTreeEntry[] = files.map((file) => ({
      path: file.path,
      type: 'blob' as const,
      size: file.size,
      sha: file.sha,
      mode: file.mode,
    }));

    return this.classifyModules(treeEntries, languageStats);
  }

  /**
   * Classify a single directory as a module
   */
  private classifyDirectory(
    dirPath: string,
    files: GitHubTreeEntry[],
    languageStats: DetectedLanguageStats,
  ): ModuleInfo | null {
    if (files.length === 0) return null;

    // Get classification from the most representative file in the directory
    const representativeFile = this.findRepresentativeFile(files);
    const classification = moduleClassifier.classify(representativeFile.path);

    // Determine primary language for this directory
    const language = this.detectDirectoryLanguage(files, languageStats);

    // Calculate complexity based on file count and estimated imports
    const complexity = this.calculateModuleComplexity(files);

    return {
      path: dirPath,
      type: classification.type,
      language,
      complexity,
      fileCount: files.length,
      importCount: 0, // Will be populated by dependency analyzer
      confidence: classification.confidence,
      reason: classification.reason,
    };
  }

  /**
   * Classify a single file as a module
   */
  private classifyFile(
    file: GitHubTreeEntry,
    languageStats: DetectedLanguageStats,
  ): ModuleInfo {
    const classification = moduleClassifier.classify(file.path);
    const language = this.detectFileLanguage(file.path, languageStats);

    return {
      path: file.path,
      type: classification.type,
      language,
      complexity: 1, // Single file has complexity of 1
      fileCount: 1,
      importCount: 0,
      confidence: classification.confidence,
      reason: classification.reason,
    };
  }

  /**
   * Group files by their containing directory
   */
  private groupFilesByDirectory(
    tree: GitHubTreeEntry[],
  ): Map<string, GitHubTreeEntry[]> {
    const grouped = new Map<string, GitHubTreeEntry[]>();

    for (const entry of tree) {
      if (entry.type !== 'blob') continue;

      const lastSlash = entry.path.lastIndexOf('/');
      if (lastSlash === -1) continue; // Skip root files

      const dirPath = entry.path.substring(0, lastSlash);
      const existing = grouped.get(dirPath) || [];
      existing.push(entry);
      grouped.set(dirPath, existing);
    }

    return grouped;
  }

  /**
   * Find the most representative file in a directory for classification
   */
  private findRepresentativeFile(files: GitHubTreeEntry[]): GitHubTreeEntry {
    // Prefer index files, then the first non-test file
    const indexFile = files.find((f) =>
      /index\.(ts|js|tsx|jsx|py|go|rs|java)$/.test(f.path),
    );
    if (indexFile) return indexFile;

    const nonTestFile = files.find(
      (f) => !/\.(test|spec)\.(ts|js|tsx|jsx|py)$/.test(f.path),
    );
    if (nonTestFile) return nonTestFile;

    return files[0];
  }

  /**
   * Detect the primary language of a directory
   */
  private detectDirectoryLanguage(
    files: GitHubTreeEntry[],
    languageStats: DetectedLanguageStats,
  ): string {
    const langCounts: Record<string, number> = {};

    for (const file of files) {
      const lang = this.detectFileLanguage(file.path, languageStats);
      if (lang !== 'Unknown') {
        langCounts[lang] = (langCounts[lang] || 0) + 1;
      }
    }

    // Return the most common language
    let maxCount = 0;
    let primaryLang = languageStats.primary;

    for (const [lang, count] of Object.entries(langCounts)) {
      if (count > maxCount) {
        maxCount = count;
        primaryLang = lang;
      }
    }

    return primaryLang;
  }

  /**
   * Detect language of a single file
   */
  private detectFileLanguage(
    filePath: string,
    languageStats: DetectedLanguageStats,
  ): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';

    const extToLang: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'TypeScript',
      js: 'JavaScript',
      jsx: 'JavaScript',
      py: 'Python',
      java: 'Java',
      go: 'Go',
      rs: 'Rust',
      rb: 'Ruby',
      php: 'PHP',
      cpp: 'C++',
      c: 'C',
      cs: 'C#',
    };

    return extToLang[ext] || languageStats.primary;
  }

  /**
   * Calculate module complexity score
   * Based on: file count, directory depth, file sizes
   */
  private calculateModuleComplexity(files: GitHubTreeEntry[]): number {
    const fileCount = files.length;
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    const avgSize = fileCount > 0 ? totalSize / fileCount : 0;

    // Complexity factors
    const fileCountScore = Math.min(fileCount / 10, 5); // 0-5 based on file count
    const sizeScore = Math.min(avgSize / 1000, 3); // 0-3 based on average file size

    const complexity = fileCountScore + sizeScore;
    return Math.round(complexity * 10) / 10; // Round to 1 decimal
  }

  /**
   * Group modules by type
   */
  groupModulesByType(modules: ModuleInfo[]): Map<ModuleType, ModuleInfo[]> {
    const grouped = new Map<ModuleType, ModuleInfo[]>();

    for (const module of modules) {
      const existing = grouped.get(module.type) || [];
      existing.push(module);
      grouped.set(module.type, existing);
    }

    return grouped;
  }

  /**
   * Group modules by language
   */
  groupModulesByLanguage(modules: ModuleInfo[]): Map<string, ModuleInfo[]> {
    const grouped = new Map<string, ModuleInfo[]>();

    for (const module of modules) {
      const existing = grouped.get(module.language) || [];
      existing.push(module);
      grouped.set(module.language, existing);
    }

    return grouped;
  }

  /**
   * Get comprehensive module groupings and statistics
   */
  analyzeModules(modules: ModuleInfo[]): ModuleGrouping {
    const byType = this.groupModulesByType(modules);
    const byLanguage = this.groupModulesByLanguage(modules);
    const statistics = this.calculateStatistics(modules);

    return {
      byType,
      byLanguage,
      statistics,
    };
  }

  /**
   * Calculate module statistics
   */
  private calculateStatistics(modules: ModuleInfo[]): ModuleStatistics {
    const byType: Record<ModuleType, number> = {} as any;
    let totalComplexity = 0;

    for (const module of modules) {
      byType[module.type] = (byType[module.type] || 0) + 1;
      totalComplexity += module.complexity;
    }

    const averageComplexity =
      modules.length > 0 ? totalComplexity / modules.length : 0;

    const highComplexityModules = modules
      .filter((m) => m.complexity > averageComplexity * 1.5)
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 10);

    return {
      totalModules: modules.length,
      byType,
      averageComplexity,
      highComplexityModules,
    };
  }

  /**
   * Filter modules by type
   */
  filterByType(modules: ModuleInfo[], type: ModuleType): ModuleInfo[] {
    return modules.filter((m) => m.type === type);
  }

  /**
   * Filter modules by language
   */
  filterByLanguage(modules: ModuleInfo[], language: string): ModuleInfo[] {
    return modules.filter((m) => m.language === language);
  }

  /**
   * Find modules with high complexity
   */
  findHighComplexityModules(
    modules: ModuleInfo[],
    threshold: number = 5,
  ): ModuleInfo[] {
    return modules
      .filter((m) => m.complexity >= threshold)
      .sort((a, b) => b.complexity - a.complexity);
  }

  /**
   * Get module type distribution as percentages
   */
  getTypeDistribution(modules: ModuleInfo[]): Record<ModuleType, number> {
    const distribution: Record<ModuleType, number> = {} as any;
    const total = modules.length;

    if (total === 0) return distribution;

    for (const module of modules) {
      distribution[module.type] = (distribution[module.type] || 0) + 1;
    }

    for (const type in distribution) {
      distribution[type as ModuleType] =
        (distribution[type as ModuleType] / total) * 100;
    }

    return distribution;
  }
}

export const githubModuleClassifier = new GitHubModuleClassifier();
