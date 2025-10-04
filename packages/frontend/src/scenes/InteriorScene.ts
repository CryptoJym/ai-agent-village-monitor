import Phaser from 'phaser';
import { Agent } from '../agents/Agent';
import { AssetManager } from '../assets/AssetManager';
import { pixellabTileMetadata, pixellabInteriorMetadata } from '../assets/pixellabManifest';
import { houseBlueprints, type HouseBlueprint } from '../data/houses';
import { findGridPath } from '../world/pathfinding';
import { Minimap } from '../overlays/Minimap';
import { playAmbient, stopAmbient, type AmbientConfig } from '../audio/ambient';

const TILE_SIZE_DEFAULT = 32;
const RETURN_SCENE_DEFAULT = 'MainScene';
const TILE_CATEGORY = 'interior';

const LANGUAGE_TO_THEME: Record<string, string> = {
  js: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  py: 'python',
  python: 'python',
  go: 'go',
  rb: 'ruby',
  ruby: 'ruby',
  java: 'java',
  cs: 'csharp',
  csharp: 'csharp',
  generic: 'commons',
  commons: 'commons',
};

const BLUEPRINT_BY_THEME = houseBlueprints.reduce<Record<string, HouseBlueprint>>((acc, bp) => {
  acc[bp.theme.toLowerCase()] = bp;
  return acc;
}, {});

let ambientCounter = 0;

const AMBIENT_CONFIGS: Record<string, AmbientConfig> = {
  javascript: {
    frequencies: [220, 330, 440],
    type: 'square',
    volume: 0.035,
    filterFrequency: 1600,
    vibratoFrequency: 0.8,
    vibratoDepth: 6,
  },
  typescript: {
    frequencies: [210, 315, 420],
    type: 'triangle',
    volume: 0.035,
    filterFrequency: 1400,
    vibratoFrequency: 0.6,
    vibratoDepth: 5,
  },
  python: {
    frequencies: [180, 240, 300],
    type: 'triangle',
    volume: 0.03,
    filterFrequency: 1200,
    vibratoFrequency: 0.5,
    vibratoDepth: 4,
  },
  go: {
    frequencies: [196, 247, 330],
    type: 'square',
    volume: 0.032,
    filterFrequency: 1100,
    vibratoFrequency: 0.45,
    vibratoDepth: 3,
  },
  ruby: {
    frequencies: [240, 360, 480],
    type: 'sawtooth',
    volume: 0.028,
    filterFrequency: 1000,
    vibratoFrequency: 0.7,
    vibratoDepth: 5,
  },
  java: {
    frequencies: [210, 280, 350],
    type: 'triangle',
    volume: 0.03,
    filterFrequency: 900,
    vibratoFrequency: 0.4,
    vibratoDepth: 4,
  },
  csharp: {
    frequencies: [260, 390, 520],
    type: 'square',
    volume: 0.03,
    filterFrequency: 1500,
    vibratoFrequency: 0.9,
    vibratoDepth: 6,
  },
  commons: {
    frequencies: [200, 267, 334],
    type: 'triangle',
    volume: 0.028,
    filterFrequency: 1000,
    vibratoFrequency: 0.5,
    vibratoDepth: 3,
  },
};

const THEME_LIGHTING: Record<string, { color: number; alpha: number; pulse?: number }> = {
  javascript: { color: 0x1b1f4b, alpha: 0.35, pulse: 1500 },
  typescript: { color: 0x14253b, alpha: 0.32, pulse: 1800 },
  python: { color: 0x1b3a24, alpha: 0.28, pulse: 2200 },
  go: { color: 0x0f2f40, alpha: 0.26, pulse: 2000 },
  ruby: { color: 0x3a0f1f, alpha: 0.34, pulse: 1600 },
  java: { color: 0x2e1c3b, alpha: 0.3, pulse: 1900 },
  csharp: { color: 0x1e2f45, alpha: 0.33, pulse: 2100 },
  commons: { color: 0x1c1c2b, alpha: 0.25, pulse: 2400 },
};

