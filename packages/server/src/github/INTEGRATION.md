# GitHub Integration System

This document describes the comprehensive GitHub integration system for the AI Agent Village Monitor.

## Architecture Overview

The GitHub integration system consists of several interconnected components:

1. **GitHub Client** - Enhanced GraphQL/REST client with caching and rate limiting
2. **Tree Fetcher** - Repository tree traversal and file metadata extraction
3. **Analysis Modules** - Language detection, module classification, and dependency analysis
4. **Webhook System** - Event processing with signature verification and async queue
5. **Event Processors** - Map GitHub events to agent state transitions

## Components

### 1. GitHub Client (`client.ts`)

Enhanced GitHub API client with:

- **GraphQL & REST API support** via @octokit
- **Rate limiting** with budget tracking (default: 5000 points/hour)
- **Request batching** for multiple queries
- **Caching layer** with TTL support (memory-based with optional Redis)
- **Automatic retries** with exponential backoff
- **TypeScript types** for all responses

#### Usage Example

```typescript
import { GitHubClient } from './github/client';

const client = new GitHubClient({
  tokens: ['ghp_token1', 'ghp_token2'],
  rateLimitBudget: 5000,
  cacheTTL: 900000, // 15 minutes
});

// Fetch repository details
const repo = await client.getRepository('owner', 'repo-name');

// Get repository tree recursively
const tree = await client.getRepositoryTree('owner', 'repo-name', 'main');

// Fetch file content
const content = await client.getFileContent('owner', 'repo-name', 'src/index.ts');

// Check rate limit status
const rateLimitStatus = client.getRateLimitStatus();
console.log(`Remaining: ${rateLimitStatus.remaining}/${rateLimitStatus.limit}`);
```

### 2. Repository Tree Fetcher (`tree-fetcher.ts`)

Recursive tree traversal with metadata extraction:

- **Recursive traversal** with depth and file count limits
- **File metadata** extraction (size, type, mode, SHA)
- **Commit information** for deterministic seeding
- **Language statistics** via GitHub API
- **Paginated fetching** for large repositories

#### Usage Example

```typescript
import { TreeFetcher } from './github/tree-fetcher';
import { GitHubClient } from './github/client';

const client = new GitHubClient({ tokens: ['token'] });
const fetcher = new TreeFetcher(client);

// Fetch entire repository tree
const treeData = await fetcher.fetchRepositoryTree('owner', 'repo', 'main', {
  maxDepth: 50,
  maxFiles: 5000,
  includeLanguageStats: true,
});

console.log(`Files: ${treeData.fileCount}, Size: ${treeData.totalSize} bytes`);

// Get repository statistics
const stats = await fetcher.getRepositoryStats('owner', 'repo');
console.log(`Total files: ${stats.totalFiles}`);
console.log(`By extension:`, stats.filesByExtension);
```

### 3. Language Detector (`analysis/language-detector.ts`)

Language detection for files:

- **Extension-based** detection for 50+ languages
- **Path pattern** matching (Dockerfile, Makefile, etc.)
- **Color mapping** based on GitHub linguist
- **Visual themes** with gradients
- **Confidence scoring** for detection accuracy

#### Usage Example

```typescript
import { languageDetector } from './analysis/language-detector';

// Detect language for a file
const info = languageDetector.detectLanguage('src/components/Button.tsx');
console.log(`Language: ${info.name}, Color: ${info.color}`);

// Classify multiple files
const files = ['index.ts', 'app.py', 'main.go'];
const results = languageDetector.classifyFiles(files);

// Get language statistics
const stats = languageDetector.getLanguageStats(files);
console.log(stats); // { TypeScript: 1, Python: 1, Go: 1 }
```

### 4. Module Classifier (`analysis/module-classifier.ts`)

Classify files into module types:

- **Component** - React/Vue/Svelte components
- **Service** - Business logic
- **Repository** - Data access
- **Controller** - Request handlers
- **Utility** - Helper functions
- **Config** - Configuration files
- **Type Definition** - TypeScript .d.ts files
- **Test** - Test files
- **Asset** - Static assets
- **Root** - Root-level project files

Supports: JavaScript/TypeScript, Python, Go, Rust, Java patterns.

#### Usage Example

```typescript
import { moduleClassifier } from './analysis/module-classifier';

// Classify a single file
const classification = moduleClassifier.classify('src/api/users.controller.ts');
console.log(`Type: ${classification.type}, Confidence: ${classification.confidence}`);

// Classify multiple files
const files = [
  'src/components/Button.vue',
  'src/services/auth.service.ts',
  'tests/integration.test.ts',
];

const grouped = moduleClassifier.getModulesByType(files);
console.log(`Components: ${grouped.get('component')?.length}`);

// Get statistics
const stats = moduleClassifier.getStatistics(files);
console.log(`Total: ${stats.totalFiles}, Avg confidence: ${stats.averageConfidence}`);
```

### 5. Dependency Graph Analyzer (`analysis/dependency-analyzer.ts`)

Build and analyze dependency graphs:

- **Import parsing** for multiple languages (JS/TS, Python, Go, Rust, Java)
- **Directed graph** construction
- **Coupling metrics** calculation
- **Circular dependency** detection
- **Graph export** as adjacency list

