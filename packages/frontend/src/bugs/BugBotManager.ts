import Phaser from 'phaser';
import { BugBot } from './BugBot';

export class BugBotManager {
  private scene: Phaser.Scene;
  private bots = new Map<string, BugBot>();
  private activePulse = 0;
  private readonly maxActivePulses: number;

  constructor(scene: Phaser.Scene, opts: { maxActivePulses?: number } = {}) {
    this.scene = scene;
    this.maxActivePulses = Math.max(0, opts.maxActivePulses ?? 24);
  }

  get(id: string) {
    return this.bots.get(id);
  }

  all() {
    return [...this.bots.values()];
  }

  spawn(id: string, x: number, y: number, severity: 'low' | 'medium' | 'high') {
    if (this.bots.has(id)) return this.bots.get(id)!;
    const bot = new BugBot(this.scene, id, x, y, severity);
    const enablePulse = this.activePulse < this.maxActivePulses;
    bot.setPulse(enablePulse);
    if (enablePulse) this.activePulse += 1;
    this.bots.set(id, bot);
    return bot;
  }

  assign(id: string) {
    const bot = this.bots.get(id);
    if (bot) {
      this.scene.tweens.add({ targets: bot, alpha: 0.6, duration: 200 });
    }
  }

  resolve(id: string) {
    const bot = this.bots.get(id);
    if (bot) {
      bot.setPulse(false);
      this.activePulse = Math.max(0, this.activePulse - 1);
      bot.fadeOutAndDestroy();
      this.bots.delete(id);
    }
  }
}