function resolveTheme(language?: string): string {
  const normalized = (language || '').toLowerCase();
  return LANGUAGE_TO_THEME[normalized] ?? (normalized || 'commons');
}

function getBlueprint(theme: string): HouseBlueprint {
  return BLUEPRINT_BY_THEME[theme] ?? BLUEPRINT_BY_THEME['commons'];
}

function getInteriorMetadata(theme: string) {
  return (
    pixellabInteriorMetadata[theme as keyof typeof pixellabInteriorMetadata] ??
    pixellabInteriorMetadata.commons
  );
}

type InteriorSceneData = {
  villageId?: string;
  houseId?: string;
  language?: string;
  returnScene?: string;
  returnCamera?: { scrollX: number; scrollY: number; zoom: number };
};

type InteriorPropMeta = (typeof pixellabInteriorMetadata)['commons']['props'][number];

export class InteriorScene extends Phaser.Scene {
  private launchData: InteriorSceneData = {};
  private blueprint!: HouseBlueprint;
  private theme!: string;
  private tileKey!: string;
  private tileSize = TILE_SIZE_DEFAULT;
  private passableTiles = new Set<string>();
  private blockedTiles = new Set<string>();
  private agent?: Agent;
  private pointerListener?: (pointer: Phaser.Input.Pointer) => void;
  private escapeListener?: (event: KeyboardEvent) => void;
  private interiorMinimap?: Minimap;
  private minimapTimer?: Phaser.Time.TimerEvent;
  private npcs: Agent[] = [];
  private npcTimers: Phaser.Time.TimerEvent[] = [];
  private exitMarker?: Phaser.GameObjects.Triangle;
  private ambientId?: string;
  private lightingOverlay?: Phaser.GameObjects.Rectangle;

  constructor() {
    super('InteriorScene');
  }

  init(data: InteriorSceneData) {
    this.launchData = data ?? {};
    this.theme = resolveTheme(this.launchData.language);
    this.blueprint = getBlueprint(this.theme);
    const interiorMeta = getInteriorMetadata(this.theme);
    const tileCandidate = interiorMeta?.tilesetKey?.split('/')?.[1] ?? '';
    const blueprintTileCandidate = this.blueprint.tilesetKey.split('/')?.[1] ?? '';
    this.tileKey = tileCandidate || blueprintTileCandidate || 'generic-commons';
    const tileMeta = pixellabTileMetadata.interior;
    const tilesetEntry = tileMeta?.[this.tileKey as keyof typeof tileMeta];
    if (tilesetEntry?.tileSize?.width) {
      this.tileSize = tilesetEntry.tileSize.width;
    }
  }

  create() {
    this.cameras.main.fadeIn(200, 11, 17, 26);
    this.renderFloor();
    this.renderProps();
    this.spawnAgent();
    this.configureCamera();
    this.applyLightingTheme();
    this.startAmbientSound();
    this.spawnAmbientNpcs();
    this.setupMinimap();
    this.attachInputHandlers();
    this.drawUi();
    this.drawExitMarker();
  }

  private tileTextureKey(): string {
    return `pixellabTile:${TILE_CATEGORY}:${this.tileKey}`;
  }

