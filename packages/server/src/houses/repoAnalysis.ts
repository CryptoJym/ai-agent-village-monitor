import { createGitHubClientFromEnv } from '../github/client';
import { TreeFetcher } from '../github/tree-fetcher';
import { GitHubLanguageDetector } from '../github/language-detector';
import { GitHubModuleClassifier } from '../github/module-classifier';
import { calculateComplexityScore, generateAndSaveBuilding } from '../generation/buildingGenerator';
import { getPrisma } from '../db';
import { audit } from '../audit/logger';
import type { FileMetadata } from '../github/types';
import type {
  ModuleInfo as GenerationModuleInfo,
  ModuleType as GenerationModuleType,
} from '../../../shared/src/generation/types';

export type RepoAnalysisResult = {
  houseId: string;
  repoName: string;
  owner: string;
  repo: string;
  commitSha?: string;
  modules: number;
};

function parseOwnerRepo(repoName: string): { owner: string; repo: string } | null {
  const normalized = repoName
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0], repo: parts[1] };
}

function toGenerationModuleType(type: string): GenerationModuleType {
  if (type === 'unknown') return 'root';
  return type as GenerationModuleType;
}

function normalizeComplexity(value: number): number {
  const clamped = Math.min(8, Math.max(0, value));
  return Math.min(10, Math.max(1, Math.round((clamped / 8) * 9) + 1));
}

function totalSizeForPrefix(prefix: string, files: FileMetadata[]): number {
  if (!prefix) return files.reduce((sum, f) => sum + (f.size || 0), 0);
  const p = prefix.endsWith('/') ? prefix : `${prefix}/`;
  let total = 0;
  for (const f of files) {
    if (f.path === prefix || f.path.startsWith(p)) total += f.size || 0;
  }
  return total;
}

function toGenerationModules(
  modules: Array<{ path: string; type: string; fileCount: number; complexity: number }>,
  files: FileMetadata[],
  maxModules: number,
): GenerationModuleInfo[] {
  const sorted = [...modules].sort((a, b) => {
    const aScore = a.fileCount * 2 + a.complexity;
    const bScore = b.fileCount * 2 + b.complexity;
    return bScore - aScore;
  });

  const picked = sorted.slice(0, maxModules);
  const out: GenerationModuleInfo[] = picked.map((m) => {
    const name = m.path.split('/').filter(Boolean).pop() || m.path || 'root';
    return {
      path: m.path,
      name,
      type: toGenerationModuleType(String(m.type || 'root')),
      fileCount: m.fileCount || 0,
      totalSize: totalSizeForPrefix(m.path, files),
      complexity: normalizeComplexity(m.complexity || 0),
      imports: [],
      exports: [],
    };
  });

  // Ensure a root/entrance module exists so generation always has an anchor.
  if (!out.some((m) => m.type === 'root')) {
    out.unshift({
      path: '',
      name: 'root',
      type: 'root',
      fileCount: files.length,
      totalSize: totalSizeForPrefix('', files),
      complexity: 1,
      imports: [],
      exports: [],
    });
  }

  return out;
}

export async function analyzeHouseRepository(houseId: string): Promise<RepoAnalysisResult> {
  const prisma = getPrisma();
  if (!prisma) throw new Error('database not configured');

  const house = await prisma.house.findUnique({
    where: { id: houseId },
    select: { id: true, repoName: true, githubRepoId: true, commitSha: true },
  });
  if (!house) throw new Error(`house not found: ${houseId}`);

  const parsed = parseOwnerRepo(String(house.repoName || ''));
  if (!parsed) throw new Error(`invalid repoName: ${String(house.repoName || '')}`);
  const { owner, repo } = parsed;

  const gh = createGitHubClientFromEnv();
  const treeFetcher = new TreeFetcher(gh);
  let commitSha: string | undefined;
  let primaryLanguage: string | undefined;
  let stars: number | undefined;

  try {
    const info = await gh.getRepository(owner, repo);
    commitSha = info.defaultBranchRef?.target?.oid;
    primaryLanguage = info.primaryLanguage;
    stars = typeof info.stargazerCount === 'number' ? info.stargazerCount : undefined;
  } catch {
    // Best-effort metadata enrichment; proceed with tree fetch.
  }

  const ref = commitSha || house.commitSha || 'HEAD';
  const tree = await treeFetcher.fetchRepositoryTree(owner, repo, ref, {
    maxDepth: 50,
    maxFiles: 20_000,
    includeLanguageStats: false,
  });

  const languageDetector = new GitHubLanguageDetector();
  const langStats = languageDetector.detectLanguagesFromMetadata(tree.files);
  const classifier = new GitHubModuleClassifier();
  const classified = classifier.classifyModulesFromMetadata(tree.files, langStats);

  const generationModules = toGenerationModules(
    classified.map((m) => ({
      path: m.path,
      type: m.type,
      fileCount: m.fileCount,
      complexity: m.complexity,
    })),
    tree.files,
    150,
  );

  const repoId =
    house.githubRepoId != null ? String(house.githubRepoId) : String(house.repoName || '');
  const analyzedSha = commitSha || tree.commitInfo?.sha || house.commitSha || null;

  await generateAndSaveBuilding(houseId, repoId, analyzedSha, generationModules);

  const complexityScore = calculateComplexityScore(generationModules);
  try {
    await prisma.house.update({
      where: { id: houseId },
      data: {
        commitSha: analyzedSha || undefined,
        complexity: Math.min(100, Math.max(1, complexityScore)),
        primaryLanguage: primaryLanguage || langStats.primary || undefined,
        stars,
      },
    });
  } catch {
    // DB updates are non-critical for generation results (rooms + tilemap already saved).
  }

  const result: RepoAnalysisResult = {
    houseId,
    repoName: String(house.repoName || ''),
    owner,
    repo,
    commitSha: analyzedSha || undefined,
    modules: generationModules.length,
  };

  audit.log('house.repo_analysis_completed', result as any);
  return result;
}
