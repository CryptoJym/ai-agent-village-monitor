import Phaser from 'phaser';
import { getRandomAgentManifest } from '../assets/pixellabManifest';
import { NpcSprite } from './NpcSprite';
import type { HouseSnapshot, NpcBehaviorOptions, NpcPopulationOverrides, NpcSeed } from './types';
import { computeNpcTint, deriveRoles, estimateNpcCount } from './population';

interface Options {
  houses: HouseSnapshot[];
  overrides?: NpcPopulationOverrides;
  behavior?: NpcBehaviorOptions;
  onSummary?: (summary: Record<string, NpcSeed[]>) => void;
}

interface InternalNpc {
  seed: NpcSeed;
  sprite: NpcSprite;
  house: HouseSnapshot;
  wanderTimer?: Phaser.Time.TimerEvent;
  workTimer?: Phaser.Time.TimerEvent;
}

const ROLE_TO_COLOR: Record<NpcSeed['role'], number> = {
  engineer: 0x38bdf8,
  bot: 0xf97316,
  visitor: 0x22c55e,
};

export class NpcManager {
  private readonly scene: Phaser.Scene;
  private readonly npcs: Map<string, InternalNpc> = new Map();
  private readonly houseMap: Map<string, HouseSnapshot> = new Map();
  private readonly behavior: Required<NpcBehaviorOptions>;
  private overlords: Map<string, Phaser.Time.TimerEvent> = new Map();
  private cullMargin = 96;

  constructor(scene: Phaser.Scene, options: Options) {
    this.scene = scene;
    options.houses.forEach((house) => this.houseMap.set(house.id, house));
    this.behavior = {
      idleDurationMs: options.behavior?.idleDurationMs ?? 2400,
      wanderRadius: options.behavior?.wanderRadius ?? 72,
      workDurationMs: options.behavior?.workDurationMs ?? 5200,
      momentum: options.behavior?.momentum ?? 0.5,
    };

    const plan = this.buildPopulationPlan(options.houses, options.overrides);
    for (const bucket of plan) {
      bucket.npcs.forEach((seed) => this.spawnNpc(seed));
    }
    options.onSummary?.(Object.fromEntries(plan.map((bucket) => [bucket.houseId, bucket.npcs])));
  }

  update(view: Phaser.Geom.Rectangle) {
    const viewRect = new Phaser.Geom.Rectangle(
      view.x - this.cullMargin,
      view.y - this.cullMargin,
      view.width + this.cullMargin * 2,
      view.height + this.cullMargin * 2,
    );
    this.npcs.forEach(({ sprite }) => {
      const visible = viewRect.contains(sprite.x, sprite.y);
      sprite.setVisible(visible);
    });
  }

  destroy() {
    this.npcs.forEach(({ sprite, wanderTimer, workTimer }) => {
      wanderTimer?.remove(false);
      workTimer?.remove(false);
      sprite.dispose();
    });
    this.npcs.clear();
    this.overlords.forEach((timer) => timer.remove(false));
    this.overlords.clear();
  }

  private buildPopulationPlan(houses: HouseSnapshot[], overrides?: NpcPopulationOverrides) {
    const plan: Array<{ houseId: string; npcs: NpcSeed[] }> = [];
    for (const house of houses) {
      const override = overrides?.[house.id];
      const targetCount = estimateNpcCount(house, override);
      const roles = deriveRoles(targetCount, house, override?.roles);
      const seeds: NpcSeed[] = roles.map((role, index) => ({
        id: `${house.id}-npc-${index}`,
        role,
        houseId: house.id,
        tint: override?.tint ?? computeNpcTint(house.id, role, index),
        name: this.generateName(house, role, index),
      }));
      plan.push({ houseId: house.id, npcs: seeds });
    }
    return plan;
  }

  private generateName(house: HouseSnapshot, role: NpcSeed['role'], index: number) {
    const base = house.language.toUpperCase();
    const suffix = role === 'bot' ? 'Bot' : role === 'engineer' ? 'Eng' : 'Mentor';
    return `${base}-${suffix}${index + 1}`;
  }

  private spawnNpc(seed: NpcSeed) {
    const house = this.houseMap.get(seed.houseId);
    if (!house) return;
    const manifest = getRandomAgentManifest();
    const start = this.pickSpawnPoint(house);
    const sprite = new NpcSprite(this.scene, start.x, start.y, {
      id: seed.id,
      name: seed.name,
      manifest,
      tint: seed.tint,
      ringColor: ROLE_TO_COLOR[seed.role],
    });
    sprite.setDepth(500 + start.y);
    this.npcs.set(seed.id, { seed, sprite, house });
    this.scheduleBehavior(seed.id);
  }

  private pickSpawnPoint(house: HouseSnapshot) {
    const radius = house.radius ?? 24;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    return {
      x: house.position.x + Math.cos(angle) * radius,
      y: house.position.y + Math.sin(angle) * radius,
    };
  }

  private scheduleBehavior(id: string) {
    const entry = this.npcs.get(id);
    if (!entry) return;
    const run = () => {
      const { sprite, house } = entry;
      const action = Phaser.Math.RND.pick(['idle', 'wander', 'work', 'talk']);
      switch (action) {
        case 'idle':
          sprite.setState('idle');
          break;
        case 'wander':
          this.wander(sprite, house);
          sprite.setState('wandering');
          break;
        case 'work':
          sprite.setState('working');
          this.scene.time.delayedCall(this.behavior.workDurationMs, () => sprite.setState('idle'));
          break;
        case 'talk':
          sprite.setState('talking');
          this.scene.time.delayedCall(1600, () => sprite.setState('idle'));
          break;
      }
      // Debug tracking disabled - npc_behavior not in AnalyticsEvent type
      // track({ type: 'npc_behavior', npcId: seed.id, houseId: house.id, action, ts: Date.now() });
    };
    const timer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(1800, 4200),
      loop: true,
      callback: run,
    });
    this.overlords.set(id, timer);
  }

  private wander(sprite: NpcSprite, house: HouseSnapshot) {
    const target = this.pickSpawnPoint(house);
    sprite.walkTo(target);
  }

  updateHouseSnapshot(house: HouseSnapshot) {
    this.houseMap.set(house.id, house);
  }
}
