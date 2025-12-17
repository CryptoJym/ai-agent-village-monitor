import Phaser from 'phaser';

export interface WorldNodeConfig {
  gridSize?: number;
  walkable?: boolean;
  spawnPoint?: { x: number; y: number };
  layout?: { x: number; y: number; r: number };
}

export interface WorldNodeAssets {
  background?: string;
  collision?: string;
}

export interface WorldNode {
  id: string;
  name: string;
  type: 'VILLAGE' | 'HOUSE' | 'ROOM' | 'DUNGEON';
  children?: WorldNode[];
  config?: WorldNodeConfig;
  assets?: WorldNodeAssets;
}

export class WorldGenerator {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Generates a tilemap from a WorldNode.
   * For now, this creates a background image and a collision grid.
   */
  createWorld(node: WorldNode): {
    map: Phaser.Tilemaps.Tilemap;
    layer: Phaser.Tilemaps.TilemapLayer;
    background?: Phaser.GameObjects.Image;
  } {
    const gridSize = node.config?.gridSize || 32;
    const width = 32; // 32x32 grid = 1024x1024 pixels (assuming 32px tiles)
    const height = 32;

    // Create a blank tilemap
    const map = this.scene.make.tilemap({
      tileWidth: gridSize,
      tileHeight: gridSize,
      width: width,
      height: height,
    });

    // Add the background image as a tileset (hacky but works for single-image backgrounds)
    // In a real SNES generator, we'd use actual tilesets.
    // Here we assume the 'background' asset is loaded and we place it as an image,
    // then use invisible tiles for collision.

    const tileset = map.addTilesetImage('tiles'); // Placeholder
    const layer = map.createBlankLayer('Ground', tileset!);

    let background: Phaser.GameObjects.Image | undefined;

    // If we have a background asset, we render it separately as an image under the tilemap
    if (node.assets?.background) {
      const bg = this.scene.add.image(0, 0, node.assets.background);
      bg.setOrigin(0, 0);
      bg.setDepth(-1);
      // Scale if necessary to match grid
      bg.setDisplaySize(width * gridSize, height * gridSize);
      background = bg;
    }

    // Set collision based on 'walkable' config
    // For now, simple border collision
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          // Wall
          // layer.putTileAt(1, x, y); // 1 = wall
        } else {
          // Floor
          // layer.putTileAt(0, x, y); // 0 = floor
        }
      }
    }

    return { map, layer: layer!, background };
  }

  /**
   * Places portals for child nodes.
   */
  placePortals(node: WorldNode, group: Phaser.GameObjects.Group) {
    if (!node.children) return;

    const width = 1024; // Map pixel width
    const height = 1024;

    node.children.forEach((child) => {
      if (child.config?.layout) {
        // Layout x,y are 0.0-1.0 relative to parent center?
        // Let's assume layout.x/y are normalized 0-1
        const x = child.config.layout.x * width;
        const y = child.config.layout.y * height;

        const portal = this.scene.add.zone(x, y, 64, 64);
        this.scene.physics.add.existing(portal);
        (portal.body as Phaser.Physics.Arcade.Body).setImmovable(true);
        portal.setData('nodeId', child.id);
        group.add(portal);

        // Visual marker (temporary)
        const marker = this.scene.add.circle(x, y, 32, 0x00ff00, 0.5);
        marker.setDepth(10);
      }
    });
  }
}