  private renderFloor() {
    const tileMeta = pixellabTileMetadata.interior;
    const entry = tileMeta?.[this.tileKey as keyof typeof tileMeta];
    if (!entry) return;

    const lowerFrame = entry.lower?.baseTileId;
    const transitionFrame: number | undefined = (
      entry.transition?.size && 'baseTileId' in entry.transition
        ? entry.transition.baseTileId
        : undefined
    ) as number | undefined;

    const grid = this.blueprint.vertexGrid;
    const { width, height } = this.blueprint.dimensions;
    const container = this.add.layer();
    container.setDepth(0);

    const toIndex = (x: number, y: number) => `${x},${y}`;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const inside = this.isTileInside(grid, x, y);
        if (!inside || !lowerFrame) continue;
        const worldX = x * this.tileSize;
        const worldY = y * this.tileSize;
        const image = this.add.image(worldX, worldY, this.tileTextureKey(), lowerFrame);
        image.setOrigin(0, 0);
        image.setDisplaySize(this.tileSize, this.tileSize);
        container.add(image);
        this.passableTiles.add(toIndex(x, y));

        if (transitionFrame && this.isEdgeTile(grid, x, y)) {
          const overlay = this.add.image(worldX, worldY, this.tileTextureKey(), transitionFrame);
          overlay.setOrigin(0, 0);
          overlay.setDisplaySize(this.tileSize, this.tileSize);
          overlay.setAlpha(0.8);
          container.add(overlay);
        }
      }
    }
  }

  private renderProps() {
    const interiorMeta = getInteriorMetadata(this.theme);
    const propsByKey = new Map<string, InteriorPropMeta>();
    for (const prop of interiorMeta.props || []) {
      propsByKey.set(prop.key, prop as InteriorPropMeta);
    }

    for (const prop of this.blueprint.props || []) {
      const meta = propsByKey.get(prop.key);
      const textureKey = AssetManager.interiorPropTextureKey(this.theme, prop.key);
      const world = this.tileToWorld(prop.position[0], prop.position[1]);
      const sprite = this.add.image(world.x, world.y, textureKey);
      sprite.setOrigin(0.5, 1);
      sprite.setDisplaySize(this.tileSize, this.tileSize);
      sprite.setDepth(20 + world.y);
      if (prop.passable === false || meta?.passable === false) {
        this.blockedTiles.add(`${Math.round(prop.position[0])},${Math.round(prop.position[1])}`);
      }
    }
  }

  private isWalkable(x: number, y: number): boolean {
    const key = `${x},${y}`;
    return this.passableTiles.has(key) && !this.blockedTiles.has(key);
  }

  private spawnAgent() {
    const spawnTile = this.blueprint.spawns?.player ?? [
      Math.floor(this.blueprint.dimensions.width / 2),
      Math.floor(this.blueprint.dimensions.height / 2),
    ];
    const spawnPoint = this.tileToWorld(spawnTile[0], spawnTile[1]);
    this.agent = new Agent(this, spawnPoint.x, spawnPoint.y, {
      id: `${this.launchData.houseId ?? 'house'}-visitor`,
      name: 'Visitor',
      state: 'idle',
    });
    this.agent.setDepth(1000);
    this.agent.disableInteractive();
  }

  private configureCamera() {
    const { width, height } = this.blueprint.dimensions;
    const worldWidth = width * this.tileSize;
    const worldHeight = height * this.tileSize;
    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldWidth, worldHeight);
    const zoom = Math.min(2.5, Math.max(1.1, 640 / Math.max(worldWidth, worldHeight)));
    cam.setZoom(zoom);
    const spawn = this.blueprint.spawns?.player ?? [1, 1];
    const spawnPoint = this.tileToWorld(spawn[0], spawn[1]);
    cam.centerOn(spawnPoint.x, spawnPoint.y);
    cam.setBackgroundColor('#0b1220');
  }

  private applyLightingTheme() {
    const config = THEME_LIGHTING[this.theme] ?? THEME_LIGHTING.commons;
    const width = this.blueprint.dimensions.width * this.tileSize;
    const height = this.blueprint.dimensions.height * this.tileSize;
    this.lightingOverlay?.destroy();
    this.lightingOverlay = this.add
      .rectangle(0, 0, width + this.tileSize, height + this.tileSize, config.color, config.alpha)
      .setOrigin(0, 0)
      .setDepth(15)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (config.pulse) {
      this.tweens.add({
        targets: this.lightingOverlay,
        alpha: {
          from: config.alpha * 0.9,
          to: config.alpha * 1.1,
        },
        duration: config.pulse,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private startAmbientSound() {
    const config = AMBIENT_CONFIGS[this.theme] ?? AMBIENT_CONFIGS.commons;
    const id = `interior-${this.theme}-${ambientCounter++}`;
    this.ambientId = id;
    playAmbient(id, config);
  }

  private stopAmbientSound() {
    if (this.ambientId) {
      stopAmbient(this.ambientId);
      this.ambientId = undefined;
    }
  }

  private getAgentTile(): { x: number; y: number } | null {
    if (!this.agent) return null;
    return this.worldToTile(this.agent.x, this.agent.y);
  }

  private refreshMinimapSources() {
    if (!this.interiorMinimap) return;
    if (this.agent) {
      this.interiorMinimap.setAgentPosition({ x: this.agent.x, y: this.agent.y });
    }
    this.npcs.forEach((npc) => {
      this.interiorMinimap?.setNpc(npc.id, { x: npc.x, y: npc.y });
    });
  }

  private updateNpcMinimap(npc: Agent) {
    if (!this.interiorMinimap) return;
    this.interiorMinimap.setNpc(npc.id, { x: npc.x, y: npc.y });
  }

  private setupMinimap() {
    const worldWidth = this.blueprint.dimensions.width * this.tileSize;
    const worldHeight = this.blueprint.dimensions.height * this.tileSize;
    try {
      this.interiorMinimap = new Minimap(this, {
        width: 160,
        height: 110,
        world: { w: worldWidth, h: worldHeight },
      });
      this.refreshMinimapSources();
      this.interiorMinimap.setViewport(this.cameras.main.worldView as any);
      this.interiorMinimap.setOnTeleport(({ x, y }) => this.handleMinimapTeleport(x, y));
      this.input.keyboard?.on('keydown-M', () => this.interiorMinimap?.toggle());
      this.minimapTimer = this.time.addEvent({
        delay: 200,
        loop: true,
        callback: () => {
          this.refreshMinimapSources();
          this.interiorMinimap?.setViewport(this.cameras.main.worldView as any);
        },
      });
    } catch (error) {
      if (import.meta.env?.DEV && typeof console !== 'undefined') {
        console.warn('[InteriorScene] minimap init failed', error);
      }
    }
  }

  private attachInputHandlers() {
    this.pointerListener = (pointer: Phaser.Input.Pointer) => {
      if (!this.agent || pointer.rightButtonDown()) return;
      const goal = this.worldToTile(pointer.worldX, pointer.worldY);
      const start = this.getAgentTile();
      if (!goal || !start) return;
      if (!this.isWalkable(goal.x, goal.y)) return;
      const pathTiles = findGridPath(start, goal, {
        width: this.blueprint.dimensions.width,
        height: this.blueprint.dimensions.height,
        isWalkable: (x, y) => this.isWalkable(x, y),
      });
      if (!pathTiles || pathTiles.length === 0) return;
      const worldPath = pathTiles.slice(1).map((step) => this.tileToWorld(step.x, step.y));
      if (worldPath.length === 0) return;
      this.agent.walkPath(worldPath);
      this.interiorMinimap?.setAgentPosition({ x: this.agent.x, y: this.agent.y });
    };
    this.input.on('pointerup', this.pointerListener, this);

    this.escapeListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.exitInterior();
      }
    };
    window.addEventListener('keydown', this.escapeListener);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.pointerListener) this.input.off('pointerup', this.pointerListener, this);
      if (this.escapeListener) window.removeEventListener('keydown', this.escapeListener);
      this.minimapTimer?.remove(false);
      this.minimapTimer = undefined;
      this.npcTimers.forEach((timer) => timer.remove(false));
      this.npcTimers = [];
      this.npcs.forEach((npc) => this.interiorMinimap?.setNpc(npc.id));
      this.npcs.forEach((npc) => npc.destroy());
      this.npcs = [];
      this.interiorMinimap?.destroy();
      this.interiorMinimap = undefined;
      this.exitMarker?.destroy();
      this.exitMarker = undefined;
      this.lightingOverlay?.destroy();
      this.lightingOverlay = undefined;
      this.stopAmbientSound();
    });
  }

  private drawUi() {
    const instructions = this.add
      .text(
        16,
        16,
        'Click tiles to move (pathfinding avoids props). Press M for minimap, Esc or Exit to return.',
        {
          color: '#e2e8f0',
          fontFamily: 'monospace',
          fontSize: '12px',
        },
      )
      .setScrollFactor(0)
      .setDepth(2000);
    instructions.setBackgroundColor('rgba(15,23,42,0.65)');
    instructions.setPadding(6, 4, 6, 4);

    const exitButton = this.add
      .text(16, instructions.y + instructions.height + 12, 'Exit Interior', {
        color: '#f97316',
        fontFamily: 'monospace',
        fontSize: '12px',
      })
      .setScrollFactor(0)
      .setDepth(2000)
      .setInteractive({ useHandCursor: true });

    exitButton.on('pointerdown', () => this.exitInterior());
  }

  private spawnAmbientNpcs() {
    const spawnTiles = this.blueprint.spawns?.npcs ?? [];
    const max = Math.min(3, spawnTiles.length);
    for (let i = 0; i < max; i++) {
      const tile = spawnTiles[i];
      const world = this.tileToWorld(tile[0], tile[1]);
      const npc = new Agent(this, world.x, world.y, {
        id: `${this.theme}-npc-${i}`,
        name: this.generateNpcName(i),
        state: 'working',
      });
      npc.disableInteractive();
      npc.setAlpha(0.9);
      npc.setDepth(900 + world.y);
      this.npcs.push(npc);
      this.updateNpcMinimap(npc);
      this.scheduleNpcWander(npc);
    }
    this.refreshMinimapSources();
  }

  private scheduleNpcWander(npc: Agent) {
    const timer = this.time.addEvent({
      delay: Phaser.Math.Between(2600, 5200),
      loop: true,
      callback: () => {
        const startTile = this.worldToTile(npc.x, npc.y);
        if (!startTile) return;
        const targetTile = this.pickRandomWalkableTile(startTile, 4);
        if (!targetTile) return;
        const pathTiles = findGridPath(startTile, targetTile, {
          width: this.blueprint.dimensions.width,
          height: this.blueprint.dimensions.height,
          isWalkable: (tileX, tileY) => this.isWalkable(tileX, tileY),
        });
        if (!pathTiles || pathTiles.length < 2) return;
        const worldPath = pathTiles.slice(1).map((step) => this.tileToWorld(step.x, step.y));
        npc.walkPath(worldPath);
        this.updateNpcMinimap(npc);
      },
    });
    this.npcTimers.push(timer);
  }

  private pickRandomWalkableTile(origin: { x: number; y: number }, radius = 4) {
    const width = this.blueprint.dimensions.width;
    const height = this.blueprint.dimensions.height;
    for (let attempt = 0; attempt < 16; attempt++) {
      const dx = Phaser.Math.Between(-radius, radius);
      const dy = Phaser.Math.Between(-radius, radius);
      const x = Phaser.Math.Clamp(origin.x + dx, 0, width - 1);
      const y = Phaser.Math.Clamp(origin.y + dy, 0, height - 1);
      if (this.isWalkable(x, y)) return { x, y };
    }
    return null;
  }

  private generateNpcName(index: number) {
    const labelMap: Record<string, string> = {
      javascript: 'Synth Tech',
      typescript: 'Typewright',
      python: 'Archivist',
      go: 'Navigator',
      ruby: 'Artisan',
      java: 'Architect',
      csharp: 'Conductor',
      commons: 'Steward',
    };
    const base = labelMap[this.theme] ?? 'Resident';
    return `${base} ${index + 1}`;
  }

  private handleMinimapTeleport(x: number, y: number) {
    if (!this.agent) return;
    const start = this.worldToTile(this.agent.x, this.agent.y);
    const goal = this.worldToTile(x, y);
    if (!start || !goal) return;
    if (!this.isWalkable(goal.x, goal.y)) return;
    const pathTiles = findGridPath(start, goal, {
      width: this.blueprint.dimensions.width,
      height: this.blueprint.dimensions.height,
      isWalkable: (tileX, tileY) => this.isWalkable(tileX, tileY),
    });
    if (!pathTiles || pathTiles.length < 2) return;
    const worldPath = pathTiles.slice(1).map((step) => this.tileToWorld(step.x, step.y));
    this.agent.walkPath(worldPath);
    this.refreshMinimapSources();
  }

  private exitInterior() {
    this.minimapTimer?.remove(false);
    this.minimapTimer = undefined;
    this.npcTimers.forEach((timer) => timer.remove(false));
    this.npcTimers = [];
    this.npcs.forEach((npc) => this.interiorMinimap?.setNpc(npc.id));
    this.npcs.forEach((npc) => npc.destroy());
    this.npcs = [];
    this.interiorMinimap?.destroy();
    this.interiorMinimap = undefined;
    this.exitMarker?.destroy();
    this.exitMarker = undefined;
    this.lightingOverlay?.destroy();
    this.lightingOverlay = undefined;
    this.stopAmbientSound();

    const returnScene = this.launchData.returnScene ?? RETURN_SCENE_DEFAULT;
    const payload = {
      interiorReturn: {
        houseId: this.launchData.houseId,
        theme: this.theme,
      },
      camera: this.launchData.returnCamera,
    };
    this.scene.stop();
    if (this.scene.isSleeping(returnScene) || this.scene.isPaused(returnScene)) {
      this.scene.resume(returnScene, payload);
    } else if (this.launchData.villageId) {
      this.scene.start(returnScene, { villageId: this.launchData.villageId });
    } else {
      this.scene.start(returnScene);
    }
  }

  private tileToWorld(x: number, y: number) {
    return {
      x: x * this.tileSize + this.tileSize / 2,
      y: y * this.tileSize + this.tileSize / 2,
    };
  }

  private worldToTile(worldX: number, worldY: number) {
    const x = Math.floor(worldX / this.tileSize);
    const y = Math.floor(worldY / this.tileSize);
    if (x < 0 || y < 0) return null;
    if (x >= this.blueprint.dimensions.width || y >= this.blueprint.dimensions.height) return null;
    return { x, y };
  }

  private drawExitMarker() {
    const exit = this.blueprint.spawns?.player;
    if (!exit) return;
    const world = this.tileToWorld(exit[0], exit[1]);
    this.exitMarker = this.add
      .triangle(world.x, world.y - this.tileSize * 0.35, 0, 12, 12, 12, 6, -10, 0xfbbf24, 0.9)
      .setOrigin(0.5, 1)
      .setDepth(1500);
    this.tweens.add({
      targets: this.exitMarker,
      alpha: { from: 0.95, to: 0.4 },
      y: world.y - this.tileSize * 0.45,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private isTileInside(grid: HouseBlueprint['vertexGrid'], x: number, y: number): boolean {
    const row = grid[y];
    const nextRow = grid[y + 1];
    if (!row || !nextRow) return false;
    const a = row[x];
    const b = row[x + 1];
    const c = nextRow[x];
    const d = nextRow[x + 1];
    return a === 1 && b === 1 && c === 1 && d === 1;
  }

  private isEdgeTile(grid: HouseBlueprint['vertexGrid'], x: number, y: number): boolean {
    if (!this.isTileInside(grid, x, y)) return false;
    const neighbors = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];
    return neighbors.some((n) => !this.isTileInside(grid, n.x, n.y));
  }
}
