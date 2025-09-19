#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const planPath = path.join(root, 'task-master', 'plan.json');

function loadPlan() {
  const raw = fs.readFileSync(planPath, 'utf8');
  return JSON.parse(raw);
}

function printHelp() {
  console.log(`Task-master CLI

Usage:
  node task-master/cli.mjs list [--week N] [--phase foundation|integration|polish] [--features]
  node task-master/cli.mjs issues:create [--weeks 1,2,3] [--repo owner/name]

Examples:
  node task-master/cli.mjs list --week 1
  node task-master/cli.mjs list --phase integration
  node task-master/cli.mjs list --features
  node task-master/cli.mjs issues:create --weeks 1,2,3 --repo myorg/ai-agent-village-monitor
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--week') args.week = Number(argv[++i]);
    else if (a === '--weeks') args.weeks = argv[++i];
    else if (a === '--phase') args.phase = argv[++i];
    else if (a === '--features') args.features = true;
    else if (a === '--repo') args.repo = argv[++i];
    else if (a === '--no-labels') args.noLabels = true;
  }
  return args;
}

function list(plan, { week, phase, features }) {
  if (features) {
    console.log('# Features');
    for (const f of plan.features) {
      console.log(`- [${f.priority}] ${f.id} — ${f.title}`);
      for (const ac of f.acceptance) console.log(`  • ${ac}`);
    }
    return;
  }

  const weeksToShow = [];
  if (week) weeksToShow.push(String(week));
  else if (phase) {
    const p = plan.phases.find(p => p.name === phase);
    if (!p) {
      console.error(`Unknown phase: ${phase}`);
      process.exit(1);
    }
    p.weeks.forEach(w => weeksToShow.push(String(w)));
  } else {
    for (let i = 1; i <= plan.timeline_weeks; i++) weeksToShow.push(String(i));
  }

  for (const w of weeksToShow) {
    const data = plan.weeks[w];
    if (!data) continue;
    console.log(`\n## Week ${w}: ${data.title}`);
    console.log(`Goal: ${data.goal}`);
    console.log('- Tasks:');
    data.tasks.forEach(t => console.log(`  - [ ] ${t}`));
    console.log('- Acceptance:');
    data.acceptance_criteria.forEach(a => console.log(`  - ${a}`));
    console.log('- Deliverables:');
    data.deliverables.forEach(d => console.log(`  - ${d}`));
  }
}

function inferRepoFromGit() {
  try {
    const url = execSync('git remote get-url origin', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
    // Support SSH and HTTPS
    if (url.startsWith('git@')) {
      const m = url.match(/:(.+)\.git$/);
      return m ? m[1] : null;
    }
    if (url.startsWith('https://') || url.startsWith('http://')) {
      const m = url.match(/github\.com\/(.+)\.git$/);
      return m ? m[1] : null;
    }
  } catch {
    // Ignore git failures; fallback to null so caller can prompt.
  }
  return null;
}

function ghAvailable() {
  try { execSync('gh --version', { stdio: 'ignore' }); return true; } catch { return false; }
}

function issuesCreate(plan, { weeks, repo, noLabels }) {
  if (!ghAvailable()) {
    console.error('GitHub CLI (gh) not found. Install and run `gh auth login`.');
    process.exit(1);
  }
  const targetRepo = repo || inferRepoFromGit();
  if (!targetRepo) {
    console.error('Unable to infer repo. Pass --repo owner/name');
    process.exit(1);
  }

  const weekList = (weeks || '1,2,3,4,5,6').split(',').map(s => s.trim()).filter(Boolean);
  for (const w of weekList) {
    const data = plan.weeks[String(Number(w))];
    if (!data) continue;
    const title = `[Week ${w}] ${data.title}`;
    const body = [
      `Goal: ${data.goal}`,
      '',
      'Tasks:',
      ...data.tasks.map(t => `- [ ] ${t}`),
      '',
      'Acceptance Criteria:',
      ...data.acceptance_criteria.map(a => `- ${a}`),
      '',
      'Deliverables:',
      ...data.deliverables.map(d => `- ${d}`)
    ].join('\n');
    const base = `gh issue create --repo ${targetRepo} --title ${JSON.stringify(title)} --body ${JSON.stringify(body)}`;
    const cmd = noLabels ? base : `${base} --label week:${w},plan`;
    try {
      const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'] }).toString();
      process.stdout.write(out);
    } catch (e) {
      console.error(`Failed to create issue for week ${w}:`, e?.message || e);
    }
  }
}

// Entry
const [cmd, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  printHelp();
  process.exit(0);
}

const plan = loadPlan();

switch (cmd) {
  case 'list':
    list(plan, args);
    break;
  case 'issues:create':
    issuesCreate(plan, args);
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    printHelp();
    process.exit(1);
}
