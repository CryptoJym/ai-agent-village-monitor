import Phaser from 'phaser';
import { announce } from '../utils/a11y';

type Point = { x: number; y: number };

export class Minimap {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private rt?: Phaser.GameObjects.RenderTexture;
  private title?: Phaser.GameObjects.Text;
  private w: number;
  private h: number;
  private margin = 8;
  private padding = 8;
  private worldW: number;
  private worldH: number;
  private dotsLayer: Phaser.GameObjects.Container;
  private agentDot?: Phaser.GameObjects.Arc;
  private houseDots: Map<string, Phaser.GameObjects.Arc> = new Map();
  private viewRect?: Phaser.GameObjects.Rectangle;
  private visible = true;
  private refreshEvent?: Phaser.Time.TimerEvent;
  private teleportHandler?: (p: Point) => void;
  private camPollEvent?: Phaser.Time.TimerEvent;
  private lastCam = { x: 0, y: 0, zoom: 1 };
  private mode: 'interval' | 'camera' = 'interval';
  private refreshDelayMs = 250;
  // Keyboard focus/navigation
  private focusMode = false;
  private focusMini: Point = { x: 0, y: 0 };
  private focusMarker?: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    opts: { width?: number; height?: number; world?: { w: number; h: number } },
  ) {
    this.scene = scene;
    this.w = opts.width ?? 180;
    this.h = opts.height ?? 120;
    this.worldW = opts.world?.w ?? scene.scale.width;
    this.worldH = opts.world?.h ?? scene.scale.height;

    const x = scene.scale.width - this.w - this.margin;
    const y = this.margin;
    this.bg = scene.add.rectangle(0, 0, this.w, this.h, 0x0b1220, 0.85).setOrigin(0);
    this.bg.setStrokeStyle(1, 0x334155, 1);
    this.title = scene.add.text(8, 4, 'Minimap (INT)', {
      color: '#94a3b8',
      fontFamily: 'monospace',
      fontSize: '10px',
    });
    // RenderTexture background (downscaled scene)
    const innerW = Math.max(8, this.w - this.padding * 2);
    const innerH = Math.max(8, this.h - this.padding * 2);
    this.rt = scene.add.renderTexture(this.padding, this.padding, innerW, innerH);
    this.rt.setOrigin(0, 0);
    this.rt.setAlpha(0.85);
    this.dotsLayer = scene.add.container(0, 0);
    this.container = scene.add
      .container(x, y, [this.bg, this.rt, this.dotsLayer, this.title])
      .setScrollFactor(0)
      .setDepth(1000);
    this.container.setName('minimap');
    this.bg.setInteractive({ useHandCursor: true }).on('pointerdown', (p: Phaser.Input.Pointer) => {
      const localX = p.x - this.container.x;
      const localY = p.y - this.container.y;
      const world = this.fromMini({ x: localX, y: localY });
      if (this.teleportHandler) this.teleportHandler(world);
      try {
        announce('Traveling to selected location');
      } catch {}
    });
    this.title?.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.setUpdateMode(this.mode === 'interval' ? 'camera' : 'interval');
    });

    // Determine device capability to tune refresh rate
    try {
      const lowCpu =
        typeof navigator !== 'undefined' &&
        (navigator as any).hardwareConcurrency &&
        (navigator as any).hardwareConcurrency <= 4;
      const hiDpr =
        typeof window !== 'undefined' && window.devicePixelRatio && window.devicePixelRatio >= 2;
      if (lowCpu || hiDpr) this.refreshDelayMs = 400;
    } catch {}
    // Update cadence: default interval mode (adjusted by refreshDelayMs)
    this.setUpdateMode('interval');

    // Respond to resizes
    scene.scale.on(Phaser.Scale.Events.RESIZE, () => this.positionAtCorner());
    this.positionAtCorner();

    // Keyboard navigation and focus
    const kb = scene.input.keyboard;
    kb?.on('keydown-TAB', (e: KeyboardEvent) => {
      // Toggle minimap focus mode
      e.preventDefault?.();
      this.focusMode = !this.focusMode;
      if (this.focusMode) {
        // Initialize focus to center of current viewport
        const cam = this.scene.cameras.main;
        const center = { x: cam.worldView.centerX, y: cam.worldView.centerY };
        this.focusMini = this.toMini(center);
        this.updateFocusMarker();
        try {
          announce('Minimap focus enabled. Use arrow keys to move, Enter to travel.');
        } catch {}
      } else {
        this.focusMarker?.destroy();
        this.focusMarker = undefined;
        try {
          announce('Minimap focus disabled.');
        } catch {}
      }
    });
    const move = (dx: number, dy: number) => {
      const stepX = (this.w - this.padding * 2) * 0.06; // 6% step
      const stepY = (this.h - this.padding * 2) * 0.06;
      this.focusMini.x = Phaser.Math.Clamp(
        (this.focusMini.x || 0) + dx * stepX,
        this.padding,
        this.w - this.padding,
      );
      this.focusMini.y = Phaser.Math.Clamp(
        (this.focusMini.y || 0) + dy * stepY,
        this.padding,
        this.h - this.padding,
      );
      this.updateFocusMarker();
    };
    kb?.on('keydown-LEFT', () => {
      if (this.focusMode) move(-1, 0);
    });
    kb?.on('keydown-RIGHT', () => {
      if (this.focusMode) move(1, 0);
    });
    kb?.on('keydown-UP', () => {
      if (this.focusMode) move(0, -1);
    });
    kb?.on('keydown-DOWN', () => {
      if (this.focusMode) move(0, 1);
    });
    kb?.on('keydown-A', () => {
      if (this.focusMode) move(-1, 0);
    });
    kb?.on('keydown-D', () => {
      if (this.focusMode) move(1, 0);
    });
    kb?.on('keydown-W', () => {
      if (this.focusMode) move(0, -1);
    });
    kb?.on('keydown-S', () => {
      if (this.focusMode) move(0, 1);
    });
    const activate = () => {
      if (!this.focusMode) return;
      const world = this.fromMini(this.focusMini);
      if (this.teleportHandler) this.teleportHandler(world);
      try {
        announce('Traveling to focused location');
      } catch {}
    };
    kb?.on('keydown-ENTER', activate);
    kb?.on('keydown-SPACE', (e: KeyboardEvent) => {
      e.preventDefault?.();
      activate();
    });
  }

  toggle() {
    this.visible = !this.visible;
    this.container.setVisible(this.visible);
  }

  private positionAtCorner() {
    const x = this.scene.scale.width - this.w - this.margin;
    const y = this.margin;
    this.container.setPosition(x, y);
  }

  private redraw() {
    if (!this.rt) return;
    // Fit full game canvas inside the inner box while preserving aspect
    const innerW = Math.max(8, this.w - this.padding * 2);
    const innerH = Math.max(8, this.h - this.padding * 2);
    const srcW = this.scene.scale.width;
    const srcH = this.scene.scale.height;
    const sx = innerW / Math.max(1, srcW);
    const sy = innerH / Math.max(1, srcH);
    const s = Math.min(sx, sy);
    this.rt.clear();
    this.rt.setScale(s);
    this.rt.x = this.padding + (innerW - srcW * s) * 0.5;
    this.rt.y = this.padding + (innerH - srcH * s) * 0.5;
    // Draw the current game canvas into the RT
    try {
       
      const canvas = (this.scene.game as any).canvas as HTMLCanvasElement;
      if (canvas) this.rt.draw(canvas, 0, 0);
    } catch {}
  }

  private updateFocusMarker() {
    const sz = 10;
    const x = this.focusMini.x || this.padding;
    const y = this.focusMini.y || this.padding;
    if (!this.focusMarker) {
      this.focusMarker = this.scene.add
        .rectangle(x - sz * 0.5, y - sz * 0.5, sz, sz)
        .setOrigin(0)
        .setStrokeStyle(1, 0xfef08a, 1)
        .setFillStyle(0x000000, 0.1);
      this.dotsLayer.add(this.focusMarker);
    } else {
      this.focusMarker.setPosition(x - sz * 0.5, y - sz * 0.5);
    }
  }

  setUpdateMode(mode: 'interval' | 'camera') {
    this.mode = mode;
    // Update badge
    if (this.title) this.title.setText(`Minimap (${mode === 'interval' ? 'INT' : 'CAM'})`);
    // Clear any prior timers
    if (this.refreshEvent) {
      this.refreshEvent.remove(false);
      this.refreshEvent = undefined;
    }
    if (this.camPollEvent) {
      this.camPollEvent.remove(false);
      this.camPollEvent = undefined;
    }
    if (mode === 'interval') {
      this.refreshEvent = this.scene.time.addEvent({
        delay: this.refreshDelayMs,
        loop: true,
        callback: () => this.redraw(),
      });
    } else {
      // Poll camera and redraw only when there is a change
      const c = this.scene.cameras.main;
      this.lastCam = { x: c.scrollX, y: c.scrollY, zoom: c.zoom };
      this.camPollEvent = this.scene.time.addEvent({
        delay: 120,
        loop: true,
        callback: () => {
          const cam = this.scene.cameras.main;
          const dx = Math.abs(cam.scrollX - this.lastCam.x);
          const dy = Math.abs(cam.scrollY - this.lastCam.y);
          const dz = Math.abs(cam.zoom - this.lastCam.zoom);
          if (dx > 1 || dy > 1 || dz > 0.001) {
            this.lastCam = { x: cam.scrollX, y: cam.scrollY, zoom: cam.zoom };
            this.redraw();
          }
        },
      });
    }
    return this;
  }

  private toMini(p: Point): Point {
    const sx = (p.x / Math.max(1, this.worldW)) * (this.w - this.padding * 2) + this.padding;
    const sy = (p.y / Math.max(1, this.worldH)) * (this.h - this.padding * 2) + this.padding;
    return { x: sx, y: sy };
  }

  private fromMini(p: Point): Point {
    const innerW = Math.max(8, this.w - this.padding * 2);
    const innerH = Math.max(8, this.h - this.padding * 2);
    const clampedX = Math.max(this.padding, Math.min(this.w - this.padding, p.x));
    const clampedY = Math.max(this.padding, Math.min(this.h - this.padding, p.y));
    const nx = (clampedX - this.padding) / Math.max(1, innerW);
    const ny = (clampedY - this.padding) / Math.max(1, innerH);
    return { x: nx * this.worldW, y: ny * this.worldH };
  }

  setAgentPosition(p?: Point) {
    if (!p) return;
    const m = this.toMini(p);
    if (!this.agentDot) {
      this.agentDot = this.scene.add.circle(m.x, m.y, 3, 0x93c5fd, 1);
      this.dotsLayer.add(this.agentDot);
    } else {
      this.agentDot.setPosition(m.x, m.y);
    }
  }

  setHouse(id: string, p: Point) {
    const m = this.toMini(p);
    let dot = this.houseDots.get(id);
    if (!dot) {
      dot = this.scene.add.circle(m.x, m.y, 2, 0x22c55e, 1);
      this.dotsLayer.add(dot);
      this.houseDots.set(id, dot);
    } else {
      dot.setPosition(m.x, m.y);
    }
  }

  setViewport(rect: { x: number; y: number; width: number; height: number }) {
    const tl = this.toMini({ x: rect.x, y: rect.y });
    const br = this.toMini({ x: rect.x + rect.width, y: rect.y + rect.height });
    const w = Math.max(4, br.x - tl.x);
    const h = Math.max(4, br.y - tl.y);
    if (!this.viewRect) {
      this.viewRect = this.scene.add
        .rectangle(tl.x, tl.y, w, h)
        .setOrigin(0)
        .setStrokeStyle(1, 0x93c5fd, 1)
        .setFillStyle(0x000000, 0);
      this.dotsLayer.add(this.viewRect);
    } else {
      this.viewRect.setPosition(tl.x, tl.y);
      this.viewRect.setSize(w, h);
    }
  }

  setOnTeleport(handler: (p: Point) => void) {
    this.teleportHandler = handler;
  }
}
