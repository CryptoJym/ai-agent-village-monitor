#!/usr/bin/env node
import { spawn } from 'node:child_process';
import http from 'node:http';

const port = Number(process.env.PW_PORT || process.env.PORT || 4173);
const url = process.env.PW_BASE_URL || `http://localhost:${port}`;
const cmd = process.env.PW_WEB_SERVER_CMD || `pnpm --filter @ai-agent-village-monitor/frontend preview --port ${port}`;

const child = spawn(cmd, { shell: true, stdio: 'inherit' });

function waitForServer(retries = 120) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (retries <= 0) return reject(new Error('server did not start'));
        setTimeout(() => {
          retries -= 1;
          attempt();
        }, 1000);
      });
    };
    attempt();
  });
}

waitForServer().catch((e) => {
  console.error('[preview] failed to start', e?.message || e);
  process.exit(1);
});

// keep process open while child lives
child.on('exit', (code) => process.exit(code ?? 0));
