import { emitToRepo, emitToVillage } from '../realtime/io';

export type Indicator = {
  active: boolean;
  source?: string;
  contextIds?: string[];
  startedAt?: number;
  minVisibleUntil?: number;
  expiresAt?: number;
  // optional metadata
  prNumber?: number;
  buildStatus?: 'in_progress' | 'failed' | 'passed';
};

export type HouseActivity = {
  houseId?: string; // internal id if known
  repoId?: string; // GitHub repo id (stringified)
  villageId?: string;
  version: number;
  indicators: {
    lights: Indicator;
    banner: Indicator;
    smoke: Indicator;
  };
};

export type Transition =
  | {
      kind: 'lights';
      houseId?: string;
      repoId?: string;
      villageId?: string;
      on: boolean;
      source?: string;
      contextId?: string;
      minMs?: number;
      ttlMs?: number;
    }
  | {
      kind: 'banner';
      houseId?: string;
      repoId?: string;
      villageId?: string;
      on: boolean;
      source?: string;
      contextId?: string;
      prNumber?: number;
      minMs?: number;
      ttlMs?: number;
    }
  | {
      kind: 'smoke';
      houseId?: string;
      repoId?: string;
      villageId?: string;
      on: boolean;
      source?: string;
      contextId?: string;
      status?: 'in_progress' | 'failed' | 'passed';
      minMs?: number;
      ttlMs?: number;
    };

type Timers = {
  lights?: NodeJS.Timeout;
  banner?: NodeJS.Timeout;
  smoke?: NodeJS.Timeout;
  // trailing-edge debounce timers for enforcing min duration before off
  lightsOffDelay?: NodeJS.Timeout;
  bannerOffDelay?: NodeJS.Timeout;
  smokeOffDelay?: NodeJS.Timeout;
};

const store = new Map<string, HouseActivity>(); // key by repoId when available, else houseId
const timers = new Map<string, Timers>();

export const DEFAULTS = {
  ttl: { lights: 90_000, smoke: 10 * 60_000, banner: 24 * 60 * 60_000 },
  min: { lights: 3_000, smoke: 5_000, banner: 2_000 },
  broadcastCoalesceMs: 50,
};

// Coalesced broadcast buffers
let pendingBroadcast = false;
const pendingKeys = new Set<string>();

function keyOf(t: Transition): string {
  return String(t.repoId || t.houseId || 'unknown');
}

function getOrInit(key: string, seed: Partial<HouseActivity>): HouseActivity {
  let s = store.get(key);
  if (!s) {
    s = {
      houseId: seed.houseId,
      repoId: seed.repoId ?? key,
      villageId: seed.villageId,
      version: 1,
      indicators: {
        lights: { active: false },
        banner: { active: false },
        smoke: { active: false },
      },
    };
    store.set(key, s);
  } else {
    // update ids if provided
    if (seed.houseId) s.houseId = seed.houseId;
    if (seed.villageId) s.villageId = seed.villageId;
  }
  return s;
}

function ensureTimers(key: string): Timers {
  let t = timers.get(key);
  if (!t) {
    t = {};
    timers.set(key, t);
  }
  return t;
}

function scheduleExpiry(key: string, which: keyof Timers, ms: number, cb: () => void) {
  const t = ensureTimers(key);
  if (t[which]) clearTimeout(t[which] as NodeJS.Timeout);
  (t as any)[which] = setTimeout(cb, ms);
}

function clearTimer(key: string, which: keyof Timers) {
  const t = timers.get(key);
  if (!t) return;
  const h = t[which];
  if (h) clearTimeout(h);
  (t as any)[which] = undefined;
}

function bumpVersion(s: HouseActivity) {
  s.version = (s.version || 0) + 1;
}

