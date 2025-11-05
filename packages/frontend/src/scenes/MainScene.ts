import Phaser from 'phaser';
import { Agent } from '../agents/Agent';
import type { AgentState } from '../agents/types';
import { WebSocketService } from '../realtime/WebSocketService';
import { eventBus } from '../realtime/EventBus';
import { createLiveRegion, announce } from '../utils/a11y';
import { loadVillageState, saveVillageState } from '../state/sceneState';
import { isoToScreen, buildIsoGrid } from '../utils/iso';
import { BugBot } from '../bugs/BugBot';
import { House } from '../houses/House';
import { applyRepoStateToHouse, type HouseState } from '../houses/state';
import { AssetManager } from '../assets/AssetManager';
import { LayoutOffload } from '../services/LayoutOffload';
import { SpatialHash } from '../utils/spatial';
import { Minimap } from '../overlays/Minimap';
import { track } from '../analytics/client';
import * as SearchIndex from '../search/SearchIndex';
import { CameraNavigator } from '../camera/CameraNavigator';
import { startTravel } from '../metrics/perf';
import { NpcManager } from '../npc/NpcManager';
import type { HouseSnapshot } from '../npc/types';

type HouseMeta = {
  name: string;
  language?: string;
  stars?: number;
  issues?: number;
  components?: string[];
  agents?: Array<{ id: string; name: string }>;
  buildStatus?: string;
  lastCommitAt?: number;
};

export class MainScene extends Phaser.Scene {
  private agent?: Agent;
  private ws?: WebSocketService;
  private bugs: Map<string, BugBot> = new Map();
  private bugBotsGroup?: Phaser.GameObjects.Group;
  private bugIndex = new SpatialHash<{ id: string; x: number; y: number }>(64, (item) => item.id);
  private focusOrder: string[] = [];
  private focusedIndex: number = -1;
  private focusRing?: Phaser.GameObjects.Graphics;
  // Track in-flight celebrations to temporarily pause interactions
  private celebrationsInFlight = 0;
  // Track ids that have been resolved (guards duplicate events)
  private resolvedIds: Set<string> = new Set();
  // Batch progress updates to avoid per-event work under load
  private pendingProgress: Map<string, number> = new Map();
  private progressFlushEvent?: Phaser.Time.TimerEvent;
  // Micro-batching for large spawn bursts
  private pendingSpawnQueue: Array<any> = [];
  private spawnBatchEvent?: Phaser.Time.TimerEvent;
  private readonly spawnBatchSize = 10;

  // Optional "houses" registry for targeted spawns and visual updates
  private houses: Map<
    string,
    { x: number; y: number; radius?: number; language?: string; textureKey: string }
  > = new Map();
  private houseObjects: Map<string, House> = new Map();
  private pendingSpawnsByHouse: Map<string, Array<{ id: string } & Record<string, any>>> =
    new Map();
  private pendingFlushEvent?: Phaser.Time.TimerEvent;
  private cullMargin = 48;
  // Ground and camera helpers
  private groundLayer?: Phaser.GameObjects.Container;
  private gridVisible = true;
  private gridTx?: {
    rows: number;
    cols: number;
    tileW: number;
    tileH: number;
    originX: number;
    originY: number;
  };
  private lastClickAt = 0;
  private readonly minZoom = 0.5;
  private readonly maxZoom = 2.0;
  private roleText?: Phaser.GameObjects.Text;
  private canAssign = false;
  private _cullBuf: string[] = [];
  private minimap?: Minimap;
  private camNav?: CameraNavigator;
  private travelStartAt?: number;
  private layoutVersion = 0;
  private interiorActive = false;
  private npcManager?: NpcManager;
  private houseMetadata: Map<string, HouseMeta> = new Map();
  private houseAssignMenu?: Phaser.GameObjects.Container;
  private houseAssignInputHandler?: (pointer: Phaser.Input.Pointer, objects: any[]) => void;

  private logWarning(context: string, error: unknown) {
    if (import.meta.env?.DEV && typeof console !== 'undefined') {
      console.warn(`[MainScene] ${context}`, error);
    }
  }

  private resolveHouseTexture(inputLanguage?: string) {
    const textureKey = AssetManager.getHouseTextureKey(inputLanguage ?? '');
    const match = /^house_(.+)$/i.exec(textureKey);
    const language = match ? match[1] : undefined;
    return { textureKey, language };
  }

  constructor() {
    super('MainScene');
  }

  update() {
    // Spatial-indexed view culling for bug bots
    const cam = this.cameras.main;
    const view = cam.worldView;
    const margin = this.cullMargin;
    this._cullBuf.length = 0;
    const ids = this.bugIndex.queryRect(
      view.x - margin,
      view.y - margin,
      view.width + margin * 2,
      view.height + margin * 2,
      this._cullBuf,
    );
    const visibleSet = new Set(ids);
    const lowDetail = cam.zoom < 0.8;
    for (const [id, bot] of this.bugs) {
      const on = visibleSet.has(id);
      if (bot.visible !== on) bot.setVisible(on);
      if (on) {
        bot.setPulse(!lowDetail);
      } else {
        bot.setPulse(false);
      }
    }
    // Update minimap viewport each frame
    try {
      this.minimap?.setViewport(view as any);
    } catch (error) {
      this.logWarning('updating minimap viewport during update()', error);
    }

    this.npcManager?.update(view);
  }

  create(data?: { villageId?: string }) {
    // Background tint
    this.cameras.main.setBackgroundColor('#0f172a');

    // Accessibility live region for screen readers
    createLiveRegion();

    // Create a sample agent (restore position if available)
    const villageId = data?.villageId || 'demo';
    (this as any).villageId = villageId;
    const prior = loadVillageState(villageId);
    const startX = prior?.agent?.x ?? 200;
    const startY = prior?.agent?.y ?? 180;
    this.agent = new Agent(this, startX, startY, { name: 'Claude', id: 'agent-placeholder' });
    eventBus.emit('agent_identity', {
      agentId: this.agent.id,
      name: this.agent.nameText.text,
    });
    this.fetchLayout(villageId)
      .then((layout) => {
        try {
          if (layout && typeof layout.version === 'number') this.layoutVersion = layout.version;
          const agentRows = Array.isArray(layout?.agents) ? layout?.agents : [];
          if (agentRows.length > 0) {
            const row = agentRows[0];
            const id = String(row.id ?? this.agent?.id ?? 'agent-placeholder');
            const name = String(row.name ?? row.id ?? 'Agent');
            const status = (row.currentStatus as AgentState) ?? 'idle';
            const cfg = this.parseSpriteConfig(row.spriteConfig);
            const houseId = typeof cfg.houseId === 'string' ? cfg.houseId : cfg.house_id;
            this.agent?.setIdentity({ id, name });
            eventBus.emit('agent_identity', { agentId: id, name });
            this.agent?.setAgentState(status);
            if (typeof row.positionX === 'number' && typeof row.positionY === 'number') {
              this.agent?.setPosition(row.positionX, row.positionY);
              try {
                this.minimap?.setAgentPosition({ x: row.positionX, y: row.positionY });
              } catch (error) {
                this.logWarning('syncing minimap agent position', error);
              }
            }
            if (houseId) {
              this.agent?.setHouseAssignment(String(houseId));
              const agentInfo = { id, name };
              this.updateHouseAgentMembership(undefined, String(houseId), agentInfo);
            }
          }
        } catch (error) {
          this.logWarning('processing fetched layout', error);
        }
        this.syncSearchIndex();
      })
      .catch(() => {
        this.syncSearchIndex();
      });

    // Group for bug bots (for layering/management)
    this.bugBotsGroup = this.add.group();

    // Focus ring for keyboard navigation
    this.focusRing = this.add.graphics();
    this.focusRing.setDepth(1000);

    // Attempt WebSocket-driven updates; fallback to mock timer
    this.setupRealtimeOrFallback();

    // If a villageId was provided (from WorldMapScene), join that room and show breadcrumb
    try {
      this.ws?.joinVillage?.(villageId);
    } catch (error) {
      this.logWarning('joining village room', error);
    }
    const back = this.add
      .text(12, this.scale.height - 20, '← World Map (M)', {
        color: '#93c5fd',
        fontFamily: 'monospace',
        fontSize: '11px',
        backgroundColor: 'rgba(11,18,32,0.7)',
      })
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('WorldMapScene'));

