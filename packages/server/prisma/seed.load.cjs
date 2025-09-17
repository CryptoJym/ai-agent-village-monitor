/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function randChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomName(prefix) { return `${prefix}-${Math.random().toString(16).slice(2, 8)}`; }

async function main() {
  const VILLAGES = Number(process.env.SEED_VILLAGES || 5);
  const HOUSES_PER = Number(process.env.SEED_HOUSES_PER || 10);
  const AGENTS_PER = Number(process.env.SEED_AGENTS_PER || 3);
  const BUGS_PER = Number(process.env.SEED_BUGS_PER || 8);

  console.log(`[seed.load] villages=${VILLAGES} houses/v=${HOUSES_PER} agents/v=${AGENTS_PER} bugs/v=${BUGS_PER}`);

  for (let v = 0; v < VILLAGES; v++) {
    const ownerGithubId = BigInt(1_000_000 + v);
    const owner = await prisma.user.upsert({
      where: { githubId: ownerGithubId },
      update: {},
      create: { githubId: ownerGithubId, username: randomName('owner') },
    });
    const village = await prisma.village.create({
      data: {
        githubOrgId: BigInt(5000 + v),
        name: randomName('village'),
        isPublic: Math.random() < 0.3,
        ownerId: owner.id,
      },
    });
    await prisma.villageAccess.create({ data: { villageId: village.id, userId: owner.id, role: 'owner' } });

    const houses = [];
    for (let h = 0; h < HOUSES_PER; h++) {
      const house = await prisma.house.create({
        data: {
          villageId: village.id,
          githubRepoId: BigInt(100_000 + v * 1000 + h),
          name: randomName('repo'),
          primaryLanguage: randChoice(['TypeScript', 'Python', 'Go', 'Rust']),
          stars: Math.floor(Math.random() * 5000),
          positionX: Math.random() * 1600,
          positionY: Math.random() * 900,
        },
      });
      houses.push(house);
    }

    for (let a = 0; a < AGENTS_PER; a++) {
      await prisma.agent.create({
        data: {
          villageId: village.id,
          name: randomName('agent'),
          currentStatus: randChoice(['idle', 'working', 'debugging']),
          positionX: Math.random() * 1600,
          positionY: Math.random() * 900,
        },
      });
    }

    for (let b = 0; b < BUGS_PER; b++) {
      const house = randChoice(houses);
      await prisma.bugBot.create({
        data: {
          githubIssueId: BigInt(900_000 + v * 1000 + b),
          houseId: house.id,
          title: `Bug ${randomName('issue')}`,
          severity: randChoice(['low', 'medium', 'high']),
          status: 'open',
          positionX: (house.positionX || 0) + (Math.random() * 60 - 30),
          positionY: (house.positionY || 0) + (Math.random() * 60 - 30),
        },
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });

