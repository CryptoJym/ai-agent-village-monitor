import Phaser from 'phaser';
import { gridToScreen, type IsoConfig } from './iso';

export type IsoGridOverlayOptions = {
  rows: number;
  cols: number;
  strokeColor?: number; // hex
  strokeAlpha?: number; // 0..1
  lineWidth?: number;
};

export class IsoGridOverlay {
  private gfx: Phaser.GameObjects.Graphics;
  public readonly config: IsoConfig;
  public readonly options: Required<IsoGridOverlayOptions>;

  constructor(scene: Phaser.Scene, config: IsoConfig, options: IsoGridOverlayOptions) {
    this.config = config;
    this.options = {
      rows: options.rows,
      cols: options.cols,
      strokeColor: options.strokeColor ?? 0x334155, // slate-700
      strokeAlpha: options.strokeAlpha ?? 0.5,
      lineWidth: options.lineWidth ?? 1,
    };
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(-100); // ensure behind other content
    this.redraw();
  }

  destroy() {
    this.gfx.destroy();
    // Help GC in long-lived scenes (safe casts)
     
    (this as any).gfx = undefined;
     
    (this as any).config = undefined;
  }

  redraw() {
    const g = this.gfx;
    const c = this.config;
    const { rows, cols, strokeColor, strokeAlpha, lineWidth } = this.options;
    g.clear();
    g.lineStyle(lineWidth, strokeColor, strokeAlpha);

    // Draw rows (constant gx + gy)
    for (let r = 0; r <= rows; r++) {
      const a = gridToScreen(0, r, c);
      const b = gridToScreen(cols, r, c);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.strokePath();
    }

    // Draw columns
    for (let q = 0; q <= cols; q++) {
      const a = gridToScreen(q, 0, c);
      const b = gridToScreen(q, rows, c);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.strokePath();
    }
  }
}
