import Phaser from 'phaser';
import {
  generateWorldMap,
  type VillageDescriptor,
  type WorldMapData,
  type VillagePlacement,
} from '../world';
import { api } from '../api/client';

export class WorldMapScene extends Phaser.Scene {
  private villages: VillageDescriptor[] = [];
  private loadingText?: Phaser.GameObjects.Text;
  private terrainLayer?: Phaser.GameObjects.Layer;
  private villageLayer?: Phaser.GameObjects.Layer;
  private currentWorld?: WorldMapData;
  private readonly villageNodes: Map<string, Phaser.GameObjects.Container> = new Map();

  private readonly supportedHouseLanguages = [
    'js',
    'ts',
    'py',
    'go',
    'rb',
    'java',
    'cs',
    'generic',
  ] as const;
  private readonly languageLabels: Record<string, string> = {
    js: 'JavaScript',
    ts: 'TypeScript',
    py: 'Python',
    go: 'Go',
    rb: 'Ruby',
    java: 'Java',
    cs: 'C#',
    generic: 'Multi-lang',
  };

  constructor() {
    super('WorldMapScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#05090f');
    this.loadingText = this.add
      .text(16, 16, 'Loading world…', {
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '12px',
      })
      .setScrollFactor(0);

    const profile =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('profileWorld');
    const startedAt = (typeof performance !== 'undefined' && performance.now()) || Date.now();

    this.fetchVillages(profile)
      .then((villages) => {
        this.villages = villages;
        this.loadingText?.setText('Generating terrain…');
        const world = generateWorldMap(villages);
        this.currentWorld = world;
        this.renderWorld(world);
        this.renderVillages(world);
        this.configureCamera(world);
        const endedAt = (typeof performance !== 'undefined' && performance.now()) || Date.now();
        const ms = Math.round(endedAt - startedAt);
        const summary = `Rendered ${world.villages.length} villages in ${ms}ms`;
        if (profile) {
          this.loadingText?.setText(`Profile: ${summary}`);
        } else {
          this.loadingText?.setText('Click to focus, double-click a house to explore inside');
        }
        (window as any)._worldProfilingResult = { count: world.villages.length, ms };
        console.info('[worldmap] profile', { count: world.villages.length, ms });
      })
      .catch((error) => {
        console.error('[worldmap] failed to load villages', error);
        this.loadingText?.setText('Failed to load villages');
      });
  }

  private configureCamera(world: WorldMapData) {
    const camera = this.cameras.main;
    const widthPx = world.width * world.tileSize;
    const heightPx = world.height * world.tileSize;
    camera.setBounds(0, 0, widthPx, heightPx);
    const zoom = Math.min(2.2, Math.max(0.9, 920 / Math.max(widthPx, heightPx)));
    camera.setZoom(zoom);
    camera.centerOn(widthPx / 2, heightPx / 2);
    camera.setLerp(0.15, 0.15);
  }

  private clearLayer(layer?: Phaser.GameObjects.Layer) {
    if (!layer) return;
    layer.removeAll(true);
    layer.destroy(true);
  }

  private renderWorld(world: WorldMapData) {
    this.clearLayer(this.terrainLayer);
    const layer = this.add.layer();
    layer.setDepth(0);
    for (const tile of world.tiles) {
      const image = this.add.image(
        tile.x * world.tileSize,
        tile.y * world.tileSize,
        tile.textureKey,
        tile.frame,
      );
      image.setOrigin(0, 0);
      image.setDisplaySize(world.tileSize, world.tileSize);
      if (!tile.passable) {
        image.setTintFill(0xffffff);
        image.setAlpha(0.92);
      }
      layer.add(image);
    }
    this.terrainLayer = layer;
  }

  private renderVillages(world: WorldMapData) {
    this.clearLayer(this.villageLayer);
    this.villageNodes.clear();
    const layer = this.add.layer();
    layer.setDepth(10);
    for (const placement of world.villages) {
      const node = this.buildVillageNode(world, placement);
      layer.add(node);
      this.villageNodes.set(placement.id, node);
    }
    this.villageLayer = layer;
  }

