import { describe, it, expect, vi } from 'vitest';
import type Phaser from 'phaser';
import { CameraNavigator } from '../../src/camera/CameraNavigator';

class FakeCam {
  width = 800;
  height = 450;
  zoom = 1;
  scrollX = 0;
  scrollY = 0;
  pan = vi.fn();
  centerOn = vi.fn((x: number, y: number) => {
    this.scrollX = x - this.width * 0.5;
    this.scrollY = y - this.height * 0.5;
  });
  getWorldPoint() {
    return { x: this.scrollX + this.width * 0.5, y: this.scrollY + this.height * 0.5 };
  }
  zoomTo = vi.fn((z: number) => {
    this.zoom = z;
  });
  once = vi.fn((_e: any, _cb: any) => void 0);
}

class FakeScene {
  cameras = { main: new FakeCam() } as any;
}

describe('CameraNavigator clamping and motion', () => {
  it('teleportTo clamps to world bounds', () => {
    const scene = new FakeScene() as unknown as Phaser.Scene;
    const nav = new CameraNavigator(scene, { world: { w: 1000, h: 600 } });
    nav.teleportTo(5000, -5000);
    const cam = scene.cameras.main as any as FakeCam;
    // Expect clamped to right edge for X, and to top edge for Y
    const expectedX = Math.max(cam.width / 2, Math.min(1000 - cam.width / 2, 5000));
    const expectedY = Math.max(cam.height / 2, Math.min(600 - cam.height / 2, -5000));
    expect(Math.round(cam.scrollX + cam.width * 0.5)).toBeCloseTo(expectedX, 0);
    expect(Math.round(cam.scrollY + cam.height * 0.5)).toBeCloseTo(expectedY, 0);
  });

  it('panTo clamps target before panning', () => {
    const scene = new FakeScene() as unknown as Phaser.Scene;
    const nav = new CameraNavigator(scene, { world: { w: 1200, h: 900 } });
    nav.panTo(-1000, 10_000, 200);
    const cam = scene.cameras.main as any as FakeCam;
    // Expected pan target equals clamped center
    const halfW = (cam.width / cam.zoom) * 0.5;
    const halfH = (cam.height / cam.zoom) * 0.5;
    const cx = Math.max(halfW, Math.min(1200 - halfW, -1000));
    const cy = Math.max(halfH, Math.min(900 - halfH, 10_000));
    expect(cam.pan).toHaveBeenCalledWith(cx, cy, 200, 'Sine.easeInOut');
  });
});
