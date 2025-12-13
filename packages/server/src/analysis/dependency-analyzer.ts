import * as path from 'path';

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'require' | 'dynamic';
  line?: number;
}

export interface DependencyNode {
  filePath: string;
  imports: string[];
  importedBy: string[];
  coupling: number;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: DependencyEdge[];
  adjacencyList: Map<string, string[]>;
}

export interface CircularDependency {
  cycle: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface ModuleMetrics {
  totalModules: number;
  averageCoupling: number;
  maxCoupling: number;
  circularDependencies: CircularDependency[];
  isolatedModules: string[];
  highCouplingModules: Array<{ file: string; coupling: number }>;
}

export class DependencyAnalyzer {
  parseImports(content: string, filePath: string): string[] {
    const imports: string[] = [];
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
      imports.push(...this.parseJavaScriptImports(content));
    } else if (ext === '.py') {
      imports.push(...this.parsePythonImports(content));
    } else if (ext === '.go') {
      imports.push(...this.parseGoImports(content));
    } else if (ext === '.rs') {
      imports.push(...this.parseRustImports(content));
    } else if (ext === '.java') {
      imports.push(...this.parseJavaImports(content));
    }

    return imports;
  }

  private parseJavaScriptImports(content: string): string[] {
    const imports: string[] = [];

    // ES6 imports: import ... from '...'
    const importRegex = /import\s+(?:(?:[\w*{}\s,]+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // CommonJS require: require('...')
    const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Dynamic imports: import('...')
    const dynamicImportRegex = /import\s*\(['"]([^'"]+)['"]\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private parsePythonImports(content: string): string[] {
    const imports: string[] = [];

    // import module
    const importRegex = /^import\s+([\w.]+)/gm;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // from module import ...
    const fromImportRegex = /^from\s+([\w.]+)\s+import/gm;
    while ((match = fromImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private parseGoImports(content: string): string[] {
    const imports: string[] = [];

    // Single import: import "package"
    const singleImportRegex = /import\s+"([^"]+)"/g;
    let match;
    while ((match = singleImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Multi-line imports: import ( ... )
    const multiImportRegex = /import\s+\(([\s\S]*?)\)/g;
    while ((match = multiImportRegex.exec(content)) !== null) {
      const block = match[1];
      const packageRegex = /"([^"]+)"/g;
      let pkgMatch;
      while ((pkgMatch = packageRegex.exec(block)) !== null) {
        imports.push(pkgMatch[1]);
      }
    }

    return imports;
  }

  private parseRustImports(content: string): string[] {
    const imports: string[] = [];

    // use statements: use crate::module;
    const useRegex = /use\s+([\w:]+)/g;
    let match;
    while ((match = useRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // extern crate
    const externRegex = /extern\s+crate\s+([\w]+)/g;
    while ((match = externRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private parseJavaImports(content: string): string[] {
    const imports: string[] = [];

    // import statements: import package.Class;
    const importRegex = /import\s+([\w.]+)/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  buildDependencyGraph(files: Map<string, string>): DependencyGraph {
    const nodes = new Map<string, DependencyNode>();
    const edges: DependencyEdge[] = [];
    const adjacencyList = new Map<string, string[]>();

    // Initialize nodes
    for (const [filePath] of files) {
      nodes.set(filePath, {
        filePath,
        imports: [],
        importedBy: [],
        coupling: 0,
      });
      adjacencyList.set(filePath, []);
    }

    // Build edges
    for (const [filePath, content] of files) {
      const imports = this.parseImports(content, filePath);
      const resolvedImports = this.resolveImports(filePath, imports, files);

      const node = nodes.get(filePath)!;
      node.imports = resolvedImports;

      for (const importPath of resolvedImports) {
        // Add edge
        edges.push({
          from: filePath,
          to: importPath,
          type: 'import',
        });

        // Update adjacency list
        const neighbors = adjacencyList.get(filePath) || [];
        neighbors.push(importPath);
        adjacencyList.set(filePath, neighbors);

        // Update importedBy
        const importedNode = nodes.get(importPath);
        if (importedNode) {
          importedNode.importedBy.push(filePath);
        }
      }
    }

    // Calculate coupling
    for (const node of nodes.values()) {
      node.coupling = node.imports.length + node.importedBy.length;
    }

    return { nodes, edges, adjacencyList };
  }

  private resolveImports(
    fromPath: string,
    imports: string[],
    files: Map<string, string>,
  ): string[] {
    const resolved: string[] = [];
    const fromDir = path.dirname(fromPath);

    for (const imp of imports) {
      // Skip external packages
      if (!imp.startsWith('.') && !imp.startsWith('/')) {
        continue;
      }

      // Resolve relative path
      let resolvedPath = path.resolve(fromDir, imp);

      // Try to find the actual file
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java'];

      // Check if it's already a complete path
      if (files.has(resolvedPath)) {
        resolved.push(resolvedPath);
        continue;
      }

      // Try adding extensions
      let found = false;
      for (const ext of extensions) {
        const withExt = resolvedPath + ext;
        if (files.has(withExt)) {
          resolved.push(withExt);
          found = true;
          break;
        }
      }

      // Try index files
      if (!found) {
        for (const ext of extensions) {
          const indexPath = path.join(resolvedPath, `index${ext}`);
          if (files.has(indexPath)) {
            resolved.push(indexPath);
            found = true;
            break;
          }
        }
      }
    }

    return resolved;
  }

  detectCircularDependencies(graph: DependencyGraph): CircularDependency[] {
    const cycles: CircularDependency[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.adjacencyList.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart);
          cycle.push(neighbor);

          const severity =
            cycle.length <= 2 ? 'low' : cycle.length <= 4 ? 'medium' : 'high';

          cycles.push({ cycle, severity });
        }
      }

      recursionStack.delete(node);
    };

    for (const node of graph.nodes.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  calculateMetrics(graph: DependencyGraph): ModuleMetrics {
    const circularDependencies = this.detectCircularDependencies(graph);
    const isolatedModules: string[] = [];
    const couplings: number[] = [];

    for (const node of graph.nodes.values()) {
      couplings.push(node.coupling);

      if (node.coupling === 0) {
        isolatedModules.push(node.filePath);
      }
    }

    const averageCoupling = couplings.length > 0
      ? couplings.reduce((a, b) => a + b, 0) / couplings.length
      : 0;

    const maxCoupling = couplings.length > 0 ? Math.max(...couplings) : 0;

    const highCouplingModules = Array.from(graph.nodes.values())
      .filter((node) => node.coupling > averageCoupling * 2)
      .map((node) => ({ file: node.filePath, coupling: node.coupling }))
      .sort((a, b) => b.coupling - a.coupling);

    return {
      totalModules: graph.nodes.size,
      averageCoupling,
      maxCoupling,
      circularDependencies,
      isolatedModules,
      highCouplingModules,
    };
  }

  exportGraph(graph: DependencyGraph): {
    nodes: Array<{ id: string; coupling: number }>;
    edges: Array<{ from: string; to: string }>;
  } {
    const nodes = Array.from(graph.nodes.values()).map((node) => ({
      id: node.filePath,
      coupling: node.coupling,
    }));

    const edges = graph.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
    }));

    return { nodes, edges };
  }

  findDependents(graph: DependencyGraph, filePath: string): string[] {
    const node = graph.nodes.get(filePath);
    return node ? node.importedBy : [];
  }

  findDependencies(graph: DependencyGraph, filePath: string): string[] {
    const node = graph.nodes.get(filePath);
    return node ? node.imports : [];
  }

  getTransitiveDependencies(
    graph: DependencyGraph,
    filePath: string,
    maxDepth: number = 10,
  ): Set<string> {
    const visited = new Set<string>();
    const queue: Array<{ path: string; depth: number }> = [{ path: filePath, depth: 0 }];

    while (queue.length > 0) {
      const { path: currentPath, depth } = queue.shift()!;

      if (visited.has(currentPath) || depth >= maxDepth) {
        continue;
      }

      visited.add(currentPath);

      const dependencies = this.findDependencies(graph, currentPath);
      for (const dep of dependencies) {
        queue.push({ path: dep, depth: depth + 1 });
      }
    }

    visited.delete(filePath); // Remove self
    return visited;
  }
}

export const dependencyAnalyzer = new DependencyAnalyzer();
