import { prisma } from '../db/client';
import { GitHubService } from '../github/service';
import { createQueues } from '../queue/queues';

function pickTopLanguage(langs: Record<string, number> | null | undefined): string | null {
  if (!langs) return null;
  let best: { lang: string; bytes: number } | null = null;
  for (const [lang, bytes] of Object.entries(langs)) {
    if (!best || bytes > best.bytes) best = { lang, bytes };
  }
  return best?.lang || null;
}

function* gridPositions(): Generator<{ x: number; y: number }> {
  const step = 1;
  let y = 0;
  while (true) {
    for (let x = 0; x < 1000; x += step) {
      yield { x, y };
    }
    y += step;
  }
}

export async function syncVillageNow(villageId: number, org: string) {
  const started = Date.now();
  const gh = new GitHubService();

  const repos = await gh.listOrgReposGraphQL(org);

  // Build existing houses map and used positions set
  const existing = await prisma.house.findMany({ where: { villageId } });
  const byRepoId = new Map(existing.map((h: any) => [String(h.githubRepoId), h]));
  const used = new Set(existing.map((h: any) => `${h.positionX ?? 'n'}:${h.positionY ?? 'n'}`));

  // Resolve missing languages with limited concurrency
  const needsLang = repos.filter((r) => !r.primaryLanguage);
  const limit = 5;
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, Math.max(1, needsLang.length)) }).map(async () => {
      while (idx < needsLang.length) {
        const r = needsLang[idx++];
        try {
          if (!r.owner) {
            continue;
          }
          const data = await gh.getRepoLanguages(r.owner, r.name);
          r.primaryLanguage = pickTopLanguage(data);
        } catch {
          // ignore language failure
        }
      }
    }),
  );

  // Prepare positions for new houses
  const posIter = gridPositions();
  function nextFreePos(): { x: number; y: number } {
    while (true) {
      const { value } = posIter.next();
      if (!value) return { x: 0, y: 0 };
      const key = `${value.x}:${value.y}`;
      if (!used.has(key)) {
        used.add(key);
        return value;
      }
    }
  }

  // Sort for deterministic assignment of new positions
  const sorted = [...repos].sort(
    (a, b) => (b.stargazers ?? 0) - (a.stargazers ?? 0) || a.name.localeCompare(b.name),
  );

  let created = 0;
  let updated = 0;
  for (const r of sorted) {
    const repoIdStr = String(r.id);
    const exists = byRepoId.get(repoIdStr);
    if (!exists) {
      const pos = nextFreePos();
      await prisma.house.upsert({
        where: { githubRepoId: BigInt(r.id) },
        create: {
          villageId,
          githubRepoId: BigInt(r.id),
          repoName: r.owner ? `${r.owner}/${r.name}` : r.name,
          primaryLanguage: r.primaryLanguage ?? null,
          stars: r.stargazers ?? null,
          positionX: pos.x,
          positionY: pos.y,
        },
        update: {
          // Should not hit for non-existing, but safe
          repoName: r.owner ? `${r.owner}/${r.name}` : r.name,
          primaryLanguage: r.primaryLanguage ?? null,
          stars: r.stargazers ?? null,
        },
      });
      created++;
    } else {
      await prisma.house.update({
        where: { id: (exists as any).id },
        data: {
          repoName: r.owner ? `${r.owner}/${r.name}` : r.name,
          primaryLanguage: r.primaryLanguage ?? null,
          stars: r.stargazers ?? null,
        },
      });
      updated++;
    }
  }
  // Archive/delete handling: mark houses that no longer exist upstream
  const repoIdSet = new Set(sorted.map((r) => String(r.id)));
  let archived = 0;
  for (const h of existing) {
    const key = String(h.githubRepoId);
    if (!repoIdSet.has(key)) {
      await prisma.house.update({
        where: { id: h.id },
        data: {
          metadata: {
            ...(h.metadata as any),
            archived: true,
            archivedAt: new Date().toISOString(),
          },
        },
      });
      archived++;
    }
  }

  const count = await prisma.house.count({ where: { villageId } });
  const durationMs = Date.now() - started;
  const discrepancy = Math.max(0, archived) / Math.max(1, repos.length);
  try {
    const { cacheSetJSON } = await import('../cache/cache');
    await cacheSetJSON(
      `sync:accuracy:${villageId}`,
      {
        ts: Date.now(),
        repos: repos.length,
        houses: count,
        created,
        updated,
        archived,
        discrepancy,
      },
      3600,
    );
  } catch {
    // Cache write failure is non-fatal.
  }
  try {
    const { pushSyncRun } = await import('../sync/health');
    await pushSyncRun(villageId, {
      ts: Date.now(),
      repos: repos.length,
      houses: count,
      created,
      updated,
      archived,
      discrepancy,
    });
  } catch {
    // Sync health recording is best effort.
  }
  try {
    const { inc, observe } = await import('../metrics');
    inc('sync_run_total');
    observe('sync_discrepancy', discrepancy * 100);
  } catch {
    // Metrics emission is best effort.
  }
  console.info('[sync] village repos synced', {
    villageId,
    org,
    repos: repos.length,
    created,
    updated,
    archived,
    houses: count,
    durationMs,
    discrepancy,
  });
  return {
    ok: true,
    repos: repos.length,
    created,
    updated,
    archived,
    houses: count,
    durationMs,
    discrepancy,
  };
}

export async function enqueueVillageSync(villageId: number) {
  const village = await prisma.village.findUnique({ where: { id: villageId } });
  if (!village) throw new Error('village not found');
  const cfg = (village.villageConfig as any) || {};
  const org: string | undefined = typeof cfg.org === 'string' ? cfg.org : village.name;
  if (!org) throw new Error('village config missing org');

  const queues = createQueues();
  if (!queues) throw new Error('queue unavailable');
  const jobId = `githubSync:village:${villageId}`;
  await queues.githubSync.add('sync', { villageId, org }, { jobId });
  return { jobId };
}
