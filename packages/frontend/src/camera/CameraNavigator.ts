import type Phaser from 'phaser';
import { eventBus } from '../realtime/EventBus';

export type CameraNavOptions = {
  world: { w: number; h: number };
  minZoom?: number;
  maxZoom?: number;
};

export class CameraNavigator {
  private scene: Phaser.Scene;
  private worldW: number;
  private worldH: number;
  private minZoom: number;
  private maxZoom: number;

  constructor(scene: Phaser.Scene, opts: CameraNavOptions) {
    this.scene = scene;
    this.worldW = opts.world.w;
    this.worldH = opts.world.h;
    this.minZoom = opts.minZoom ?? 0.5;
    this.maxZoom = opts.maxZoom ?? 2.0;
  }

  panTo(x: number, y: number, duration = 250, ease: string = 'Sine.easeInOut') {
    const cam = this.scene.cameras.main;
    const { cx, cy } = this.clampToBounds(x, y, cam);
    try {
      cam.pan(cx, cy, duration, ease);
    } catch {}
  }

  teleportTo(x: number, y: number) {
    const cam = this.scene.cameras.main;
    const { cx, cy } = this.clampToBounds(x, y, cam);
    // Center camera instantly
    try {
      cam.centerOn(cx, cy);
    } catch {
      // Fallback: adjust scroll manually
      const halfW = (cam.width / cam.zoom) * 0.5;
      const halfH = (cam.height / cam.zoom) * 0.5;
      cam.scrollX = cx - halfW;
      cam.scrollY = cy - halfH;
    }
  }

  // Prefer instant snap; allow ultra-fast ease if motion is enabled.
  teleportOrPanTo(x: number, y: number, durationMs = 160) {
    const cam = this.scene.cameras.main;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || durationMs <= 0) {
      this.teleportTo(x, y);
      eventBus.emit('cameraSettled', { x, y, zoom: cam.zoom });
      return;
    }
    const d = Math.min(Math.max(0, durationMs), 200);
    // Emit when pan completes
    cam.once('camerapancomplete' as any, () => {
      eventBus.emit('cameraSettled', { x, y, zoom: cam.zoom });
    });
    this.panTo(x, y, d);
  }

  zoomTo(zoom: number, x?: number, y?: number, duration = 200) {
    const cam = this.scene.cameras.main;
    const next = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    try {
      if (typeof x === 'number' && typeof y === 'number') {
        // Anchor zoom on a world point
        const before = cam.getWorldPoint(cam.width * 0.5, cam.height * 0.5);
        cam.zoomTo(next, duration);
        const after = cam.getWorldPoint(cam.width * 0.5, cam.height * 0.5);
        cam.scrollX += before.x - after.x;
        cam.scrollY += before.y - after.y;
      } else {
        cam.zoomTo(next, duration);
      }
    } catch {}
  }

  private clampToBounds(x: number, y: number, cam: Phaser.Cameras.Scene2D.Camera) {
    const halfW = (cam.width / cam.zoom) * 0.5;
    const halfH = (cam.height / cam.zoom) * 0.5;
    let cx = x;
    let cy = y;
    if (this.worldW >= halfW * 2) {
      cx = Math.max(halfW, Math.min(this.worldW - halfW, x));
    } else {
      cx = this.worldW * 0.5;
    }
    if (this.worldH >= halfH * 2) {
      cy = Math.max(halfH, Math.min(this.worldH - halfH, y));
    } else {
      cy = this.worldH * 0.5;
    }
    return { cx, cy };
  }
}
