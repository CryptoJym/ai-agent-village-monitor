import Phaser from 'phaser';

export type BugSeverity = 'low' | 'medium' | 'high';

const STYLE: Record<BugSeverity, { color: number; radius: number }> = {
  low: { color: 0x60a5fa, radius: 8 },
  medium: { color: 0xf59e0b, radius: 10 },
  high: { color: 0xef4444, radius: 12 },
};

export function ensureBugTextures(scene: Phaser.Scene) {
  const tex = scene.textures;
  for (const sev of ['low', 'medium', 'high'] as BugSeverity[]) {
    const key = `bugtex_${sev}`;
    if (tex.exists(key)) continue;
    const { color, radius } = STYLE[sev];
    const size = radius * 2 + 6; // include outline margin
    const g = scene.add.graphics({ x: 0, y: 0 });
    g.clear();
    // outline
    g.fillStyle(0x000000, 0.6);
    g.fillCircle(size / 2, size / 2, radius + 2);
    // fill
    g.fillStyle(color, 1);
    g.fillCircle(size / 2, size / 2, radius);
    g.generateTexture(key, size, size);
    g.destroy();
  }
}
