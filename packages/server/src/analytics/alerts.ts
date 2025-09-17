import type { Redis } from 'ioredis';
import { config } from '../config';

const ERROR_RATE_THRESHOLD = 0.2;
const LATENCY_THRESHOLD_MS = 2000;
const ALERT_TTL_SECONDS = 1800;

export type HouseSLOMetrics = {
  houseId: string;
  commands: number;
  errorCount: number;
  errorRate: number;
  avgLatencyMs: number;
  lastCommandTs?: number;
};

const allowSlack = Boolean(config.ALERT_SLACK_WEBHOOK);
const allowEmail = Boolean(config.ALERT_EMAIL_RECIPIENTS);

async function sendSlackAlert(message: string) {
  if (!allowSlack || !config.ALERT_SLACK_WEBHOOK) return;
  try {
    await fetch(config.ALERT_SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch (err) {
     
    console.error('[alerts] failed to send Slack alert', err);
  }
}

async function sendEmailAlert(message: string) {
  if (!allowEmail || !config.ALERT_EMAIL_RECIPIENTS) return;
  // Integrate with email provider here. For now log to stdout.
   
  console.warn('[alerts] email alert', config.ALERT_EMAIL_RECIPIENTS, message);
}

async function maybeSendAlert(redis: Redis, houseId: string, kind: string, message: string) {
  const key = `alert:house:${houseId}:${kind}`;
  const exists = await redis.get(key);
  if (exists) return;
  await redis.set(key, Date.now().toString(), 'EX', ALERT_TTL_SECONDS);
  await sendSlackAlert(message);
  await sendEmailAlert(message);
}

export async function getHouseMetrics(redis: Redis, houseId: string): Promise<HouseSLOMetrics> {
  const key = (suffix: string) => `kpi:house:${houseId}:${suffix}`;
  const [commandsRaw, errorsRaw, latencyRaw, countRaw, lastTsRaw] = await redis.mget(
    key('commands'),
    key('errors'),
    key('latency_ms'),
    key('latency_count'),
    key('last_ts'),
  );
  const commands = Number(commandsRaw || 0);
  const errorCount = Number(errorsRaw || 0);
  const latencySum = Number(latencyRaw || 0);
  const latencyCount = Number(countRaw || 0);
  const avgLatencyMs = latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0;
  const errorRate = commands > 0 ? Number((errorCount / commands).toFixed(3)) : 0;
  const lastCommandTs = lastTsRaw ? Number(lastTsRaw) : undefined;
  return {
    houseId,
    commands,
    errorCount,
    errorRate,
    avgLatencyMs,
    lastCommandTs,
  };
}
export async function listHouseIds(redis: Redis): Promise<string[]> {
  const ids = new Set<string>();
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'kpi:house:*:commands', 'COUNT', 100);
    for (const key of keys) {
      const parts = key.split(':');
      if (parts.length >= 3) ids.add(parts[2]);
    }
    cursor = next;
  } while (cursor !== '0');
  return Array.from(ids);
}

export async function listHouseMetrics(redis: Redis): Promise<HouseSLOMetrics[]> {
  const ids = await listHouseIds(redis);
  const out: HouseSLOMetrics[] = [];
  for (const id of ids) {
    out.push(await getHouseMetrics(redis, id));
  }
  return out;
}

export async function evaluateHouseSLO(redis: Redis, houseId: string) {
  const metrics = await getHouseMetrics(redis, houseId);
  if (metrics.commands < 5) return; // too little data to evaluate
  if (metrics.errorRate >= ERROR_RATE_THRESHOLD) {
    const message = `House ${houseId} error rate ${(metrics.errorRate * 100).toFixed(1)}% over last window`;
    await maybeSendAlert(redis, houseId, 'error_rate', message);
  }
  if (metrics.avgLatencyMs >= LATENCY_THRESHOLD_MS) {
    const message = `House ${houseId} average latency ${metrics.avgLatencyMs}ms exceeds ${LATENCY_THRESHOLD_MS}ms`;
    await maybeSendAlert(redis, houseId, 'latency', message);
  }
}
