import Phaser from 'phaser';

type VillageInfo = { id: string; name: string };

export class WorldMapScene extends Phaser.Scene {
  private villages: VillageInfo[] = [];
  private tiles: Map<string, Phaser.GameObjects.Container> = new Map();
  private loadingText?: Phaser.GameObjects.Text;

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
      const data = (await res.json()) as Array<{ id: number | string; name: string }>;
      return (data || []).map((v) => ({
        id: String((v as any).id ?? v),
        name: (v as any).name ?? String(v),
      }));
    } catch {
      // Fallback mock data for now
      const n = profile ? 20 : 9;
      return Array.from({ length: n }).map((_, i) => ({
        id: `v-${i + 1}`,
        name: `Village ${i + 1}`,
      }));
    }
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

    const label = this.add
      .text(0, 0, v.name, {
        color: '#e5e7eb',
        fontFamily: 'monospace',
        fontSize: '12px',
        align: 'center',
      })
      .setOrigin(0.5);

    const tile = this.add.container(x, y, [g, label]);
    tile.setSize(w, h);
    tile.setInteractive({
      useHandCursor: true,
      pixelPerfect: false,
      hitArea: new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    });

    tile.on('pointerover', () => {
      g.clear();
      g.fillStyle(0x243142, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      g.lineStyle(2, 0x64748b, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    });
    tile.on('pointerout', () => {
      g.clear();
      g.fillStyle(0x1f2937, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      g.lineStyle(2, 0x374151, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    });
    tile.on('pointerdown', () => this.navigateToVillage(v.id));

    this.tiles.set(v.id, tile);
  }

  private navigateToVillage(villageId: string) {
    // Pass selected villageId to MainScene
    this.scene.start('MainScene', { villageId });
  }
}
