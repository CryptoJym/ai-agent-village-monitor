#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  'packages',
  'frontend',
  'src',
  'data',
  'houses',
);

const BLUEPRINT_CONFIGS = [
  {
    theme: 'javascript',
    tilesetKey: 'interior/javascript-neon',
    width: 10,
    height: 10,
    accentRegions: [
      { x0: 2, y0: 2, x1: 8, y1: 8 },
      { x0: 4, y0: 1, x1: 6, y1: 9 },
    ],
    props: [
      { key: 'neon-workbench', position: [3, 3], layer: 'decor', orientation: 'south' },
      { key: 'quantum-server', position: [6, 4], layer: 'decor', orientation: 'west' },
      { key: 'neon-planter', position: [2, 7], layer: 'decor', orientation: 'south', passable: true },
    ],
    spawns: {
      player: [5, 8],
      npcs: [
        [3, 5],
        [7, 3],
      ],
    },
  },
  {
    theme: 'typescript',
    tilesetKey: 'interior/typescript-blueprint',
    width: 10,
    height: 10,
    accentRegions: [
      { x0: 1, y0: 1, x1: 9, y1: 3 },
      { x0: 3, y0: 6, x1: 7, y1: 9 },
    ],
    props: [
      { key: 'drafting-table', position: [4, 4], layer: 'work', orientation: 'south' },
      { key: 'plan-cabinet', position: [7, 2], layer: 'work', orientation: 'west' },
      { key: 'reference-lectern', position: [3, 7], layer: 'work', orientation: 'south' },
    ],
    spawns: {
      player: [5, 9],
      npcs: [
        [4, 5],
        [8, 8],
      ],
    },
  },
  {
    theme: 'python',
    tilesetKey: 'interior/python-observatory',
    width: 10,
    height: 10,
    accentRegions: [
      { x0: 2, y0: 2, x1: 8, y1: 8 },
      { x0: 0, y0: 5, x1: 10, y1: 7 },
    ],
    props: [
      { key: 'star-telescope', position: [2, 2], layer: 'observatory', orientation: 'south' },
      { key: 'serpent-bookshelf', position: [8, 3], layer: 'observatory', orientation: 'west' },
      { key: 'alchemy-table', position: [6, 7], layer: 'observatory', orientation: 'south' },
    ],
    spawns: {
      player: [5, 8],
      npcs: [
        [3, 4],
        [7, 5],
      ],
    },
  },
  {
    theme: 'go',
    tilesetKey: 'interior/go-lodge',
    width: 9,
    height: 9,
    accentRegions: [
      { x0: 1, y0: 1, x1: 8, y1: 4 },
      { x0: 2, y0: 6, x1: 7, y1: 9 },
    ],
    props: [
      { key: 'nautical-chart-table', position: [3, 3], layer: 'decor', orientation: 'south' },
      { key: 'coastal-hammock', position: [6, 7], layer: 'decor', orientation: 'south', passable: true },
      { key: 'shell-cabinet', position: [7, 2], layer: 'decor', orientation: 'west' },
    ],
    spawns: {
      player: [5, 8],
      npcs: [
        [4, 6],
        [6, 4],
      ],
    },
  },
  {
    theme: 'ruby',
    tilesetKey: 'interior/ruby-workshop',
    width: 9,
    height: 9,
    accentRegions: [
      { x0: 2, y0: 2, x1: 7, y1: 7 },
      { x0: 1, y0: 1, x1: 3, y1: 3 },
    ],
    props: [
      { key: 'jewelers-bench', position: [3, 3], layer: 'work', orientation: 'south' },
      { key: 'gem-display', position: [6, 4], layer: 'decor', orientation: 'south' },
      { key: 'forge-hearth', position: [4, 7], layer: 'work', orientation: 'south' },
    ],
    spawns: {
      player: [5, 8],
      npcs: [
        [3, 5],
        [7, 5],
      ],
    },
  },
  {
    theme: 'java',
    tilesetKey: 'interior/java-brew',
    width: 10,
    height: 9,
    accentRegions: [
      { x0: 0, y0: 4, x1: 10, y1: 6 },
      { x0: 2, y0: 1, x1: 8, y1: 3 },
    ],
    props: [
      { key: 'espresso-bar', position: [5, 2], layer: 'service', orientation: 'south' },
      { key: 'bean-barrel', position: [2, 6], layer: 'service', orientation: 'south', passable: true },
      { key: 'brew-tasting-table', position: [7, 7], layer: 'service', orientation: 'south' },
    ],
    spawns: {
      player: [5, 8],
      npcs: [
        [3, 5],
        [7, 5],
      ],
    },
  },
  {
    theme: 'csharp',
    tilesetKey: 'interior/csharp-conservatory',
    width: 10,
    height: 10,
    accentRegions: [
      { x0: 2, y0: 2, x1: 8, y1: 8 },
      { x0: 4, y0: 4, x1: 6, y1: 10 },
    ],
    props: [
      { key: 'organ-console', position: [4, 3], layer: 'performance', orientation: 'south' },
      { key: 'azure-planter', position: [7, 6], layer: 'decor', orientation: 'south', passable: true },
      { key: 'control-dais', position: [5, 8], layer: 'performance', orientation: 'south' },
    ],
    spawns: {
      player: [5, 9],
      npcs: [
        [3, 6],
        [7, 4],
      ],
    },
  },
  {
    theme: 'commons',
    tilesetKey: 'interior/generic-commons',
    width: 9,
    height: 9,
    accentRegions: [
      { x0: 1, y0: 1, x1: 8, y1: 3 },
      { x0: 2, y0: 6, x1: 7, y1: 9 },
    ],
    props: [
      { key: 'commons-table', position: [4, 3], layer: 'gathering', orientation: 'south' },
      { key: 'notice-board', position: [2, 7], layer: 'gathering', orientation: 'south' },
      { key: 'lantern-hearth', position: [6, 7], layer: 'gathering', orientation: 'south' },
    ],
    spawns: {
      player: [4, 8],
      npcs: [
        [3, 5],
        [6, 4],
      ],
    },
  },
];
function createVertexGrid(width, height, accentRegions) {
  const grid = Array.from({ length: height + 1 }, () => Array(width + 1).fill(0));
  for (const region of accentRegions) {
    const { x0, y0, x1, y1 } = region;
    for (let y = Math.max(0, y0); y <= Math.min(height, y1); y += 1) {
      for (let x = Math.max(0, x0); x <= Math.min(width, x1); x += 1) {
        grid[y][x] = 1;
      }
    }
  }
  return grid;
}

async function writeBlueprint(config) {
  const { theme, tilesetKey, width, height, accentRegions, props, spawns } = config;
  const vertexGrid = createVertexGrid(width, height, accentRegions ?? []);
  const blueprint = {
    theme,
    tilesetKey,
    dimensions: { width, height },
    vertexGrid,
    props,
    spawns,
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, `${theme}.json`);
  await fs.writeFile(filePath, JSON.stringify(blueprint, null, 2));
  console.log(`🧭 Blueprint written: ${path.relative(process.cwd(), filePath)}`);
}

async function run() {
  for (const blueprint of BLUEPRINT_CONFIGS) {
    await writeBlueprint(blueprint);
  }
}

run()
  .then(() => {
    console.log('\n🎉 House blueprints generated.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed to generate house blueprints:', error);
    process.exit(1);
  });
