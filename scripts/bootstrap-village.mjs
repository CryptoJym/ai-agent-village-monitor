#!/usr/bin/env node
import process from 'node:process';
import { PrismaClient } from '@prisma/client';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

function usage() {
  console.info(`Usage: node scripts/bootstrap-village.mjs \
  --org <github-org-login> \
  --owner-github-id <numeric github user id> \
  --owner-username <github username> \
  [--owner-email <email>] \
  [--owner-name <display name>] \
  [--github-org-id <numeric github org id>] \
  [--make-public]

Examples:
  node scripts/bootstrap-village.mjs \
    --org my-org \
    --github-org-id 123456789 \
    --owner-github-id 987654321 \
    --owner-username octocat \
    --owner-email octocat@example.com \
    --make-public
`);
}

function stableBigIntFromString(input) {
  let hash = 0n;
  const MOD = (1n << 63n) - 1n;
  const value = String(input);
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 131n + BigInt(value.charCodeAt(i))) % MOD;
  }
  return hash === 0n ? 1n : hash;
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const required = ['org', 'owner-github-id', 'owner-username'];
  const missing = required.filter((k) => !argv[k]);
  if (missing.length) {
    console.error(`Missing required arguments: ${missing.join(', ')}`);
    usage();
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const orgLogin = argv['org'];
  const ownerGithubId = BigInt(argv['owner-github-id']);
  const ownerUsername = argv['owner-username'];
  const ownerEmail = argv['owner-email'] || null;
  const ownerName = argv['owner-name'] || ownerUsername;
  const makePublic = argv['make-public'] === 'true' || argv['make-public'] === '1';

  const githubOrgId = argv['github-org-id']
    ? BigInt(argv['github-org-id'])
    : stableBigIntFromString(orgLogin);

  try {
    console.info('➕ ensuring owner user exists');
    const owner = await prisma.user.upsert({
      where: { githubId: ownerGithubId },
      update: {
        username: ownerUsername,
        email: ownerEmail,
        name: ownerName,
      },
      create: {
        githubId: ownerGithubId,
        username: ownerUsername,
        email: ownerEmail,
        name: ownerName,
      },
    });

    console.info('🏡 ensuring village exists for org', orgLogin);
    const village = await prisma.village.upsert({
      where: { githubOrgId },
      update: {
        orgName: orgLogin,
        villageConfig: { org: orgLogin },
        isPublic: makePublic,
      },
      create: {
        orgName: orgLogin,
        githubOrgId,
        villageConfig: { org: orgLogin },
        ownerId: owner.id,
        isPublic: makePublic,
      },
      include: { access: true },
    });

    console.info('👥 ensuring owner access entry');
    await prisma.villageAccess.upsert({
      where: {
        villageId_userId: {
          villageId: village.id,
          userId: owner.id,
        },
      },
      update: { role: 'owner' },
      create: {
        villageId: village.id,
        userId: owner.id,
        role: 'owner',
      },
    });

    console.info('\n✅ Bootstrap complete!');
    console.info('   Village ID :', village.id);
    console.info('   Org Login  :', orgLogin);
    console.info('   GitHub Org :', githubOrgId.toString());
    console.info('   Owner User :', owner.username, `(id ${owner.id})`);
    console.info('\nNext steps:');
    console.info('  1. Run `pnpm --filter @ai-agent-village-monitor/server db:migrate` (if not already).');
    console.info('  2. Kick off the first sync by calling the API:');
    console.info(`       curl -X POST http://localhost:3000/api/villages/${village.id}/houses/sync \\`);
    console.info('         -H "Authorization: Bearer <owner-access-token>"');
    console.info('     (or trigger via the UI once the owner is logged in).');
    console.info('  3. Start the server/frontend and log in as the owner to confirm access.');
  } catch (error) {
    console.error('Bootstrap failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
