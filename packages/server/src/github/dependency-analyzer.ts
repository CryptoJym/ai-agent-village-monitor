import {
  dependencyAnalyzer,
  DependencyGraph as CoreDependencyGraph,
  DependencyEdge,
  CircularDependency,
  ModuleMetrics as CoreModuleMetrics,
} from '../analysis/dependency-analyzer';
import { GitHubClient } from './client';
import { FileMetadata } from './types';
import { ModuleInfo } from './module-classifier';

export interface DependencyGraph {
  nodes: string[]; // module paths
  edges: Array<{ from: string; to: string }>;
  circular: string[][]; // arrays of circular dependency chains
  metrics: {
    avgCoupling: number;
    maxDependents: number;
    orphanModules: string[];
  };
}

export interface EnhancedDependencyGraph extends DependencyGraph {
  moduleInfo: Map<string, ModuleInfo>;
  hotspots: Array<{
    module: string;
    coupling: number;
    dependents: number;
    dependencies: number;
  }>;
}

export interface DependencyAnalysisResult {
  graph: DependencyGraph;
  circular: CircularDependency[];
  metrics: CoreModuleMetrics;
  recommendations: string[];
}

/**
 * Analyzes dependencies in GitHub repositories
 * Wraps the core dependency-analyzer with GitHub-specific functionality
 */
export class GitHubDependencyAnalyzer {
  constructor(private client: GitHubClient) {}

  /**
   * Analyze dependencies from a repository
   * Fetches file contents and builds dependency graph
   */
  async analyzeDependencies(
    owner: string,
    repo: string,
    modules: ModuleInfo[],
    ref?: string,
  ): Promise<DependencyAnalysisResult> {
    // Fetch file contents for relevant source files
    const filesToAnalyze = this.getAnalyzableFiles(modules);
    const fileContents = await this.fetchFileContents(
      owner,
      repo,
      filesToAnalyze,
      ref,
    );

    // Build dependency graph
    const coreGraph = dependencyAnalyzer.buildDependencyGraph(fileContents);

    // Detect circular dependencies
    const circular = dependencyAnalyzer.detectCircularDependencies(coreGraph);

    // Calculate metrics
    const metrics = dependencyAnalyzer.calculateMetrics(coreGraph);

    // Convert to our graph format
    const graph = this.convertGraph(coreGraph, metrics);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      graph,
      circular,
      metrics,
    );

    return {
      graph,
      circular,
      metrics,
      recommendations,
    };
  }

  /**
   * Analyze dependencies from already-fetched file contents
   */
  analyzeDependenciesFromContent(
    files: Map<string, string>,
    modules: ModuleInfo[],
  ): DependencyAnalysisResult {
    const coreGraph = dependencyAnalyzer.buildDependencyGraph(files);
    const circular = dependencyAnalyzer.detectCircularDependencies(coreGraph);
    const metrics = dependencyAnalyzer.calculateMetrics(coreGraph);
    const graph = this.convertGraph(coreGraph, metrics);
    const recommendations = this.generateRecommendations(
      graph,
      circular,
      metrics,
    );

    return {
      graph,
      circular,
      metrics,
      recommendations,
    };
  }

  /**
   * Filter modules to only those that can be analyzed for dependencies
   */
  private getAnalyzableFiles(modules: ModuleInfo[]): string[] {
    const analyzableExtensions = [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.py',
      '.go',
      '.rs',
      '.java',
    ];

    return modules
      .filter((module) => {
        const ext = module.path.substring(module.path.lastIndexOf('.'));
        return analyzableExtensions.includes(ext);
      })
      .map((module) => module.path);
  }

  /**
   * Fetch file contents from GitHub
   */
  private async fetchFileContents(
    owner: string,
    repo: string,
    filePaths: string[],
    ref?: string,
  ): Promise<Map<string, string>> {
    const contents = new Map<string, string>();

    // Fetch files in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);

      const promises = batch.map(async (path) => {
        try {
          const content = await this.client.getFileContent(
            owner,
            repo,
            path,
            ref,
          );
          return { path, content };
        } catch (error) {
          console.warn(`Failed to fetch ${path}:`, error);
          return { path, content: '' };
        }
      });

      const results = await Promise.all(promises);
      for (const { path, content } of results) {
        if (content) {
          contents.set(path, content);
        }
      }
    }

    return contents;
  }

  /**
   * Convert core dependency graph to our format
   */
  private convertGraph(
    coreGraph: CoreDependencyGraph,
    metrics: CoreModuleMetrics,
  ): DependencyGraph {
    const nodes = Array.from(coreGraph.nodes.keys());

    const edges = coreGraph.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
    }));

    const circular = metrics.circularDependencies.map((circ) => circ.cycle);

    // Find max dependents
    let maxDependents = 0;
    for (const node of coreGraph.nodes.values()) {
      if (node.importedBy.length > maxDependents) {
        maxDependents = node.importedBy.length;
      }
    }

    return {
      nodes,
      edges,
      circular,
      metrics: {
        avgCoupling: metrics.averageCoupling,
        maxDependents,
        orphanModules: metrics.isolatedModules,
      },
    };
  }

  /**
   * Generate recommendations based on dependency analysis
   */
  private generateRecommendations(
    graph: DependencyGraph,
    circular: CircularDependency[],
    metrics: CoreModuleMetrics,
  ): string[] {
    const recommendations: string[] = [];

    // Circular dependencies
    if (circular.length > 0) {
      const highSeverity = circular.filter((c) => c.severity === 'high');
      if (highSeverity.length > 0) {
        recommendations.push(
          `Found ${highSeverity.length} high-severity circular dependencies. Consider refactoring these modules to break the cycles.`,
        );
      }
    }

    // High coupling
    if (metrics.highCouplingModules.length > 0) {
      const topCoupled = metrics.highCouplingModules[0];
      recommendations.push(
        `Module "${topCoupled.file}" has very high coupling (${topCoupled.coupling}). Consider splitting into smaller modules.`,
      );
    }

    // Orphaned modules
    if (metrics.isolatedModules.length > 0) {
      recommendations.push(
        `Found ${metrics.isolatedModules.length} isolated modules with no dependencies. These may be dead code.`,
      );
    }

    // Average coupling
    if (metrics.averageCoupling > 10) {
      recommendations.push(
        `Average coupling is ${metrics.averageCoupling.toFixed(1)}, which is high. Consider reducing inter-module dependencies.`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'Dependency structure looks healthy with no major issues detected.',
      );
    }

    return recommendations;
  }

  /**
   * Find dependency hotspots (highly coupled modules)
   */
  findHotspots(
    graph: DependencyGraph,
    coreGraph: CoreDependencyGraph,
    threshold: number = 10,
  ): Array<{
    module: string;
    coupling: number;
    dependents: number;
    dependencies: number;
  }> {
    const hotspots: Array<{
      module: string;
      coupling: number;
      dependents: number;
      dependencies: number;
    }> = [];

    for (const [path, node] of coreGraph.nodes.entries()) {
      if (node.coupling >= threshold) {
        hotspots.push({
          module: path,
          coupling: node.coupling,
          dependents: node.importedBy.length,
          dependencies: node.imports.length,
        });
      }
    }

    return hotspots.sort((a, b) => b.coupling - a.coupling);
  }

  /**
   * Analyze impact of changing a module
   */
  analyzeImpact(
    coreGraph: CoreDependencyGraph,
    modulePath: string,
  ): {
    directDependents: string[];
    transitiveDependents: Set<string>;
    impactScore: number;
  } {
    const directDependents = dependencyAnalyzer.findDependents(
      coreGraph,
      modulePath,
    );

    // Find all transitive dependents (modules that depend on this module, directly or indirectly)
    const transitiveDependents = new Set<string>();
    const visited = new Set<string>();
    const queue = [...directDependents];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;

      visited.add(current);
      transitiveDependents.add(current);

      const dependents = dependencyAnalyzer.findDependents(coreGraph, current);
      queue.push(...dependents);
    }

    // Impact score based on number of affected modules
    const impactScore = transitiveDependents.size;

    return {
      directDependents,
      transitiveDependents,
      impactScore,
    };
  }

  /**
   * Find entry points (modules with no imports)
   */
  findEntryPoints(coreGraph: CoreDependencyGraph): string[] {
    const entryPoints: string[] = [];

    for (const [path, node] of coreGraph.nodes.entries()) {
      if (node.imports.length === 0 && node.importedBy.length > 0) {
        entryPoints.push(path);
      }
    }

    return entryPoints;
  }

  /**
   * Find leaf modules (modules that import nothing)
   */
  findLeafModules(coreGraph: CoreDependencyGraph): string[] {
    const leafModules: string[] = [];

    for (const [path, node] of coreGraph.nodes.entries()) {
      if (node.imports.length === 0 && node.importedBy.length > 0) {
        leafModules.push(path);
      }
    }

    return leafModules;
  }

  /**
   * Calculate module importance based on how many modules depend on it
   */
  calculateModuleImportance(
    coreGraph: CoreDependencyGraph,
  ): Array<{ module: string; importance: number }> {
    const importance: Array<{ module: string; importance: number }> = [];

    for (const [path, node] of coreGraph.nodes.entries()) {
      // Importance is based on number of direct + transitive dependents
      const impact = this.analyzeImpact(coreGraph, path);
      importance.push({
        module: path,
        importance: impact.impactScore,
      });
    }

    return importance.sort((a, b) => b.importance - a.importance);
  }

  /**
   * Suggest modules that could be extracted into separate packages
   */
  suggestPackageExtractions(
    coreGraph: CoreDependencyGraph,
    modules: ModuleInfo[],
  ): Array<{
    modulePath: string;
    reason: string;
    dependents: number;
    reusePotential: 'high' | 'medium' | 'low';
  }> {
    const suggestions: Array<{
      modulePath: string;
      reason: string;
      dependents: number;
      reusePotential: 'high' | 'medium' | 'low';
    }> = [];

    for (const module of modules) {
      const node = coreGraph.nodes.get(module.path);
      if (!node) continue;

      // Look for utility/helper modules with many dependents
      if (
        (module.type === 'utility' || module.type === 'service') &&
        node.importedBy.length >= 5
      ) {
        const reusePotential =
          node.importedBy.length >= 10
            ? 'high'
            : node.importedBy.length >= 7
              ? 'medium'
              : 'low';

        suggestions.push({
          modulePath: module.path,
          reason: `${module.type} module with ${node.importedBy.length} dependents`,
          dependents: node.importedBy.length,
          reusePotential,
        });
      }
    }

    return suggestions.sort((a, b) => b.dependents - a.dependents);
  }

  /**
   * Export graph in DOT format for visualization
   */
  exportToDot(graph: DependencyGraph): string {
    let dot = 'digraph Dependencies {\n';
    dot += '  node [shape=box];\n';

    // Add edges
    for (const edge of graph.edges) {
      const fromLabel = edge.from.split('/').pop();
      const toLabel = edge.to.split('/').pop();
      dot += `  "${fromLabel}" -> "${toLabel}";\n`;
    }

    // Highlight circular dependencies
    for (const cycle of graph.circular) {
      dot += '\n  // Circular dependency:\n';
      for (let i = 0; i < cycle.length - 1; i++) {
        const fromLabel = cycle[i].split('/').pop();
        const toLabel = cycle[i + 1].split('/').pop();
        dot += `  "${fromLabel}" -> "${toLabel}" [color=red, style=bold];\n`;
      }
    }

    dot += '}\n';
    return dot;
  }
}

export function createGitHubDependencyAnalyzer(
  client: GitHubClient,
): GitHubDependencyAnalyzer {
  return new GitHubDependencyAnalyzer(client);
}
