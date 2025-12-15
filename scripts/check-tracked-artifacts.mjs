#!/usr/bin/env node
import { execSync } from 'node:child_process';

const forbiddenPatterns = [
  /(^|\/)dist\//,
  /(^|\/)node_modules\//,
  /(^|\/)\.vite\//,
  /\.tsbuildinfo$/,
];

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const bad = files.filter((file) => forbiddenPatterns.some((pattern) => pattern.test(file)));

if (bad.length === 0) {
  process.exit(0);
}

console.error('Committed build artifacts detected (must be ignored and untracked):');
for (const file of bad.slice(0, 50)) {
  console.error(`- ${file}`);
}
if (bad.length > 50) {
  console.error(`...and ${bad.length - 50} more`);
}
process.exit(1);

