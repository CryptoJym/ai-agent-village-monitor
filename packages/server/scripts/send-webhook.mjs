#!/usr/bin/env node
import http from 'node:http';

const host = process.env.SERVER_URL || 'http://localhost:3000';
const path = process.argv[2] || '/api/webhooks/github';
const event = process.argv[3] || 'issues';
const delivery = process.argv[4] || `local-${Date.now()}`;

const payload = {
  action: 'opened',
  repository: { id: 123, full_name: 'org/repo', name: 'repo', owner: { id: 456, login: 'org' } },
  issue: { id: 789, number: 1, title: 'Local test', body: 'This is a local test' },
};

const data = JSON.stringify(payload);
const url = new URL(path, host);

const req = http.request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'x-github-event': event,
    'x-github-delivery': delivery,
  },
}, (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    console.log(`HTTP ${res.statusCode}`);
    console.log(body);
  });
});
req.on('error', (e) => console.error(e));
req.write(data);
req.end();