#### Usage Example

```typescript
import { dependencyAnalyzer } from './analysis/dependency-analyzer';

// Build dependency graph
const files = new Map([
  ['src/index.ts', 'import { App } from "./app";\nimport "./styles.css";'],
  ['src/app.ts', 'import { Component } from "./component";'],
  ['src/component.ts', 'export class Component {}'],
]);

const graph = dependencyAnalyzer.buildDependencyGraph(files);

// Detect circular dependencies
const cycles = dependencyAnalyzer.detectCircularDependencies(graph);
console.log(`Found ${cycles.length} circular dependencies`);

// Calculate metrics
const metrics = dependencyAnalyzer.calculateMetrics(graph);
console.log(`Average coupling: ${metrics.averageCoupling}`);
console.log(`High coupling modules: ${metrics.highCouplingModules.length}`);

// Export graph
const exported = dependencyAnalyzer.exportGraph(graph);
console.log(`Nodes: ${exported.nodes.length}, Edges: ${exported.edges.length}`);
```

### 6. Webhook System (`webhooks/github-enhanced.ts`)

Comprehensive webhook handling:

- **HMAC SHA-256 signature verification**
- **Event deduplication** using Redis
- **Async processing queue** with BullMQ
- **Priority-based processing**
- **Retry logic** with exponential backoff
- **Event routing** to specialized processors

#### Usage Example

```typescript
import express from 'express';
import { githubWebhookMiddleware } from './webhooks/github-enhanced';

const app = express();

// Raw body parser required for signature verification
app.use(
  express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Webhook endpoint
app.post('/api/webhooks/github', githubWebhookMiddleware);
```

### 7. Webhook Event Processors (`webhooks/processors/`)

Map GitHub events to agent states:

#### Push Events → Agent States

- `push` → `WORK_STARTED`
- `push` to main/master → `WORK_COMPLETED`

#### Pull Request Events → Agent States

- `pull_request.opened` → `THINKING`
- `pull_request.closed` (merged) → `CELEBRATE`
- `pull_request.closed` (not merged) → `IDLE`

#### Check Run Events → Agent States

- `check_run.completed` (success) → `CELEBRATE`
- `check_run.completed` (failure) → `ERROR_OCCURRED` + creates bug
- `check_run.completed` (neutral/skipped) → `IDLE`

#### Issues Events → Bug Creation

- `issues.opened` → Creates bug + `THINKING`
- `issues.closed` → Updates bug status to resolved + `CELEBRATE`

## Configuration

### Environment Variables

```bash
# GitHub API tokens (comma-separated for rotation)
GITHUB_TOKENS=ghp_token1,ghp_token2

# Webhook secret for signature verification
WEBHOOK_SECRET=your-webhook-secret

# Redis URL for caching and queuing
REDIS_URL=redis://localhost:6379

# Rate limit budget (optional, default: 5000)
GITHUB_RATE_LIMIT_BUDGET=5000
```

### GitHub Webhook Setup

1. Go to repository settings → Webhooks → Add webhook
2. Set Payload URL: `https://your-domain.com/api/webhooks/github`
3. Set Content type: `application/json`
4. Set Secret: Same as `WEBHOOK_SECRET` env var
5. Select events:
   - Push
   - Pull requests
   - Check runs
   - Issues

## Testing

Comprehensive test suite included:

```bash
# Run all GitHub integration tests
npm test -- src/__tests__/github/

# Run specific test suites
npm test -- src/__tests__/github/client.test.ts
npm test -- src/__tests__/github/tree-fetcher.test.ts
npm test -- src/__tests__/github/module-classifier.test.ts
npm test -- src/__tests__/github/webhook-signature.test.ts
npm test -- src/__tests__/github/webhook-processors.test.ts
```

## Rate Limiting

The system tracks rate limit usage and enforces budgets:

```typescript
const client = new GitHubClient({
  tokens: ['token1', 'token2'],
  rateLimitBudget: 1000, // Stop when 1000 calls used
});

// Check status
const status = client.getRateLimitStatus();
console.log(`Used: ${status.used}/${status.limit}`);
console.log(`Budget remaining: ${status.budgetRemaining}/${status.budget}`);
```

## Caching

Built-in caching with configurable TTL:

```typescript
const client = new GitHubClient({
  tokens: ['token'],
  cacheTTL: 900000, // 15 minutes
});

// First call fetches from API
await client.getRepository('owner', 'repo');

// Second call uses cache
await client.getRepository('owner', 'repo');

// Clear cache when needed
client.clearCache();
```

## Error Handling

All components include comprehensive error handling:

- Automatic retries with exponential backoff
- Graceful degradation when services unavailable
- Detailed error logging
- Metrics tracking for monitoring

## Performance

Optimizations included:

- **Request batching** for multiple queries
- **Memory caching** with TTL
- **ETags support** for conditional requests
- **Async queue processing** for webhooks
- **Connection pooling** for database/Redis

## Future Enhancements

Potential improvements:

1. Redis-based distributed caching
2. GraphQL query optimization
3. Real-time webhook streaming
4. Enhanced dependency visualization
5. ML-based language detection
6. Advanced code quality metrics