export function applyTransition(t: Transition): HouseActivity {
  const key = keyOf(t);
  const s = getOrInit(key, { houseId: t.houseId, repoId: t.repoId, villageId: t.villageId });
  const now = Date.now();
  const min = DEFAULTS.min;
  const ttl = DEFAULTS.ttl;

  if (t.kind === 'lights') {
    const ind = s.indicators.lights;
    if (t.on) {
      ind.active = true;
      ind.source = t.source || 'push';
      ind.startedAt = ind.startedAt || now;
      ind.minVisibleUntil = Math.max(ind.minVisibleUntil || 0, now + (t.minMs ?? min.lights));
      ind.expiresAt = now + (t.ttlMs ?? ttl.lights);
      clearTimer(key, 'lightsOffDelay');
      scheduleExpiry(key, 'lights', ind.expiresAt - now, () => {
        // respect min visible
        const rest = (ind.minVisibleUntil || 0) - Date.now();
        if (rest > 0) {
          scheduleExpiry(key, 'lightsOffDelay', rest, () => turnOff('lights'));
        } else {
          turnOff('lights');
        }
      });
      bumpVersion(s);
    } else {
      // off requested: enforce trailing-edge min duration
      const rest = (ind.minVisibleUntil || 0) - now;
      if (rest > 0) {
        scheduleExpiry(key, 'lightsOffDelay', rest, () => turnOff('lights'));
      } else {
        turnOff('lights');
      }
    }
  }

  if (t.kind === 'banner') {
    const ind = s.indicators.banner;
    if (t.on) {
      ind.active = true;
      ind.source = t.source || 'pull_request';
      ind.prNumber = t.prNumber;
      ind.startedAt = ind.startedAt || now;
      ind.minVisibleUntil = Math.max(ind.minVisibleUntil || 0, now + (t.minMs ?? min.banner));
      ind.expiresAt = now + (t.ttlMs ?? ttl.banner);
      clearTimer(key, 'bannerOffDelay');
      scheduleExpiry(key, 'banner', ind.expiresAt - now, () => {
        const rest = (ind.minVisibleUntil || 0) - Date.now();
        if (rest > 0) scheduleExpiry(key, 'bannerOffDelay', rest, () => turnOff('banner'));
        else turnOff('banner');
      });
      bumpVersion(s);
    } else {
      const rest = (ind.minVisibleUntil || 0) - now;
      if (rest > 0) scheduleExpiry(key, 'bannerOffDelay', rest, () => turnOff('banner'));
      else turnOff('banner');
    }
  }

  if (t.kind === 'smoke') {
    const ind = s.indicators.smoke;
    if (t.on) {
      ind.active = true;
      ind.source = t.source || 'check_run';
      ind.buildStatus = t.status ?? 'in_progress';
      ind.startedAt = ind.startedAt || now;
      ind.minVisibleUntil = Math.max(ind.minVisibleUntil || 0, now + (t.minMs ?? min.smoke));
      ind.expiresAt = now + (t.ttlMs ?? ttl.smoke);
      clearTimer(key, 'smokeOffDelay');
      scheduleExpiry(key, 'smoke', ind.expiresAt - now, () => {
        const rest = (ind.minVisibleUntil || 0) - Date.now();
        if (rest > 0) scheduleExpiry(key, 'smokeOffDelay', rest, () => turnOff('smoke'));
        else turnOff('smoke');
      });
      bumpVersion(s);
    } else {
      const rest = (ind.minVisibleUntil || 0) - now;
      if (rest > 0) scheduleExpiry(key, 'smokeOffDelay', rest, () => turnOff('smoke'));
      else turnOff('smoke');
    }
  }

  // queue broadcast
  pendingKeys.add(key);
  scheduleBroadcast();
  return s;

  function turnOff(which: 'lights' | 'banner' | 'smoke') {
    const ind = s.indicators[which];
    ind.active = false;
    ind.expiresAt = undefined;
    ind.minVisibleUntil = undefined;
    ind.startedAt = undefined;
    bumpVersion(s);
    pendingKeys.add(key);
    scheduleBroadcast();
  }
}

function scheduleBroadcast() {
  if (pendingBroadcast) return;
  pendingBroadcast = true;
  setTimeout(() => {
    pendingBroadcast = false;
    const keys = Array.from(pendingKeys);
    pendingKeys.clear();
    const now = Date.now();
    for (const k of keys) {
      const s = store.get(k);
      if (!s) continue;
      const payload = {
        type: 'house.activity',
        houseId: s.houseId,
        repoId: s.repoId,
        indicators: summarize(s, now),
        version: s.version,
        ts: now,
      } as const;
      // Broadcast to village if known, and to repo room
      if (s.villageId) emitToVillage(String(s.villageId), 'house.activity', payload);
      if (s.repoId) emitToRepo(String(s.repoId), 'house.activity', payload);
    }
  }, DEFAULTS.broadcastCoalesceMs);
}

function summarize(s: HouseActivity, now: number) {
  const rem = (ind: Indicator) => Math.max(0, (ind.minVisibleUntil || 0) - now);
  return {
    lights: { active: s.indicators.lights.active, minRemainingMs: rem(s.indicators.lights) },
    banner: {
      active: s.indicators.banner.active,
      prNumber: s.indicators.banner.prNumber,
      minRemainingMs: rem(s.indicators.banner),
    },
    smoke: {
      active: s.indicators.smoke.active,
      status: s.indicators.smoke.buildStatus,
      minRemainingMs: rem(s.indicators.smoke),
    },
  } as const;
}

export function getSnapshotByRepoId(repoId: string) {
  const s = store.get(String(repoId));
  if (!s) return undefined;
  const now = Date.now();
  return {
    type: 'house.activity',
    houseId: s.houseId,
    repoId: s.repoId,
    indicators: summarize(s, now),
    version: s.version,
    ts: now,
  } as const;
}
