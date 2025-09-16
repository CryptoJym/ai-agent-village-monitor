import { describe, it, expect } from 'vitest';
import { CameraNavigator } from '../../src/camera/CameraNavigator';

function makeSceneStub() {
  const cam = {
    width: 800,
    height: 450,
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    pan: function (x: number, y: number) {
      this.scrollX = x - this.width / 2 / this.zoom;
      this.scrollY = y - this.height / 2 / this.zoom;
    },
    centerOn: function (x: number, y: number) {
      this.scrollX = x - this.width / 2 / this.zoom;
      this.scrollY = y - this.height / 2 / this.zoom;
    },
    zoomTo: function (z: number) {
      this.zoom = z;
    },
    getWorldPoint: function () {
      return { x: this.scrollX, y: this.scrollY };
    },
  } as any;
  return { cameras: { main: cam } } as any;
}

describe('CameraNavigator', () => {
  it('clamps panTo within world bounds', () => {
    const scene = makeSceneStub();
    const nav = new CameraNavigator(scene as any, { world: { w: 1000, h: 700 } });
    // target outside bounds
    nav.panTo(-100, -100, 0);
    const cam = scene.cameras.main;
    const halfW = cam.width / 2 / cam.zoom;
    const halfH = cam.height / 2 / cam.zoom;
    expect(cam.scrollX).toBeCloseTo(halfW - halfW, 3); // centered at halfW
    expect(cam.scrollY).toBeCloseTo(halfH - halfH, 3);
  });

  it('teleportTo centers immediately within bounds', () => {
    const scene = makeSceneStub();
    const nav = new CameraNavigator(scene as any, { world: { w: 1600, h: 1200 } });
    nav.teleportTo(1550, 1100);
    const cam = scene.cameras.main;
    const halfW = cam.width / 2 / cam.zoom;
    const halfH = cam.height / 2 / cam.zoom;
    // clamped target should be worldW-halfW, worldH-halfH
    expect(cam.scrollX + halfW).toBeCloseTo(1600 - halfW, 3);
    expect(cam.scrollY + halfH).toBeCloseTo(1200 - halfH, 3);
  });
});