    // Role badge (top-left)
    this.roleText = this.add
      .text(12, 12, 'Role: …', {
        color: '#e5e7eb',
        fontFamily: 'monospace',
        fontSize: '11px',
        backgroundColor: 'rgba(11,18,32,0.7)',
      })
      .setScrollFactor(0)
      .setDepth(1000);
    this.fetchAndShowRole(villageId);

    // Minimap overlay: top-right, toggle with M
    try {
      const worldSize = { w: this.scale.width * 2, h: this.scale.height * 2 };
      this.minimap = new Minimap(this, { width: 180, height: 120, world: worldSize });
      if (this.agent) this.minimap.setAgentPosition({ x: this.agent.x, y: this.agent.y });
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.minimap?.destroy());
      // Toggle minimap with N (avoid conflict with World Map 'M')
      this.input.keyboard?.on('keydown-N', () => this.minimap?.toggle());
      // Camera navigator
      this.camNav = new CameraNavigator(this, {
        world: worldSize,
        minZoom: this.minZoom,
        maxZoom: this.maxZoom,
      });
      // Click-to-teleport: move agent and ultra-fast pan
      this.minimap.setOnTeleport(({ x, y }) => {
        this.beginTravelPerf('minimap');
        if (this.agent) {
          this.agent.walkTo(x, y);
          try {
            this.minimap?.setAgentPosition({ x, y });
          } catch (error) {
            this.logWarning('teleporting agent on minimap', error);
          }
          this.camNav?.panTo(x, y, 160);
          try {
            this.minimap?.setViewport(this.cameras.main.worldView as any);
          } catch (error) {
            this.logWarning('updating minimap viewport after teleport', error);
          }
          this.queueSaveLayout(true);
        }
      });
    } catch (error) {
      this.logWarning('initializing minimap', error);
    }

    // Wire event bus → scene
    eventBus.on('agent_update', (p) => {
      if (!this.agent) return;
      if (p.state) this.agent.setAgentState(p.state as AgentState);
      if (typeof p.x === 'number' && typeof p.y === 'number') {
        this.agent.walkTo(p.x, p.y);
        try {
          this.minimap?.setAgentPosition({ x: p.x, y: p.y });
        } catch (error) {
          this.logWarning('updating minimap from agent_update', error);
        }
      }
    });

    const onAgentAssignment = ({ agentId, houseId }: { agentId: string; houseId?: string }) => {
      if (!this.agent || agentId !== this.agent.id || !houseId) return;
      this.assignAgentToHouse(houseId, { source: 'action' });
    };
    eventBus.on('agent_assignment', onAgentAssignment);

    const onHouseFocus = ({ houseId, source }: { houseId: string; source?: string }) => {
      this.focusHouseById(houseId, { source: source || 'event' });
    };
    eventBus.on('house_focus', onHouseFocus);

    const onHouseDashboardRequest = ({ houseId, source }: { houseId: string; source?: string }) => {
      this.openHouseDashboard(houseId, { source: source || 'request' });
    };
    eventBus.on('house_dashboard_request', onHouseDashboardRequest);

    eventBus.on('bug_bot_spawn', (p) => this.enqueueSpawn(p));

    eventBus.on('bug_bot_progress', (p) => {
      if (!p?.id || typeof p.progress !== 'number') return;
      // Coalesce: only keep the latest value per id
      this.pendingProgress.set(p.id, p.progress);
    });

    eventBus.on('bug_bot_resolved', (p) => {
      // Idempotency: if we already handled this id, ignore
      if (this.resolvedIds.has(p.id)) return;
      const bot = this.bugs.get(p.id);
      if (!bot) {
        // If bot already gone, remember resolution to ignore duplicate events
        this.resolvedIds.add(p.id);
        return;
      }

      // Mark as resolved early to avoid duplicate handling
      this.resolvedIds.add(p.id);

      // Pause interactions during the celebration window
      this.beginCelebrationWindow();

      // Trigger celebration visuals (confetti + optional sparkle)
      this.celebrate(bot.x, bot.y);

      bot.setVisualState('resolved');
      bot.setProgress(1);

      // Fade bot, then remove both sprite and registry within <= 2s
      const _oldX = bot.x,
        _oldY = bot.y;
      bot.fadeOutAndDestroy(900);
      this.time.delayedCall(1200, () => {
        this.bugs.delete(p.id);
        this.bugIndex.remove(p.id);
        // Remove from focus order
        this.focusOrder = this.focusOrder.filter((x) => x !== p.id);
        if (this.focusedIndex >= this.focusOrder.length)
          this.focusedIndex = this.focusOrder.length - 1;
        this.endCelebrationWindow();
        announce(`Bug ${p.id} resolved`);
        this.ensureFocusVisible();
      });
    });

    eventBus.on('bug_bot_assign_request', ({ id }) => this.assignBug(id));

    // Handle agent drop → nearest bug assignment
    eventBus.on('agent_drop', ({ x, y }) => {
      const house = this.findNearestHouse(x, y, 96);
      if (house && this.agent) {
        this.assignAgentToHouse(house.id, { source: 'drag' });
        return;
      }
      const nearest = this.findNearestBug(x, y, 40);
      if (nearest) {
        this.assignBug(nearest.id);
        this.tweens.add({ targets: nearest, alpha: 0.6, duration: 200 });
      }
      this.queueSaveLayout();
    });

    // Prevent default browser context menu on canvas
    this.input.mouse?.disableContextMenu();

    // Keyboard navigation and actions
    const kb = this.input.keyboard;
    kb?.on('keydown-TAB', (e: KeyboardEvent) => {
      // Cycle focus
      if (e?.preventDefault) e.preventDefault();
      const backwards = e.shiftKey;
      if (this.focusOrder.length === 0) return;
      if (this.focusedIndex < 0) this.focusedIndex = 0;
      else
        this.focusedIndex =
          (this.focusedIndex + (backwards ? -1 : 1) + this.focusOrder.length) %
          this.focusOrder.length;
      this.ensureFocusVisible();
    });
    kb?.on('keydown-ENTER', () => this.assignFocused());
    kb?.on('keydown-SPACE', () => this.assignFocused());
    kb?.on('keydown-H', () => this.toggleHints());
    kb?.on('keydown-G', () => this.toggleGrid());
    kb?.on('keydown-M', () => this.scene.start('WorldMapScene'));
    // Alt input: Shift+Arrows to pan; F to nearest house
    kb?.on('keydown-LEFT', (e: KeyboardEvent) => this.handlePanKeys('left', e));
    kb?.on('keydown-RIGHT', (e: KeyboardEvent) => this.handlePanKeys('right', e));
    kb?.on('keydown-UP', (e: KeyboardEvent) => this.handlePanKeys('up', e));
    kb?.on('keydown-DOWN', (e: KeyboardEvent) => this.handlePanKeys('down', e));
    kb?.on('keydown-F', (e: KeyboardEvent) => this.handleNearestHouseKey(e));
    // Perf harness: press P to spawn a batch of bug bots
    kb?.on('keydown-P', () => {
      const count = 50;
      const ts = Date.now();
      const centerX = this.cameras.main.worldView.centerX;
      const centerY = this.cameras.main.worldView.centerY;
      for (let i = 0; i < count; i++) {
        const id = `perf-${ts}-${i}`;
        this.enqueueSpawn({ id, x: centerX, y: centerY });
      }
    });

    // Restore camera from in-memory state or URL hash
    if (prior?.camera) {
      this.cameras.main.scrollX = prior.camera.scrollX;
      this.cameras.main.scrollY = prior.camera.scrollY;
      if (typeof prior.camera.zoom === 'number') this.cameras.main.setZoom(prior.camera.zoom);
    }
    try {
      const { readUIHash } = require('../state/uiState');
      const h = readUIHash();
      if (h?.cam && Number.isFinite(h.cam.x) && Number.isFinite(h.cam.y)) {
        this.camNav?.teleportOrPanTo(h.cam.x!, h.cam.y!, 0);
        if (typeof h.cam.z === 'number' && Number.isFinite(h.cam.z))
          this.cameras.main.setZoom(h.cam.z!);
      }
      const onHash = () => {
        const next = readUIHash();
        if (next?.cam && Number.isFinite(next.cam.x) && Number.isFinite(next.cam.y)) {
          this.camNav?.teleportOrPanTo(next.cam.x!, next.cam.y!, 0);
          if (typeof next.cam.z === 'number' && Number.isFinite(next.cam.z))
            this.cameras.main.setZoom(next.cam.z!);
        }
      };
      window.addEventListener('hashchange', onHash);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        window.removeEventListener('hashchange', onHash);
      });
    } catch (error) {
      this.logWarning('initializing hash-based camera sync', error);
    }

    // Ground grid (lightweight isometric-like diamonds)
    this.buildGroundGrid();
    this.scale.on(Phaser.Scale.Events.RESIZE, () => {
      // Rebuild grid to adapt to new viewport size
      this.buildGroundGrid();
    });

    // Demo houses (language variants) at sample grid positions
    const samples = [
      { id: 'repo-1', name: 'core-lib', lang: 'ts', r: 6, c: 7, stars: 128, issues: 3 },
      { id: 'repo-2', name: 'service-py', lang: 'py', r: 8, c: 10, stars: 52, issues: 12 },
      { id: 'repo-3', name: 'agent-go', lang: 'go', r: 4, c: 12, stars: 31, issues: 1 },
    ];
    for (const s of samples) {
      const { x, y } = isoToScreen(
        s.r,
        s.c,
        this.gridTx!.tileW,
        this.gridTx!.tileH,
        this.gridTx!.originX,
        this.gridTx!.originY,
      );
      const house = new House(this, x, y, {
        id: s.id,
        name: s.name,
        language: s.lang,
        stars: s.stars,
        issues: s.issues,
      });
      house.onClickZoom((tx, ty) => this.panAndZoomTo(tx, ty, 1.15), {
        onEnter: () => this.openInteriorForHouse(house),
      });
      house.setHealth(s.issues);
      this.add.existing(house);
      this.registerHouse(s.id, x, y, 18, s.lang);
      this.houseObjects.set(s.id, house);
      this.patchHouseMeta(s.id, {
        name: s.name,
        language: s.lang,
        issues: s.issues,
        stars: s.stars,
        components: this.deriveComponents(s.lang),
      });
    }
    this.syncSearchIndex();

    const houseSnapshots = Array.from(this.houseObjects.keys())
      .map((id) => this.buildHouseSnapshot(id))
      .filter((snap): snap is HouseSnapshot => Boolean(snap));

    this.npcManager = new NpcManager(this, {
      houses: houseSnapshots,
      behavior: { wanderRadius: 64 },
      onSummary: (summary) => eventBus.emit('npc_population', summary),
    });

    // Start repo mock harness to drive house visuals
    this.startRepoEventHarness();

    const onResume = (_scene: Phaser.Scene, payload: any) => this.handleInteriorResume(payload);
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, onResume as any);
    });

    // (Removed legacy mini overlay; replaced by Minimap class above)

    // FPS overlay (top-left)
    const fpsText = this.add
      .text(12, 28, 'FPS: --', {
        color: '#94a3b8',
        fontFamily: 'monospace',
        fontSize: '11px',
        backgroundColor: 'rgba(11,18,32,0.6)',
      })
      .setScrollFactor(0)
      .setDepth(1000);
    this.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => {
        fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps || 0)}`);
      },
    });

    // Periodically flush progress updates in batches (coalesced)
    this.progressFlushEvent = this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => this.flushProgress(),
    });

    // Offscreen culling using spatial hash
    this.time.addEvent({ delay: 150, loop: true, callback: () => this.cullOffscreen() });

    // Camera controls
    this.enableCameraControls();

    // Listen for house activity updates via WebSocket
    eventBus.on('house_activity', (msg) => {
      const key1 = msg.houseId != null ? String(msg.houseId) : undefined;
      const key2 = msg.repoId != null ? String(msg.repoId) : undefined;
      let h: House | undefined;
      if (key1) h = this.houseObjects.get(key1);
      if (!h && key2) h = this.houseObjects.get(key2);
      if (h) h.applyActivityIndicators(msg.indicators as any);
    });

    // Optional URL-based profiling mode: /?profileVillage[&profileVillageCount=200]
    try {
      if (typeof window !== 'undefined') {
        const qs = new URLSearchParams(window.location.search);
        if (qs.has('profileVillage')) {
          const nRaw = Number(qs.get('profileVillageCount') || '200');
          const n = Number.isFinite(nRaw) && nRaw > 0 ? Math.min(nRaw, 1000) : 200;
          this.profileSpawn(n);
        }
      }
    } catch (e) {
      void e;
    }

    // Persist state on shutdown
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      eventBus.off('agent_assignment', onAgentAssignment as any);
      eventBus.off('house_focus', onHouseFocus as any);
      eventBus.off('house_dashboard_request', onHouseDashboardRequest as any);
      this.destroyHouseAssignMenu();
      saveVillageState(villageId, {
        agent: this.agent ? { x: this.agent.x, y: this.agent.y } : undefined,
        camera: {
          scrollX: this.cameras.main.scrollX,
          scrollY: this.cameras.main.scrollY,
          zoom: this.cameras.main.zoom,
        },
      });
      this.queueSaveLayout(true);
      this.npcManager?.destroy();
    });
  }

  private panAndZoomTo(tx: number, ty: number, targetZoom = 1.2) {
    const cam = this.cameras.main;
    const z = Phaser.Math.Clamp(targetZoom, this.minZoom, this.maxZoom);
    cam.pan(tx, ty, 280, 'Sine.easeInOut');
    this.tweens.add({
      targets: cam,
      zoom: z,
      duration: 280,
      ease: 'Sine.easeInOut',
    });
  }

  private openInteriorForHouse(house: House) {
    if (this.interiorSceneUnavailable()) return;
    if (this.interiorActive) return;
    this.interiorActive = true;

    const cam = this.cameras.main;
    const villageId = (this as any).villageId as string | undefined;
    if (villageId) {
      saveVillageState(villageId, {
        agent: this.agent ? { x: this.agent.x, y: this.agent.y } : undefined,
        camera: { scrollX: cam.scrollX, scrollY: cam.scrollY, zoom: cam.zoom },
      });
    }

    const payload = {
      villageId,
      houseId: house.id,
      language: house.language,
      returnScene: 'MainScene',
      returnCamera: { scrollX: cam.scrollX, scrollY: cam.scrollY, zoom: cam.zoom },
    };

    try {
      this.scene.launch('InteriorScene', payload);
      this.scene.pause();
    } catch (error) {
      this.interiorActive = false;
      this.logWarning('launching InteriorScene', error);
    }
  }

  private interiorSceneUnavailable(): boolean {
    const sceneManager = this.scene.manager as Phaser.Scenes.SceneManager & {
      keys?: Record<string, unknown>;
    };
    const registry = (sceneManager.keys || {}) as Record<string, unknown>;
    if ('InteriorScene' in registry) return false;
    try {
      this.scene.get('InteriorScene');
      return false;
    } catch {
      return true;
    }
  }

  private handleInteriorResume(payload: any) {
    this.interiorActive = false;
    if (!payload) return;

    if (payload.camera) {
      const cam = this.cameras.main;
      if (typeof payload.camera.scrollX === 'number') cam.scrollX = payload.camera.scrollX;
      if (typeof payload.camera.scrollY === 'number') cam.scrollY = payload.camera.scrollY;
      if (typeof payload.camera.zoom === 'number') {
        const z = Phaser.Math.Clamp(payload.camera.zoom, this.minZoom, this.maxZoom);
        cam.setZoom(z);
      }
      try {
        this.minimap?.setViewport(cam.worldView as any);
      } catch (error) {
        this.logWarning('syncing minimap after interior resume', error);
      }
    }

    const houseId = payload?.interiorReturn?.houseId;
    if (houseId) {
      const house = this.houseObjects.get(String(houseId));
      if (house) {
        house.setLightsActive(true);
        this.time.delayedCall(1200, () => house.setLightsActive(false));
      }
    }
  }

  // Teleport or ultra-fast pan the main camera to a world position.
  // Prefer instant snap; allow optional <=200ms ease if motion is enabled.
  private teleportCameraTo(
    x: number,
    y: number,
    opts?: { animate?: boolean; durationMs?: number },
  ) {
    const cam = this.cameras.main;
    const worldW = this.scale.width * 2;
    const worldH = this.scale.height * 2;
    const halfW = (cam.width * 0.5) / cam.zoom;
    const halfH = (cam.height * 0.5) / cam.zoom;
    const cx = Phaser.Math.Clamp(x, halfW, Math.max(halfW, worldW - halfW));
    const cy = Phaser.Math.Clamp(y, halfH, Math.max(halfH, worldH - halfH));

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animate = !!opts?.animate && !prefersReduced;
    const dur = Math.min(Math.max(0, opts?.durationMs ?? 160), 200);

    if (animate) {
      // Emit when the camera finishes panning
      cam.once('camerapancomplete' as any, () => {
        try {
          this.minimap?.setViewport(cam.worldView as any);
        } catch (error) {
          this.logWarning('syncing minimap during camera pan', error);
        }
        eventBus.emit('cameraSettled', { x: cx, y: cy, zoom: cam.zoom });
      });
      cam.pan(cx, cy, dur, 'Sine.easeInOut');
    } else {
      cam.centerOn(cx, cy);
      try {
        this.minimap?.setViewport(cam.worldView as any);
      } catch (error) {
        this.logWarning('syncing minimap after camera teleport', error);
      }
      eventBus.emit('cameraSettled', { x: cx, y: cy, zoom: cam.zoom });
    }
  }

  private async fetchAndShowRole(villageId: string) {
    try {
      const res = await fetch(`/api/villages/${encodeURIComponent(villageId)}/role`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const role = (data?.role as string) || 'visitor';
      const label = role.charAt(0).toUpperCase() + role.slice(1);
      this.roleText?.setText(`Role: ${label}`);
      this.canAssign = role === 'owner' || role === 'member';
    } catch (error) {
      this.logWarning('fetching village role', error);
      this.roleText?.setText('Role: Visitor');
      this.canAssign = false;
    }
  }

  // Determine the center for ring placement
  private resolveSpawnCenter(p: {
    houseId?: string;
    x?: number;
    y?: number;
  }): { x: number; y: number } | null {
    if (p.houseId && this.houses.has(p.houseId)) {
      const h = this.houses.get(p.houseId)!;
      return { x: h.x, y: h.y };
    }
    if (typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y };
    return null;
  }

  // Try to place within a ring [rMin, rMax] around (cx, cy) avoiding overlap with existing bots
  private findNonOverlappingRingPosition(
    cx: number,
    cy: number,
    severity: 'low' | 'medium' | 'high',
    rMin = 64,
    rMax = 128,
  ): { x: number; y: number } {
    // Severity radius used in BugBot: low=8, medium=10, high=12
    const sevRadius = severity === 'high' ? 12 : severity === 'medium' ? 10 : 8;
    const padding = 6; // extra space between bots
    const maxAttempts = 24;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.FloatBetween(rMin, rMax);
      const x = cx + Math.cos(angle) * dist;
      const y = cy + Math.sin(angle) * dist;
      if (this.isNonOverlapping(x, y, sevRadius, padding)) return { x, y };
      // Smallly expand the ring if crowded
      if (attempt % 6 === 5) {
        rMin += 8;
        rMax += 8;
      }
    }
    // Fallback: ignore overlap and place somewhere in the ring
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const dist = Phaser.Math.FloatBetween(rMin, rMax);
    return { x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist };
  }

  private isNonOverlapping(x: number, y: number, radius: number, padding: number): boolean {
    for (const other of this.bugs.values()) {
      const otherR =
        typeof (other as any).getHitRadius === 'function' ? (other as any).getHitRadius() : 12;
      const minDist = radius + otherR + padding;
      const d = Phaser.Math.Distance.Between(x, y, other.x, other.y);
      if (d < minDist) return false;
    }
    return true;
  }

  // Allow registering houses later (e.g., from a future layout loader)
  private registerHouse(houseId: string, x: number, y: number, radius?: number, language?: string) {
    const { textureKey, language: resolvedLanguage } = this.resolveHouseTexture(language);
    this.houses.set(houseId, { x, y, radius, language: resolvedLanguage, textureKey });

    const meta = this.houseMetadata.get(houseId);
    if (meta) {
      if (resolvedLanguage && meta.language !== resolvedLanguage) {
        this.houseMetadata.set(houseId, { ...meta, language: resolvedLanguage });
      }
    } else {
      this.houseMetadata.set(houseId, { name: houseId, language: resolvedLanguage });
    }

    this.flushPendingForHouse(houseId);
    try {
      this.minimap?.setHouse(houseId, { x, y }, textureKey);
    } catch (error) {
      this.logWarning('registering house on minimap', error);
    }
    this.syncSearchIndex();
  }

  private startRepoEventHarness() {
    const ids = Array.from(this.houseObjects.keys());
    if (ids.length === 0) return;
    // Periodic random commit pulses
    this.time.addEvent({
      delay: 2600,
      loop: true,
      callback: () => {
        const id = Phaser.Utils.Array.GetRandom(ids);
        const h = this.houseObjects.get(id);
        if (!h) return;
        const st: HouseState = {
          name: (h as any).name || id,
          primaryLanguage: (h as any).language,
          openIssues: Phaser.Math.Between(0, 30),
          lastCommitAt: Date.now(),
          buildStatus: 'idle',
        };
        applyRepoStateToHouse(h, st, Date.now());
        this.patchHouseMeta(
          id,
          { issues: st.openIssues, buildStatus: st.buildStatus, language: st.primaryLanguage },
          false,
        );
        this.patchHouseMeta(id, { lastCommitAt: Date.now() }, false);
        this.syncSearchIndex();
      },
    });

    // Periodic random build start/finish
    this.time.addEvent({
      delay: 5200,
      loop: true,
      callback: () => {
        const id = Phaser.Utils.Array.GetRandom(ids);
        const h = this.houseObjects.get(id);
        if (!h) return;
        const start: HouseState = {
          name: (h as any).name || id,
          primaryLanguage: (h as any).language,
          openIssues: Phaser.Math.Between(0, 30),
          buildStatus: 'in_progress',
        };
        applyRepoStateToHouse(h, start, Date.now());
        this.patchHouseMeta(
          id,
          {
            issues: start.openIssues,
            buildStatus: start.buildStatus,
            language: start.primaryLanguage,
          },
          false,
        );
        this.syncSearchIndex();
        // Complete later
        this.time.delayedCall(1600, () => {
          const finish: HouseState = {
            name: (h as any).name || id,
            primaryLanguage: (h as any).language,
            openIssues: Phaser.Math.Between(0, 30),
            buildStatus: Phaser.Math.Between(0, 1) === 0 ? 'passed' : 'failed',
          };
          applyRepoStateToHouse(h, finish, Date.now());
          this.patchHouseMeta(
            id,
            {
              issues: finish.openIssues,
              buildStatus: finish.buildStatus,
              language: finish.primaryLanguage,
            },
            false,
          );
          this.syncSearchIndex();
        });
      },
    });
  }

  private flushPendingForHouse(houseId: string) {
    const list = this.pendingSpawnsByHouse.get(houseId);
    if (!list?.length) return;
    const center = this.houses.get(houseId);
    if (!center) return;
    const items = [...list];
    this.pendingSpawnsByHouse.delete(houseId);
    for (const p of items) {
      // Simulate receiving the event again but now with a resolved center
      const severity =
        (p as any).severity ?? (['low', 'medium', 'high'] as const)[Phaser.Math.Between(0, 2)];
      const pos = this.findNonOverlappingRingPosition(center.x, center.y, severity, 64, 128);
      if (this.bugs.has((p as any).id)) continue;
      const bot = new BugBot(this, (p as any).id, pos.x, pos.y, severity);
      bot.setVisualState('spawn');
      this.bugs.set((p as any).id, bot);
      this.bugBotsGroup?.add(bot);
      this.bugIndex.insert({ id: (p as any).id, x: bot.x, y: bot.y });
      // indexed in bugIndex
    }
  }

  private schedulePendingFlush() {
    if (this.pendingFlushEvent) return;
    // Periodically attempt to flush queued spawns in case houses become available shortly after
    this.pendingFlushEvent = this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        for (const houseId of this.pendingSpawnsByHouse.keys()) {
          this.flushPendingForHouse(houseId);
        }
        if (this.pendingSpawnsByHouse.size === 0) {
          this.pendingFlushEvent?.remove(false);
          this.pendingFlushEvent = undefined;
        }
      },
    });
  }

  private enqueueSpawn(p: any) {
    const id = p?.id;
    if (!id) return;
    if (this.bugs.has(id)) return; // dedupe
    this.pendingSpawnQueue.push(p);
    if (!this.spawnBatchEvent) {
      this.spawnBatchEvent = this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          void this.processSpawnQueue();
        },
      });
    }
  }

  private async processSpawnQueue() {
    let processed = 0;
    while (this.pendingSpawnQueue.length && processed < this.spawnBatchSize) {
      const p = this.pendingSpawnQueue.shift()!;
      const id = p.id;
      if (this.bugs.has(id)) continue;
      const severity =
        p.severity ?? (['low', 'medium', 'high'] as const)[Phaser.Math.Between(0, 2)];
      const center = this.resolveSpawnCenter(p);
      if (!center && p.houseId && (typeof p.x !== 'number' || typeof p.y !== 'number')) {
        const list = this.pendingSpawnsByHouse.get(p.houseId) ?? [];
        list.push(p as any);
        this.pendingSpawnsByHouse.set(p.houseId, list);
        this.schedulePendingFlush();
        continue;
      }
      const { x, y } = center ?? {
        x: typeof p.x === 'number' ? p.x : Phaser.Math.Between(80, this.scale.width - 80),
        y: typeof p.y === 'number' ? p.y : Phaser.Math.Between(80, this.scale.height - 80),
      };
      let pos = { x, y } as { x: number; y: number };
      if (this.bugs.size >= LayoutOffload.threshold) {
        const others = Array.from(this.bugs.values()).map((b) => ({
          x: b.x,
          y: b.y,
          r: typeof (b as any).getHitRadius === 'function' ? (b as any).getHitRadius() : 12,
        }));
        const off = await LayoutOffload.computeRingPosition(x, y, severity, others, 64, 128);
        if (off) pos = off;
        else pos = this.findNonOverlappingRingPosition(x, y, severity, 64, 128);
      } else {
        pos = this.findNonOverlappingRingPosition(x, y, severity, 64, 128);
      }
      const bot = new BugBot(this, id, pos.x, pos.y, severity);
      bot.setVisualState('spawn');
      this.bugs.set(id, bot);
      this.bugBotsGroup?.add(bot);
      this.bugIndex.insert({ id, x: bot.x, y: bot.y });
      if (!this.focusOrder.includes(id)) this.focusOrder.push(id);
      announce(`Bug ${id} spawned with ${severity} severity`);
      this.ensureFocusVisible();
      processed++;
    }
    if (this.pendingSpawnQueue.length === 0 && this.spawnBatchEvent) {
      this.spawnBatchEvent.remove(false);
      this.spawnBatchEvent = undefined;
    }
  }

  private findNearestBug(x: number, y: number, maxDist = 40): BugBot | undefined {
    let pick: BugBot | undefined;
    let best = Number.POSITIVE_INFINITY;
    for (const bot of this.bugs.values()) {
      const d = Phaser.Math.Distance.Between(x, y, bot.x, bot.y);
      if (d < best && d <= maxDist) {
        best = d;
        pick = bot;
      }
    }
    return pick;
  }

  private async assignBug(id: string) {
    if (!this.canAssign) {
      eventBus.emit('toast', { type: 'error', message: 'Insufficient permissions' });
      return;
    }
    try {
      const res = await fetch(`/api/bugs/${encodeURIComponent(id)}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: this.agent?.id ?? 'agent-placeholder' }),
      });
      if (!res.ok) throw new Error(`assign failed: ${res.status}`);
      const bot = this.bugs.get(id);
      bot?.setVisualState('assigned');
      eventBus.emit('toast', { type: 'success', message: `Assigned bug ${id}` });
    } catch (e: any) {
      eventBus.emit('toast', { type: 'error', message: e?.message || 'Assign failed' });
    }
  }

  private celebrate(x: number, y: number) {
    const colors = [0x22c55e, 0x60a5fa, 0xf59e0b, 0xef4444, 0xa78bfa];
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tooMany = this.celebrationsInFlight > 3;
    const count = prefersReduced ? 4 : tooMany ? 6 : 16;
    for (let i = 0; i < count; i++) {
      const r = this.add.rectangle(x, y, 3, 3, colors[i % colors.length], 1);
      const angle = Phaser.Math.DegToRad((360 / 16) * i + Phaser.Math.Between(-10, 10));
      const dist = Phaser.Math.Between(30, 70);
      const tx = x + Math.cos(angle) * dist;
      const ty = y + Math.sin(angle) * dist;
      this.tweens.add({
        targets: r,
        x: tx,
        y: ty,
        alpha: { from: 1, to: 0 },
        rotation: Phaser.Math.FloatBetween(-1, 1),
        duration: Phaser.Math.Between(400, 800),
        ease: 'Cubic.easeOut',
        onComplete: () => r.destroy(),
      });
    }

    // Optional sparkle burst in the center
    const sparkle = this.add.star(x, y, 5, 2, 5, 0xffffff, 1).setAlpha(0.9);
    this.tweens.add({
      targets: sparkle,
      scale: { from: 0.8, to: 1.6 },
      alpha: { from: 0.9, to: 0 },
      rotation: Phaser.Math.FloatBetween(-0.5, 0.5),
      duration: prefersReduced ? 350 : 600,
      ease: 'Sine.easeOut',
      onComplete: () => sparkle.destroy(),
    });

    // Optional sound gated by a user setting (localStorage flag)
    try {
      const soundPref =
        (typeof localStorage !== 'undefined' && localStorage.getItem('celebrationSound')) || 'off';
      if (soundPref === 'on' && this.sound && this.sound.get('celebrate')) {
        this.sound.play('celebrate', { volume: 0.3 });
      }
    } catch (error) {
      this.logWarning('playing celebration sound', error);
    }
  }

  private beginCelebrationWindow() {
    this.celebrationsInFlight += 1;
    if (this.celebrationsInFlight === 1 && this.input) {
      this.input.enabled = false;
    }
  }

  private endCelebrationWindow() {
    this.celebrationsInFlight = Math.max(0, this.celebrationsInFlight - 1);
    if (this.celebrationsInFlight === 0 && this.input) {
      this.input.enabled = true;
    }
  }

  private setupRealtimeOrFallback() {
    try {
      this.ws = new WebSocketService();
      this.ws.connect();
      this.ws.joinVillage('demo');
    } catch (error) {
      this.logWarning('initializing realtime service', error);
      this.startMockTimer();
    }
  }

  private startMockTimer() {
    const states: AgentState[] = ['idle', 'working', 'debugging', 'error'];
    this.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => {
        if (!this.agent) return;
        const next = Phaser.Utils.Array.GetRandom(states);
        this.agent.setAgentState(next);
        if (next === 'working') {
          const x = Phaser.Math.Between(60, this.scale.width - 60);
          const y = Phaser.Math.Between(60, this.scale.height - 60);
          this.agent.walkTo(x, y);
          try {
            this.minimap?.setAgentPosition({ x, y });
          } catch (error) {
            this.logWarning('updating minimap during mock timer walk', error);
          }
        }
      },
    });
  }

  // Layout persistence helpers
  private layoutSaveTimer?: number;
  private queueSaveLayout(flush = false) {
    if (flush) {
      if (this.layoutSaveTimer) window.clearTimeout(this.layoutSaveTimer);
      void this.saveLayout();
      return;
    }
    if (this.layoutSaveTimer) window.clearTimeout(this.layoutSaveTimer);
    this.layoutSaveTimer = window.setTimeout(() => void this.saveLayout(), 1000);
  }
  private async saveLayout() {
    const villageId = (this as any).villageId as string | undefined;
    if (!villageId) return;
    try {
      const payload: any = { version: this.layoutVersion };
      if (this.agent) {
        payload.agents = [
          {
            id: this.agent.id,
            x: this.agent.x,
            y: this.agent.y,
            status: this.agent.agentState,
            spriteConfig: { houseId: this.agent.houseId },
          },
        ];
      }
      const res = await fetch(`/api/villages/${encodeURIComponent(villageId)}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (res.ok) this.layoutVersion += 1;
    } catch (e) {
      void e;
    }
  }
  private async fetchLayout(villageId: string): Promise<any> {
    try {
      const res = await fetch(`/api/villages/${encodeURIComponent(villageId)}/layout`, {
        credentials: 'include',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // Draw a simple isometric diamond grid as the village ground
  private buildGroundGrid(rows = 14, cols = 18, tileW = 48, tileH = 24) {
    if (this.groundLayer) this.groundLayer.destroy(true);
    this.groundLayer = this.add.container(0, 0).setDepth(-100);
    const originX = this.scale.width * 0.5;
    const originY = 140;
    this.gridTx = { rows, cols, tileW, tileH, originX, originY };
    const g = buildIsoGrid(this, { rows, cols, tileW, tileH, originX, originY });
    this.groundLayer.add(g);
    this.groundLayer.setVisible(this.gridVisible);
    // Register a few sample houses on the grid so fast-travel centers can snap
    const sample = [
      { id: 'house-a', r: 6, c: 7 },
      { id: 'house-b', r: 8, c: 10 },
      { id: 'house-c', r: 4, c: 12 },
    ];
    for (const h of sample) {
      const { x, y } = isoToScreen(h.r, h.c, tileW, tileH, originX, originY);
      this.registerHouse(h.id, x, y, 16, this.houseMetadata.get(h.id)?.language);
    }
  }

  private enableCameraControls() {
    const _cam = this.cameras.main;
    if (!_cam) return;
    _cam.setBounds(0, 0, this.scale.width * 2, this.scale.height * 2);
    let isPanning = false;
    let startX = 0,
      startY = 0,
      baseX = 0,
      baseY = 0;
    // Track pinch gesture for mobile zoom
    const pinch = { active: false, startDist: 0, startZoom: _cam.zoom, midX: 0, midY: 0 };
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, _targets: any[]) => {
      if ((p as any).dragState) return; // don't pan while dragging objects
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        pinch.active = true;
        pinch.startZoom = _cam.zoom;
        pinch.startDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        pinch.midX = (p1.x + p2.x) / 2;
        pinch.midY = (p1.y + p2.y) / 2;
        isPanning = false;
      } else {
        isPanning = true;
        startX = p.x;
        startY = p.y;
        baseX = _cam.scrollX;
        baseY = _cam.scrollY;
      }
    });
    this.input.on('pointerup', () => {
      isPanning = false;
      pinch.active = false;
    });
    this.input.on('pointerupoutside', () => {
      isPanning = false;
      pinch.active = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (pinch.active && p1.isDown && p2.isDown) {
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const before = _cam.getWorldPoint(midX, midY);
        const newDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (pinch.startDist > 0) {
          const scale = newDist / pinch.startDist;
          const next = Phaser.Math.Clamp(pinch.startZoom * scale, this.minZoom, this.maxZoom);
          if (Math.abs(next - _cam.zoom) > 1e-4) {
            _cam.setZoom(next);
            const after = _cam.getWorldPoint(midX, midY);
            _cam.scrollX += before.x - after.x;
            _cam.scrollY += before.y - after.y;
          }
        }
        return;
      }
      if (!isPanning || !p.isDown) return;
      const dx = (p.x - startX) / _cam.zoom;
      const dy = (p.y - startY) / _cam.zoom;
      _cam.scrollX = baseX - dx;
      _cam.scrollY = baseY - dy;
    });
    // Wheel zoom with cursor anchoring
    this.input.on('wheel', (p: Phaser.Input.Pointer, _dx: number, dy: number) => {
      const before = _cam.getWorldPoint(p.x, p.y);
      const next = Phaser.Math.Clamp(_cam.zoom - dy * 0.001, this.minZoom, this.maxZoom);
      if (Math.abs(next - _cam.zoom) < 1e-4) return;
      _cam.setZoom(next);
      const after = _cam.getWorldPoint(p.x, p.y);
      _cam.scrollX += before.x - after.x;
      _cam.scrollY += before.y - after.y;
    });
    // Double-click to center camera (prefer nearest registered house)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const now = p.downTime || Date.now();
      if (now - this.lastClickAt < 250) {
        const world = _cam.getWorldPoint(p.x, p.y);
        const house = this.findNearestHouse(world.x, world.y, 80);
        let tx = world.x;
        let ty = world.y;
        if (house) {
          tx = house.x;
          ty = house.y;
        } else {
          const snap = this.snapWorldToIsoCenter(world.x, world.y);
          if (snap) {
            tx = snap.x;
            ty = snap.y;
          }
        }
        this.camNav?.panTo(tx, ty, 250);
      }
      this.lastClickAt = now;
    });
  }

  private findNearestHouse(
    x: number,
    y: number,
    maxDist = 120,
  ): { id: string; x: number; y: number } | null {
    let best: { id: string; x: number; y: number } | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const [id, h] of this.houses) {
      const d = Phaser.Math.Distance.Between(x, y, h.x, h.y);
      if (d < bestD && d <= maxDist) {
        bestD = d;
        best = { id, x: h.x, y: h.y };
      }
    }
    return best;
  }

  private syncSearchIndex() {
    try {
      const agents = this.agent
        ? [
            {
              type: 'agent' as const,
              id: this.agent.id,
              name: this.agent.nameText.text || this.agent.id,
              status: this.agent.agentState,
              houseId: this.agent.houseId,
              houseName: this.agent.houseId
                ? (this.houseMetadata.get(this.agent.houseId)?.name ?? this.agent.houseId)
                : undefined,
            },
          ]
        : [];
      const houses = Array.from(this.houseObjects.entries()).map(([id, house]) => {
        const meta = this.houseMetadata.get(id);
        return {
          type: 'house' as const,
          id,
          name: meta?.name ?? (house as any).name ?? id,
          location: meta?.language,
          components: meta?.components,
        };
      });
      const actions: Array<{
        type: 'action';
        id: string;
        label: string;
        actionId?: string;
        payload?: any;
      }> = [];
      if (this.agent) {
        const agentId = this.agent.id;
        const agentLabel = this.agent.nameText.text || agentId;
        actions.push({
          type: 'action',
          id: `start:${agentId}`,
          label: `Start ${agentLabel}`,
          actionId: 'startAgent',
          payload: { agentId },
        });
        actions.push({
          type: 'action',
          id: `stop:${agentId}`,
          label: `Stop ${agentLabel}`,
          actionId: 'stopAgent',
          payload: { agentId },
        });
        actions.push({
          type: 'action',
          id: `runTool:${agentId}`,
          label: `Run recent tool on ${agentLabel}`,
          actionId: 'runRecentTool',
          payload: { agentId, toolId: 'last' },
        });
        for (const [id, meta] of this.houseMetadata) {
          actions.push({
            type: 'action',
            id: `assign:${agentId}:${id}`,
            label: `Assign ${agentLabel} to ${meta.name || id}`,
            actionId: 'assignAgentToHouse',
            payload: { agentId, houseId: id },
          });
          actions.push({
            type: 'action',
            id: `goto:${id}`,
            label: `Go to ${meta.name || id}`,
            actionId: 'navigateToHouse',
            payload: { houseId: id },
          });
          actions.push({
            type: 'action',
            id: `dashboard:${id}`,
            label: `Open dashboard for ${meta.name || id}`,
            actionId: 'openHouseDashboard',
            payload: { houseId: id },
          });
        }
      }
      SearchIndex.setData({ agents, houses, actions });
    } catch (error) {
      this.logWarning('updating search index', error);
    }
  }

  private assignAgentToHouse(houseId: string, _opts?: { source?: string }) {
    if (!this.agent) return;
    if (!this.houseMetadata.has(houseId)) this.houseMetadata.set(houseId, { name: houseId });
    const prevHouseId = this.agent.houseId;
    this.destroyHouseAssignMenu();
    if (prevHouseId === houseId) {
      this.highlightHouse(houseId);
      return;
    }
    this.agent.setHouseAssignment(houseId);
    const loc = this.houses.get(houseId);
    if (loc) {
      this.agent.walkTo(loc.x, loc.y);
      try {
        this.minimap?.setAgentPosition({ x: loc.x, y: loc.y });
      } catch (error) {
        this.logWarning('updating minimap after house assignment', error);
      }
    }
    const agentInfo = {
      id: this.agent.id,
      name: this.agent.nameText.text || this.agent.id,
    };
    this.updateHouseAgentMembership(prevHouseId, houseId, agentInfo);
    this.highlightHouse(houseId);
    this.syncSearchIndex();
    const houseName = this.houseMetadata.get(houseId)?.name ?? houseId;
    eventBus.emit('toast', {
      type: 'success',
      message: `Assigned ${agentInfo.name} to ${houseName}`,
    });
    track({
      type: 'house_command',
      ts: Date.now(),
      houseId,
      command: 'assign_agent',
      status: 'success',
    });
    this.queueSaveLayout();
  }

  public focusHouseById(houseId: string, opts?: { source?: string; agentId?: string }) {
    const loc = this.houses.get(houseId);
    if (!loc) return;
    this.beginTravelPerf(opts?.source || 'house_focus');
    this.camNav?.panTo(loc.x, loc.y, 220);
    this.highlightHouse(houseId);
  }

  public openHouseDashboard(houseId: string, opts?: { source?: string }) {
    const meta = this.houseMetadata.get(houseId);
    const payload = {
      houseId,
      name: meta?.name ?? houseId,
      language: meta?.language,
      components: meta?.components ?? this.deriveComponents(meta?.language),
      issues: meta?.issues,
      agents: meta?.agents ?? [],
      stars: meta?.stars,
      buildStatus: meta?.buildStatus ?? 'idle',
      source: opts?.source,
    };
    eventBus.emit('house_dashboard', payload);
    this.highlightHouse(houseId);
  }

  public promptAgentHouseAssignment(agent: Agent) {
    const entries = Array.from(this.houseMetadata.entries());
    if (entries.length === 0) {
      eventBus.emit('toast', { type: 'error', message: 'No houses available' });
      return;
    }
    this.destroyHouseAssignMenu();
    const width = 200;
    const height = entries.length * 26 + 20;
    const menu = this.add.container(agent.x + 24, agent.y - height / 2);
    menu.setDepth(3000);
    const bg = this.add.rectangle(0, 0, width, height, 0x0f172a, 0.96).setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x334155, 1);
    menu.add(bg);
    entries.forEach(([id, meta], idx) => {
      const text = this.add.text(12, 10 + idx * 26, meta.name || id, {
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '12px',
      });
      text
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          pointer.event?.stopPropagation?.();
          this.assignAgentToHouse(id, { source: 'menu' });
          this.destroyHouseAssignMenu();
        });
      menu.add(text);
    });
    this.houseAssignMenu = menu;
    const handler = (pointer: Phaser.Input.Pointer, objects: any[]) => {
      if (!this.houseAssignMenu) return;
      const within = objects.some((obj) => {
        if (!obj) return false;
        if (obj === this.houseAssignMenu) return true;
        if (Array.isArray((this.houseAssignMenu as any).list))
          return (this.houseAssignMenu as any).list.includes(obj);
        return false;
      });
      if (!within) this.destroyHouseAssignMenu();
    };
    this.houseAssignInputHandler = handler;
    this.input.on('pointerdown', handler);
  }

  private destroyHouseAssignMenu() {
    if (this.houseAssignMenu) {
      this.houseAssignMenu.destroy(true);
      this.houseAssignMenu = undefined;
    }
    if (this.houseAssignInputHandler) {
      this.input.off('pointerdown', this.houseAssignInputHandler);
      this.houseAssignInputHandler = undefined;
    }
  }

  private highlightHouse(houseId: string) {
    const house = this.houseObjects.get(houseId);
    if (house && typeof (house as any).pulseHighlight === 'function') {
      (house as any).pulseHighlight();
      return;
    }
    const info = this.houses.get(houseId);
    if (info) {
      const ring = this.add.circle(info.x, info.y, (info.radius ?? 24) * 2, 0x38bdf8, 0.18);
      ring.setDepth(2000);
      this.tweens.add({
        targets: ring,
        scale: { from: 0.7, to: 1.2 },
        alpha: { from: 0.6, to: 0 },
        duration: 360,
        ease: 'Sine.easeOut',
        onComplete: () => ring.destroy(),
      });
    }
  }

  private deriveComponents(language?: string): string[] {
    const map: Record<string, string[]> = {
      ts: ['Node SDK', 'React UI', 'Vitest'],
      js: ['Node SDK', 'React UI'],
      py: ['FastAPI', 'Celery', 'pytest'],
      go: ['Go Worker', 'gRPC'],
      rb: ['Rails', 'Sidekiq'],
    };
    if (!language) return ['Docs', 'CLI'];
    return map[language] ? [...map[language]] : ['Docs', 'CI'];
  }

  private updateHouseAgentMembership(
    prevHouseId: string | undefined,
    nextHouseId: string,
    agent: { id: string; name: string },
  ) {
    if (prevHouseId && prevHouseId !== nextHouseId) {
      const prevMeta = this.houseMetadata.get(prevHouseId);
      if (prevMeta?.agents) {
        prevMeta.agents = prevMeta.agents.filter((a) => a.id !== agent.id);
        this.houseMetadata.set(prevHouseId, prevMeta);
      }
    }
    const meta = this.houseMetadata.get(nextHouseId) ?? { name: nextHouseId };
    const list = meta.agents ? [...meta.agents] : [];
    if (!list.some((a) => a.id === agent.id)) list.push(agent);
    meta.agents = list;
    this.houseMetadata.set(nextHouseId, meta);
  }

  private patchHouseMeta(houseId: string, patch: Partial<HouseMeta>, resync = true) {
    const meta = this.houseMetadata.get(houseId) ?? { name: houseId };
    const updated = { ...meta, ...patch };
    this.houseMetadata.set(houseId, updated);

    if (patch.language) {
      const entry = this.houses.get(houseId);
      if (entry) {
        const { textureKey, language: resolvedLanguage } = this.resolveHouseTexture(patch.language);
        this.houses.set(houseId, { ...entry, textureKey, language: resolvedLanguage });
        try {
          this.minimap?.setHouse(houseId, { x: entry.x, y: entry.y }, textureKey);
        } catch (error) {
          this.logWarning('updating minimap after house language change', error);
        }
      }
    }

    const snapshot = this.buildHouseSnapshot(houseId);
    if (snapshot) {
      this.npcManager?.updateHouseSnapshot(snapshot);
    }

    if (resync) this.syncSearchIndex();
  }

  private buildHouseSnapshot(houseId: string): HouseSnapshot | null {
    const entry = this.houses.get(houseId);
    if (!entry) return null;
    const meta = this.houseMetadata.get(houseId);
    return {
      id: houseId,
      name: meta?.name ?? houseId,
      language: meta?.language ?? entry.language ?? 'generic',
      position: { x: entry.x, y: entry.y },
      radius: entry.radius,
      metadata: meta,
    };
  }

  private parseSpriteConfig(raw: any): Record<string, any> {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    if (typeof raw === 'object') return raw as Record<string, any>;
    return {};
  }

  private flushProgress() {
    if (this.pendingProgress.size === 0) return;
    const entries = Array.from(this.pendingProgress.entries());
    this.pendingProgress.clear();
    for (const [id, value] of entries) {
      const bot = this.bugs.get(id);
      if (bot) bot.setProgress(value);
    }
  }

  private cullOffscreen() {
    const cam = this.cameras.main;
    const view = cam.worldView;
    const margin = 48;
    const zoom = cam.zoom;
    const x0 = view.x - margin,
      y0 = view.y - margin,
      x1 = view.x + view.width + margin,
      y1 = view.y + view.height + margin;
    const ids = this.bugIndex.queryRect(x0, y0, x1 - x0, y1 - y0, []);
    const candidates = new Set(ids);
    // First hide non-visible, then show visible
    for (const [id, bot] of this.bugs) {
      const visible = candidates.has(id);
      if (!visible) {
        bot.setVisible(false);
        bot.pausePulse();
      }
    }
    for (const id of candidates) {
      const bot = this.bugs.get(id);
      if (!bot) continue;
      const visible = bot.x >= x0 && bot.x <= x1 && bot.y >= y0 && bot.y <= y1;
      if (!visible) continue;
      bot.setVisible(true);
      // Zoom-based LOD: when zoomed out, reduce pulse frame rate
      if (zoom < 0.8) bot.setPulseTimeScale(0.6);
      else if (zoom < 1.0) bot.setPulseTimeScale(0.8);
      else bot.setPulseTimeScale(1.0);
      bot.resumePulse();
    }
  }

  private handlePanKeys(dir: 'left' | 'right' | 'up' | 'down', e: KeyboardEvent) {
    if (!e.shiftKey) return;
    e.preventDefault();
    const cam = this.cameras.main;
    const view = cam.worldView;
    const cx = view.x + view.width * 0.5;
    const cy = view.y + view.height * 0.5;
    const step = 200 / cam.zoom;
    let tx = cx;
    let ty = cy;
    if (dir === 'left') tx -= step;
    if (dir === 'right') tx += step;
    if (dir === 'up') ty -= step;
    if (dir === 'down') ty += step;
    this.beginTravelPerf('keys');
    this.camNav?.panTo(tx, ty, 200);
    announce('Panning view');
  }

  private handleNearestHouseKey(e: KeyboardEvent) {
    const cam = this.cameras.main;
    const view = cam.worldView;
    const cx = view.x + view.width * 0.5;
    const cy = view.y + view.height * 0.5;
    const house = this.findNearestHouse(cx, cy, Number.POSITIVE_INFINITY);
    if (!house) return;
    e.preventDefault();
    this.beginTravelPerf('nearest_house');
    this.camNav?.panTo(house.x, house.y, 250);
    announce('Traveling to nearest house');
  }

  private beginTravelPerf(source: string) {
    startTravel();
    this.travelStartAt = performance.now();
    const cam = this.cameras.main;
    const onDone = () => {
      try {
        const ms = Math.round(performance.now() - (this.travelStartAt || performance.now()));
        if (ms > 2000) {
          announce('Travel took longer than two seconds');
          eventBus.emit('toast', { type: 'info', message: `Travel took ${ms}ms` });
        }
        const villageId = (this as any).villageId as string | undefined;
        track({
          type: 'command_executed',
          ts: Date.now(),
          command: `fast_travel:${ms}ms:${source}`,
          villageId,
        });
      } catch (error) {
        this.logWarning('finishing travel metrics', error);
      }
      cam.off('camerapancomplete', onDone);
    };
    cam.once('camerapancomplete', onDone);
  }

  private ensureFocusVisible() {
    if (!this.focusRing) return;
    this.focusRing.clear();
    if (this.focusedIndex < 0 || this.focusedIndex >= this.focusOrder.length) return;
    const id = this.focusOrder[this.focusedIndex];
    const bot = this.bugs.get(id);
    if (!bot) return;
    this.focusRing.lineStyle(2, 0xfef08a, 1);
    this.focusRing.strokeCircle(bot.x, bot.y, bot.getHitRadius() + 8);
    announce(`Focused bug ${id}`);
  }

  private assignFocused() {
    if (this.focusedIndex < 0 || this.focusedIndex >= this.focusOrder.length) return;
    const id = this.focusOrder[this.focusedIndex];
    this.assignBug(id);
    announce(`Assigning bug ${id}`);
  }

  private hintsVisible = true;
  private hintsText?: Phaser.GameObjects.Text;
  private toggleHints() {
    this.hintsVisible = !this.hintsVisible;
    if (this.hintsVisible) {
      if (!this.hintsText) {
        this.hintsText = this.add
          .text(12, 12, 'Tab: focus bugs • Enter: assign • H: toggle hints', {
            color: '#e2e8f0',
            fontFamily: 'monospace',
            fontSize: '11px',
            backgroundColor: 'rgba(11,18,32,0.7)',
          })
          .setScrollFactor(0)
          .setDepth(1000);
      }
      this.hintsText.setVisible(true);
    } else {
      this.hintsText?.setVisible(false);
    }
  }

  private toggleGrid() {
    this.gridVisible = !this.gridVisible;
    if (this.groundLayer) this.groundLayer.setVisible(this.gridVisible);
  }

  // Spawn a number of demo BugBots across an expanded world area for perf testing
  private profileSpawn(count: number) {
    const worldW = this.scale.width * 2;
    const worldH = this.scale.height * 2;
    const severities = ['low', 'medium', 'high'] as const;
    for (let i = 0; i < count; i++) {
      const id = `profile-${Date.now()}-${i}`;
      const x = Phaser.Math.Between(60, worldW - 60);
      const y = Phaser.Math.Between(60, worldH - 60);
      const severity = severities[i % severities.length];
      this.enqueueSpawn({ id, x, y, severity });
    }
  }

  // Convert a world coordinate to the center of the nearest iso tile
  private snapWorldToIsoCenter(x: number, y: number): { x: number; y: number } | null {
    if (!this.gridTx) return null;
    const _cam = this.cameras.main;
    const wx = x;
    const wy = y;
    // Use current grid transform for rounding
    const { tileW, tileH, originX, originY } = this.gridTx;
    const { screenToIso, isoToScreen } = require('../utils/iso');
    const tile = screenToIso(wx, wy, tileW, tileH, originX, originY);
    const rc = {
      r: Phaser.Math.Clamp(tile.r, 0, this.gridTx.rows - 1),
      c: Phaser.Math.Clamp(tile.c, 0, this.gridTx.cols - 1),
    };
    return isoToScreen(rc.r, rc.c, tileW, tileH, originX, originY);
  }

  // Register a house by tile coordinates (row/col) rather than absolute pixels
  private registerHouseAt(id: string, r: number, c: number, radius = 16) {
    if (!this.gridTx) return;
    const { tileW, tileH, originX, originY } = this.gridTx;
    const { isoToScreen } = require('../utils/iso');
    const { x, y } = isoToScreen(r, c, tileW, tileH, originX, originY);
    this.registerHouse(id, x, y, radius, this.houseMetadata.get(id)?.language);
  }

  // Navigate agent to nearest house using grid A* pathfinding
  private moveAgentToNearestHouse() {
    if (!this.agent || !this.gridTx) return;
    const { screenToIso, isoToScreen } = require('../utils/iso');
    const { astar, simplifyPath } = require('../utils/pathfinding');
    const _cam = this.cameras.main;
    // Pick nearest house center
    const target = this.findNearestHouse(this.agent.x, this.agent.y, 1000);
    if (!target) return;
    // Build obstacle map: mark tiles around houses as blocked
    const tx = this.gridTx;
    const blockedSet = new Set<string>();
    for (const h of this.houses.values()) {
      const tile = screenToIso(h.x, h.y, tx.tileW, tx.tileH, tx.originX, tx.originY);
      const radius = Math.max(1, Math.round((h.radius ?? 12) / (tx.tileH / 2)));
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const rr = tile.r + dr;
          const cc = tile.c + dc;
          if (rr >= 0 && cc >= 0 && rr < tx.rows && cc < tx.cols) blockedSet.add(`${rr},${cc}`);
        }
      }
    }
    const grid = {
      rows: tx.rows,
      cols: tx.cols,
      blocked: (r: number, c: number) => blockedSet.has(`${r},${c}`),
    };
    const start = screenToIso(
      this.agent.x,
      this.agent.y,
      tx.tileW,
      tx.tileH,
      tx.originX,
      tx.originY,
    );
    const goal = screenToIso(target.x, target.y, tx.tileW, tx.tileH, tx.originX, tx.originY);
    const path = astar(grid, start, goal);
    if (!path) return;
    const simple = simplifyPath(path);
    const points = simple.map((p: any) =>
      isoToScreen(p.r, p.c, tx.tileW, tx.tileH, tx.originX, tx.originY),
    );
    this.agent.walkPath(points);
  }
}
