// Seed aligned with current Postgres schema
// Run: pnpm -C packages/server db:seed
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function big(n) { return BigInt(n); }

async function seedVillage({ orgName, orgId }, houseCount = 2, agentNames = ['Claude', 'Sonnet']) {
  const village = await prisma.village.upsert({
    where: { githubOrgId: big(orgId) },
    update: {},
    create: { orgName, githubOrgId: big(orgId), config: { theme: 'slate' } },
  });

  const houses = [];
  for (let i = 0; i < houseCount; i++) {
    const repoId = big(1000 + i + Math.floor(Math.random() * 100));
    const px = 120 + i * 80;
    const py = 160 + (i % 2) * 60;
    const house = await prisma.house.upsert({
      where: { githubRepoId: repoId },
      update: {},
      create: { villageId: village.id, repoName: `${orgName.toLowerCase().replace(/\s+/g, '-')}-repo-${i + 1}`, githubRepoId: repoId, metadata: {}, positionX: px, positionY: py },
    });
    houses.push(house);
  }

  for (let i = 0; i < agentNames.length; i++) {
    const agent = await prisma.agent.create({ data: { name: agentNames[i], status: i % 2 ? 'working' : 'idle' } });
    await prisma.workStreamEvent.create({ data: { agentId: agent.id, message: 'starting analysis' } });
  }

  for (let i = 0; i < houses.length; i++) {
    const id = `BUG-${village.id}-${i + 1}`;
    await prisma.bugBot.upsert({
      where: { id },
      update: {},
      create: { id, villageId: village.id, provider: 'github', repoId: houses[i].id, issueId: `${Math.floor(Math.random() * 100000)}`, issueNumber: 100 + i, title: `Fix flakiness #${i + 1}`, status: 'open', severity: (['low', 'medium', 'high'])[i % 3] },
    });
  }

  return village;
}

async function main() {
  await prisma.user.upsert({ where: { githubId: big(999999) }, update: {}, create: { githubId: big(999999), email: 'demo@example.com', name: 'demo' } });
  await seedVillage({ orgName: 'Demo Org', orgId: 424242 }, 2);
  await seedVillage({ orgName: 'Acme Org', orgId: 434343 }, 3);
  // Explicit mapping demo to align with webhook sample payload
  const demo = await prisma.village.upsert({
    where: { githubOrgId: big(456) },
    update: {},
    create: { orgName: 'org', githubOrgId: big(456), config: { theme: 'slate' } },
  });
  await prisma.house.upsert({
    where: { githubRepoId: big(123) },
    update: { positionX: 300, positionY: 200, metadata: { fullName: 'org/repo' } },
    create: { villageId: demo.id, repoName: 'org/repo', githubRepoId: big(123), positionX: 300, positionY: 200, metadata: { fullName: 'org/repo' } },
  });
}

main().then(async () => { await prisma.$disconnect(); console.log('[seed] Completed'); }).catch(async (e) => { console.error('[seed] Error', e); await prisma.$disconnect(); process.exit(1); });
