/* eslint-disable no-console */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('exit', (code) => resolve(code ?? 0));
    p.on('error', () => resolve(1));
  });
}

(async function main() {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const token = process.env.TOKEN || '';
  const outDir = path.resolve(__dirname, '../load/results');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}

  console.log(`[load-runner] base=${base} out=${outDir}`);

  // k6 smoke (if installed)
  let k6 = 127;
  try {
    k6 = await run('k6', ['run', path.resolve(__dirname, '../load/k6-http.js')], { env: { ...process.env, BASE_URL: base, TOKEN: token } });
  } catch {}
  if (k6 !== 0) console.warn('[load-runner] k6 not available or failed (skip)');

  // Artillery WS (if installed)
  let ar = 127;
  try {
    ar = await run('artillery', ['run', path.resolve(__dirname, '../load/artillery-ws.yml')], { env: { ...process.env, TOKEN: token } });
  } catch {}
  if (ar !== 0) console.warn('[load-runner] artillery not available or failed (skip)');

  // Local Socket.IO load
  const resFile = path.join(outDir, `ws-load-${Date.now()}.json`);
  const ws = await run('node', [path.resolve(__dirname, './ws-load.js'), '--url', base, '--clients', '50', '--duration', '20', '--village', 'demo', '--out', resFile]);
  if (ws !== 0) console.warn('[load-runner] ws-load failed'); else console.log(`[load-runner] ws-load result at ${resFile}`);
})();
