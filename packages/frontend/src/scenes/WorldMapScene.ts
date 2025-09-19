import Phaser from 'phaser';

type VillageInfo = {
  id: string;
  name: string;
  language?: string;
  houseCount?: number;
  totalStars?: number;
};

export class WorldMapScene extends Phaser.Scene {
  private villages: VillageInfo[] = [];
  private tiles: Map<string, Phaser.GameObjects.Container> = new Map();
  private loadingText?: Phaser.GameObjects.Text;

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
    this.cameras.main.setBackgroundColor('#0b1220');
    this.loadingText = this.add
      .text(12, 12, 'Loading villages…', {
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
      .then((list) => {
        // If profiling, expand to a large list
        if (profile) {
          const expanded: VillageInfo[] = [];
          const target = Math.max(list.length, 200);
          for (let i = 0; i < target; i++) {
            const v = list[i % list.length] || { id: `v-${i + 1}`, name: `Village ${i + 1}` };
            expanded.push({ id: `${v.id}-${i}`, name: `${v.name}` });
          }
          this.villages = expanded;
        } else {
          this.villages = list;
        }
        this.loadingText?.setText(`Villages: ${list.length}`);
        this.chunkRenderTiles(this.villages, () => {
          const endedAt = (typeof performance !== 'undefined' && performance.now()) || Date.now();
          const ms = Math.round(endedAt - startedAt);
          const summary = `Rendered ${this.villages.length} villages in ${ms}ms`;
          this.loadingText?.setText(profile ? `Profile: ${summary}` : 'Select a village (click)');
          // Expose for manual inspection

          (window as any)._worldProfilingResult = { count: this.villages.length, ms };
          // Also log in console for convenience

          console.info('[worldmap] profile', { count: this.villages.length, ms });
        });
      })
      .catch(() => {
        this.loadingText?.setText('Failed to load villages');
      });
  }

  private async fetchVillages(profile = false): Promise<VillageInfo[]> {
    try {
      const res = await fetch('/api/villages', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as Array<{
        id: number | string;
        name: string;
        primaryLanguage?: string | null;
        primaryLanguageLabel?: string | null;
        language?: string | null;
        houseCount?: number | null;
        totalStars?: number | null;
      }>;
      return (data || []).map((v) => ({
        id: String(v?.id ?? ''),
        name: v?.name ?? String(v?.id ?? ''),
        language: this.normalizeLanguage(v?.language ?? v?.primaryLanguage) ?? undefined,
        houseCount: typeof v?.houseCount === 'number' ? v.houseCount : undefined,
        totalStars: typeof v?.totalStars === 'number' ? v.totalStars : undefined,
      }));
    } catch {
      // Fallback mock data for now
      const n = profile ? 20 : 9;
      return Array.from({ length: n }).map((_, i) => ({
        id: `v-${i + 1}`,
        name: `Village ${i + 1}`,
        language: this.supportedHouseLanguages[i % this.supportedHouseLanguages.length],
        houseCount: Phaser.Math.Between(3, 12),
        totalStars: Phaser.Math.Between(10, 250),
      }));
    }
  }

  private normalizeLanguage(lang?: string | null): string | undefined {
    if (!lang) return undefined;
    const normalized = String(lang).toLowerCase().trim();
    return this.supportedHouseLanguages.includes(normalized as any) ? normalized : undefined;
  }

  private hashString(input: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  private getVillageLanguage(v: VillageInfo): string {
    const normalized = this.normalizeLanguage(v.language);
    if (normalized) {
      v.language = normalized;
      return normalized;
    }
    const idx = this.hashString(v.id) % this.supportedHouseLanguages.length;
    const lang = this.supportedHouseLanguages[idx];
    v.language = lang;
    return lang;
  }

  private getHouseTextureKey(v: VillageInfo): string {
    const language = this.normalizeLanguage(v.language) ?? this.getVillageLanguage(v);
    const key = `house_${language}`;
    return this.textures.exists(key) ? key : 'house_generic';
  }

  private getLanguageLabel(lang: string): string {
    return this.languageLabels[lang] ?? lang.toUpperCase();
  }

  private chunkRenderTiles(list: VillageInfo[], onComplete?: () => void) {
    const padding = 16;
    const tileW = 140;
    const tileH = 90;
    const cols = Math.max(1, Math.floor((this.scale.width - padding * 2) / (tileW + padding)));

    let index = 0;
    const addBatch = () => {
      const batch = list.slice(index, index + 6);
      batch.forEach((v, i) => {
        const overall = index + i;
        const row = Math.floor(overall / cols);
        const col = overall % cols;
        const x = padding + col * (tileW + padding) + tileW / 2;
        const y = 80 + row * (tileH + padding) + tileH / 2;
        this.addVillageTile(v, x, y, tileW, tileH);
      });
      index += batch.length;
      if (index < list.length) {
        this.time.delayedCall(16, addBatch);
      } else {
        if (onComplete) onComplete();
        else if (this.loadingText) this.loadingText.setText('Select a village (click)');
      }
    };
    addBatch();
  }

  private addVillageTile(v: VillageInfo, x: number, y: number, w: number, h: number) {
    if (this.tiles.has(v.id)) return;
    const g = this.add.graphics();
    g.fillStyle(0x1f2937, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.lineStyle(2, 0x374151, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);

    const houseTextureKey = this.getHouseTextureKey(v);
    const preview = this.add.image(0, -h * 0.05, houseTextureKey).setOrigin(0.5, 1);
    if (preview.width > 0 && preview.height > 0) {
      const scale = Math.min((w * 0.6) / preview.width, (h * 0.55) / preview.height);
      preview.setScale(scale);
    }

    const label = this.add
      .text(0, h * 0.15, v.name, {
        color: '#e5e7eb',
        fontFamily: 'monospace',
        fontSize: '12px',
        align: 'center',
      })
      .setOrigin(0.5, 0);

    const language = this.getVillageLanguage(v);
    const languageLabel = this.add
      .text(0, h * 0.15 + 16, this.getLanguageLabel(language), {
        color: '#94a3b8',
        fontFamily: 'monospace',
        fontSize: '10px',
        align: 'center',
      })
      .setOrigin(0.5, 0);

    const statsLine = this.add
      .text(0, h * 0.15 + 30, `${v.houseCount ?? 0} houses • ★ ${v.totalStars ?? 0}`, {
        color: '#64748b',
        fontFamily: 'monospace',
        fontSize: '9px',
        align: 'center',
      })
      .setOrigin(0.5, 0);

    const tile = this.add.container(x, y, [g, preview, label, languageLabel, statsLine]);
    tile.setSize(w, h);
    tile.setInteractive({
      useHandCursor: true,
      pixelPerfect: false,
      hitArea: new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    });

    const previewScaleX = preview.scaleX;
    const previewScaleY = preview.scaleY;
    tile.on('pointerover', () => {
      g.clear();
      g.fillStyle(0x243142, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      g.lineStyle(2, 0x64748b, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      preview.setScale(previewScaleX * 1.05, previewScaleY * 1.05);
    });
    tile.on('pointerout', () => {
      g.clear();
      g.fillStyle(0x1f2937, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      g.lineStyle(2, 0x374151, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      preview.setScale(previewScaleX, previewScaleY);
    });
    tile.on('pointerdown', () => this.navigateToVillage(v.id));

    this.tiles.set(v.id, tile);
  }

  private navigateToVillage(villageId: string) {
    // Pass selected villageId to MainScene
    this.scene.start('MainScene', { villageId });
  }
}