  private buildVillageNode(world: WorldMapData, placement: VillagePlacement) {
    const tileSize = world.tileSize;
    const px = (placement.x + 0.5) * tileSize;
    const py = (placement.y + 0.5) * tileSize;
    const container = this.add.container(px, py);
    container.setDepth(20);

    const highlight = this.add.circle(0, tileSize * 0.05, tileSize * 0.55, 0x2563eb, 0);
    highlight.setStrokeStyle(2, 0x60a5fa, 0.6);

    const houseTextureKey = this.getHouseTextureKey(placement);
    const house = this.add.image(0, -tileSize * 0.05, houseTextureKey).setOrigin(0.5, 1);
    let baseScaleX = house.scaleX;
    let baseScaleY = house.scaleY;
    if (house.width > 0 && house.height > 0) {
      const scale = Math.min((tileSize * 0.8) / house.width, (tileSize * 0.9) / house.height);
      house.setScale(scale);
      baseScaleX = house.scaleX;
      baseScaleY = house.scaleY;
    }

    const label = this.add
      .text(0, tileSize * 0.1, placement.name, {
        color: '#f1f5f9',
        fontFamily: 'monospace',
        fontSize: '12px',
        align: 'center',
        wordWrap: { width: tileSize * 2, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);

    const language = this.getVillageLanguage(placement);
    const languageLabel = this.add
      .text(0, tileSize * 0.1 + 16, this.getLanguageLabel(language), {
        color: '#94a3b8',
        fontFamily: 'monospace',
        fontSize: '10px',
        align: 'center',
      })
      .setOrigin(0.5, 0);

    const stats = `${placement.houseCount ?? 0} houses • ★ ${placement.totalStars ?? 0}`;
    const statsLabel = this.add
      .text(0, tileSize * 0.1 + 30, stats, {
        color: '#64748b',
        fontFamily: 'monospace',
        fontSize: '9px',
        align: 'center',
      })
      .setOrigin(0.5, 0);

    container.add([highlight, house, label, languageLabel, statsLabel]);
    container.setSize(tileSize * 1.6, tileSize * 1.8);
    container.setInteractive({
      useHandCursor: true,
      hitArea: new Phaser.Geom.Rectangle(
        -tileSize * 0.8,
        -tileSize,
        tileSize * 1.6,
        tileSize * 1.8,
      ),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    });

    container.on('pointerover', () => {
      highlight.fillAlpha = 0.25;
      house.setScale(baseScaleX * 1.05, baseScaleY * 1.05);
    });
    container.on('pointerout', () => {
      highlight.fillAlpha = 0;
      house.setScale(baseScaleX, baseScaleY);
    });
    container.on('pointerdown', () => this.navigateToVillage(placement.id));

    return container;
  }

  private async fetchVillages(_profile = false): Promise<VillageDescriptor[]> {
    const villages = await api.listVillages();
    return villages.map((v) => ({
      id: v.id,
      name: v.name,
      language: this.normalizeLanguage(v.primaryLanguage) ?? undefined,
      houseCount: v.houseCount,
      totalStars: v.totalStars,
    }));
  }

  private normalizeLanguage(lang?: string | null): string | undefined {
    if (!lang) return undefined;
    const normalized = String(lang).toLowerCase().trim();
    return this.supportedHouseLanguages.includes(normalized as any) ? normalized : undefined;
  }

  private getVillageLanguage(v: VillageDescriptor): string {
    const normalized = this.normalizeLanguage(v.language);
    if (normalized) {
      v.language = normalized;
      return normalized;
    }
    const idx = Math.abs(this.hashString(v.id)) % this.supportedHouseLanguages.length;
    const lang = this.supportedHouseLanguages[idx];
    v.language = lang;
    return lang;
  }

  private hashString(input: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  private getHouseTextureKey(v: VillageDescriptor): string {
    const language = this.normalizeLanguage(v.language) ?? this.getVillageLanguage(v);
    const key = `house_${language}`;
    return this.textures.exists(key) ? key : 'house_generic';
  }

  private getLanguageLabel(lang: string): string {
    return this.languageLabels[lang] ?? lang.toUpperCase();
  }

  private navigateToVillage(villageId: string) {
    this.scene.start('MainScene', { villageId });
  }
}
