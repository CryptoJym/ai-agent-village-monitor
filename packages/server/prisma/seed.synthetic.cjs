// Synthetic dataset generator for staging/load
// Usage:
//   SY_ORGS=5 SY_REPOS_PER_ORG=50 SY_AGENTS_PER_VILLAGE=3 SY_BUGS_PER_REPO=2 node prisma/seed.synthetic.cjs

/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ORGS = Number(process.env.SY_ORGS || 3);
const REPOS_PER_ORG = Number(process.env.SY_REPOS_PER_ORG || 20);
const AGENTS_PER_VILLAGE = Number(process.env.SY_AGENTS_PER_VILLAGE || 3);
const BUGS_PER_REPO = Number(process.env.SY_BUGS_PER_REPO || 1);

function big(n) { return BigInt(n); }

function* nameGen(prefix) {
  let i = 1;
  while (true) {
    yield `${prefix}-${i++}`;
  }
}

async function seedVillage(orgIndex) {
  const orgLogin = `org-${orgIndex + 1}`;
  const orgId = big(500000 + orgIndex);
  const village = await prisma.village.upsert({
    where: { githubOrgId: orgId },
    update: {},
    create: { orgName: orgLogin, githubOrgId: orgId, config: { theme: 'slate' } },
  });

  // Houses laid out on a grid
  const cols = Math.ceil(Math.sqrt(REPOS_PER_ORG));
  const rows = Math.ceil(REPOS_PER_ORG / cols);
  const baseX = 120;
  const baseY = 140;
  const dx = 80;
  const dy = 70;

  const houses = [];
  for (let j = 0; j < REPOS_PER_ORG; j++) {
    const repoId = big(1000000 + orgIndex * 10000 + j);
    const cx = j % cols;
    const cy = Math.floor(j / cols);
    const px = baseX + cx * dx;
    const py = baseY + cy * dy;
    const repoName = `${orgLogin}/repo-${j + 1}`;
    const house = await prisma.house.upsert({
      where: { githubRepoId: repoId },
      update: { positionX: px, positionY: py, metadata: { fullName: repoName } },
      create: { villageId: village.id, repoName, githubRepoId: repoId, positionX: px, positionY: py, metadata: { fullName: repoName } },
    });
    houses.push(house);
  }

  // Agents (not linked to village in schema; create generic agents)
  const agentNames = nameGen(`agent-${orgIndex + 1}`);
  for (let k = 0; k < AGENTS_PER_VILLAGE; k++) {
    const name = agentNames.next().value;
    await prisma.agent.create({ data: { name, status: k % 2 ? 'working' : 'idle', currentStatus: k % 2 ? 'working' : 'idle' } }).catch(() => {});
  }

  // Bug bots per repo
  const severities = ['low', 'medium', 'high'];
  for (const h of houses) {
    for (let b = 0; b < BUGS_PER_REPO; b++) {
      const bugId = `${h.repoName}#${b + 1}`;
      const sev = severities[(b + orgIndex) % severities.length];
      await prisma.bugBot.upsert({
        where: { id: bugId },
        update: { villageId: village.id, severity: sev, x: h.positionX, y: h.positionY },
        create: {
          id: bugId,
          villageId: village.id,
          provider: 'github',
          repoId: String(h.githubRepoId || ''),
          issueId: `${Number(h.githubRepoId || 0)}-${b + 1}`,
          issueNumber: 100 + b,
          title: `Synthetic bug ${b + 1} in ${h.repoName}`,
          status: 'open',
          severity: sev,
          x: h.positionX,
          y: h.positionY,
        },
      }).catch(() => {});
    }
  }

  return village;
}

async function main() {
  console.log(`[synthetic] Generating ORGS=${ORGS}, REPOS_PER_ORG=${REPOS_PER_ORG}, AGENTS_PER_VILLAGE=${AGENTS_PER_VILLAGE}, BUGS_PER_REPO=${BUGS_PER_REPO}`);
  for (let i = 0; i < ORGS; i++) {
    // eslint-disable-next-line no-await-in-loop
    await seedVillage(i);
  }
}

main().then(async () => {
  await prisma.$disconnect();
  console.log('[synthetic] Completed');
}).catch(async (e) => {
  console.error('[synthetic] Error', e);
  await prisma.$disconnect();
  process.exit(1);
});

