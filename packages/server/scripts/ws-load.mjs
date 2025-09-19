#!/usr/bin/env node
import { io as ioc } from 'socket.io-client';
import jwt from 'jsonwebtoken';

const url = process.env.WS_URL || 'http://localhost:3000';
const clients = parseInt(process.env.WS_CLIENTS || '20', 10);
const durationMs = parseInt(process.env.WS_DURATION_MS || '10000', 10);
const villageId = process.env.WS_VILLAGE_ID || 'demo';
const secret = process.env.JWT_SECRET || 'testsecret';
const token = process.env.WS_TOKEN || jwt.sign({ sub: '1', username: 'loadbot', type: 'access' }, secret, { algorithm: 'HS256', expiresIn: '5m' });

console.log(`[ws-load] url=${url} clients=${clients} durationMs=${durationMs}`);

let connected = 0;
let pings = 0;
let sum = 0;
let max = 0;
let min = Number.POSITIVE_INFINITY;

const sockets = [];
for (let i = 0; i < clients; i++) {
  const socket = ioc(url, { transports: ['websocket', 'polling'], auth: { token }, reconnection: true });
  socket.on('connect', () => {
    connected++;
    // join a village room (best-effort)
    socket.emit('join_village', { villageId }, () => {});
  });
  socket.on('connect_error', (err) => {
    console.error('[connect_error]', err?.message || err);
  });
  sockets.push(socket);
}

const start = Date.now();
const timer = setInterval(() => {
  for (const s of sockets) {
    const t0 = Date.now();
    try {
      s.timeout(1000).emit('ping', () => {
        const dt = Date.now() - t0;
        pings++;
        sum += dt;
        if (dt > max) max = dt;
        if (dt < min) min = dt;
      });
    } catch {}
  }
  if (Date.now() - start > durationMs) finish();
}, 250);

function finish() {
  clearInterval(timer);
  for (const s of sockets) s.close();
  const avg = pings ? (sum / pings).toFixed(1) : 'n/a';
  console.log(`[ws-load] connected=${connected}/${clients} pings=${pings} avg=${avg}ms min=${isFinite(min) ? min : 'n/a'}ms max=${max}ms`);
  process.exit(0);
}

setTimeout(finish, durationMs + 2000);

