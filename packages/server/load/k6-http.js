import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = (function () {
  const smoke = {
    vus: 10,
    duration: '30s',
    thresholds: {
      http_req_failed: ['rate<0.01'],
      http_req_duration: ['p(95)<300', 'p(99)<600'],
    },
  };
  const ramp = {
    stages: [
      { duration: '30s', target: 100 },
      { duration: '1m', target: 300 },
      { duration: '1m', target: 0 },
    ],
    thresholds: smoke.thresholds,
  };
  return __ENV.K6_RAMP ? ramp : smoke;
})();

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';

function authHeaders() {
  return TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
}

export default function () {
  const h = authHeaders();
  const health = http.get(`${BASE}/healthz`);
  check(health, { 'health 200': (r) => r.status === 200 });

  // Warm paths
  const villages = http.get(`${BASE}/api/villages/demo/bugs`, { headers: h });
  check(villages, { 'bugs 200/401': (r) => r.status === 200 || r.status === 401 });

  // Agent commands (idempotent enqueues)
  const id = `k6-agent-${__VU}`;
  const start = http.post(`${BASE}/api/agents/${id}/start`, null, { headers: h });
  const cmd = http.post(
    `${BASE}/api/agents/${id}/command`,
    JSON.stringify({ command: 'run_tool', args: { tool: 'echo' } }),
    { headers: { ...h, 'Content-Type': 'application/json' } },
  );
  const stop = http.post(`${BASE}/api/agents/${id}/stop`, null, { headers: h });
  check(start, { 'start 202/401': (r) => r.status === 202 || r.status === 401 });
  check(cmd, { 'cmd 202/400/401': (r) => [202, 400, 401].includes(r.status) });
  check(stop, { 'stop 202/401': (r) => r.status === 202 || r.status === 401 });

  sleep(1);
}
