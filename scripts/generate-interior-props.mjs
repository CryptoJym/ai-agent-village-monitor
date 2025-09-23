#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { MCPClient } from 'mcp-client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const TOKEN =
  process.env.PIXELLAB_TOKEN ||
  process.env.PIXELLAB_API_TOKEN;

if (!TOKEN) {
  console.error('❌ PIXELLAB_TOKEN environment variable is required.');
  process.exit(1);
}

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

const OUTPUT_ROOT = path.resolve(__dirname, '..', 'generated', 'pixellab', 'interiors');
const PUBLIC_ROOT = path.resolve(
  __dirname,
  '..',
  'packages',
  'frontend',
  'public',
  'assets',
  'interiors',
);

const DEFAULT_PROP_OPTIONS = {
  size: 32,
  outline: 'single color outline',
  shading: 'medium shading',
  detail: 'medium detail',
  text_guidance_scale: 9,
};

const INTERIOR_PROPS = [
  {
    theme: 'javascript',
    tilesetKey: 'interior/javascript-neon',
    props: [
      {
        key: 'neon-workbench',
        description:
          '32x32 isometric pixel art neon lab workbench with holographic screens, glowing cables, and scattered components, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['workbench', 'tech'],
      },
      {
        key: 'quantum-server',
        description:
          '32x32 isometric pixel art server pillar with pulsating cyan lights, glass panels, and cable harness, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['server', 'tech'],
      },
      {
        key: 'neon-planter',
        description:
          '32x32 isometric pixel art futuristic planter with bioluminescent plants, neon rim, and soft glow, transparent background',
        passable: true,
        orientation: 'south',
        tags: ['decor', 'plant'],
      },
    ],
  },
  {
    theme: 'typescript',
    tilesetKey: 'interior/typescript-blueprint',
    props: [
      {
        key: 'drafting-table',
        description:
          '32x32 isometric pixel art drafting table covered in blueprints, measuring tools, and lamp, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['table', 'drafting'],
      },
      {
        key: 'plan-cabinet',
        description:
          '32x32 isometric pixel art blueprint cabinet with rolled plans, pigeonholes, and brass handles, transparent background',
        passable: false,
        orientation: 'west',
        tags: ['storage', 'plans'],
      },
      {
        key: 'reference-lectern',
        description:
          '32x32 isometric pixel art lectern displaying glowing specification manuscript with quill and brass lamp, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['lectern', 'reference'],
      },
    ],
  },
  {
    theme: 'python',
    tilesetKey: 'interior/python-observatory',
    props: [
      {
        key: 'star-telescope',
        description:
          '32x32 isometric pixel art brass observatory telescope on carved base with star scrolls, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['telescope', 'astronomy'],
      },
      {
        key: 'serpent-bookshelf',
        description:
          '32x32 isometric pixel art curved bookshelf with glowing tomes, serpent carvings, and candles, transparent background',
        passable: false,
        orientation: 'west',
        tags: ['bookshelf', 'library'],
      },
      {
        key: 'alchemy-table',
        description:
          '32x32 isometric pixel art alchemy worktable with crystal orbs, potions, and rune carvings, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['table', 'alchemy'],
      },
    ],
  },
  {
    theme: 'go',
    tilesetKey: 'interior/go-lodge',
    props: [
      {
        key: 'nautical-chart-table',
        description:
          '32x32 isometric pixel art driftwood table with nautical charts, compass, and coiled rope, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['table', 'nautical'],
      },
      {
        key: 'coastal-hammock',
        description:
          '32x32 isometric pixel art rope hammock with soft teal cushions suspended on wooden frame, transparent background',
        passable: true,
        orientation: 'south',
        tags: ['hammock', 'relax'],
      },
      {
        key: 'shell-cabinet',
        description:
          '32x32 isometric pixel art display cabinet with shells, bottled currents, and lantern, transparent background',
        passable: false,
        orientation: 'west',
        tags: ['cabinet', 'decor'],
      },
    ],
  },
  {
    theme: 'ruby',
    tilesetKey: 'interior/ruby-workshop',
    props: [
      {
        key: 'jewelers-bench',
        description:
          '32x32 isometric pixel art jeweler bench with magnifier lamp, gemstones, and engraving tools, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['bench', 'artisan'],
      },
      {
        key: 'gem-display',
        description:
          '32x32 isometric pixel art glass display case filled with glowing ruby artifacts, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['display', 'gem'],
      },
      {
        key: 'forge-hearth',
        description:
          '32x32 isometric pixel art small forge hearth with ember coals and hanging tools, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['forge', 'heat'],
      },
    ],
  },
  {
    theme: 'java',
    tilesetKey: 'interior/java-brew',
    props: [
      {
        key: 'espresso-bar',
        description:
          '32x32 isometric pixel art espresso bar with steaming machines, cups, and pastries, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['bar', 'coffee'],
      },
      {
        key: 'bean-barrel',
        description:
          '32x32 isometric pixel art burlap coffee bean barrel with scoop and spilled beans, transparent background',
        passable: true,
        orientation: 'south',
        tags: ['barrel', 'coffee'],
      },
      {
        key: 'brew-tasting-table',
        description:
          '32x32 isometric pixel art tasting table with sampler flights, mugs, and brewing notes, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['table', 'coffee'],
      },
    ],
  },
  {
    theme: 'csharp',
    tilesetKey: 'interior/csharp-conservatory',
    props: [
      {
        key: 'organ-console',
        description:
          '32x32 isometric pixel art azure pipe-organ console with bracket-shaped keys and glowing stops, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['instrument', 'console'],
      },
      {
        key: 'azure-planter',
        description:
          '32x32 isometric pixel art crystal planter with bioluminescent azure flora and light prism stand, transparent background',
        passable: true,
        orientation: 'south',
        tags: ['planter', 'decor'],
      },
      {
        key: 'control-dais',
        description:
          '32x32 isometric pixel art elevated control dais with holographic displays and bracket sigils, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['platform', 'control'],
      },
    ],
  },
  {
    theme: 'commons',
    tilesetKey: 'interior/generic-commons',
    props: [
      {
        key: 'commons-table',
        description:
          '32x32 isometric pixel art communal table with board games, tea set, and scrolls, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['table', 'commons'],
      },
      {
        key: 'notice-board',
        description:
          '32x32 isometric pixel art bulletin board covered in quest notices, strings, and lanterns, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['board', 'quests'],
      },
      {
        key: 'lantern-hearth',
        description:
          '32x32 isometric pixel art stone hearth with suspended paper lanterns and seating cushions, transparent background',
        passable: false,
        orientation: 'south',
        tags: ['hearth', 'lantern'],
      },
    ],
  },
];
const argv = process.argv.slice(2);
const themeFilters = new Set();
const propFilters = new Set();
let force = false;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--force') {
    force = true;
  } else if (arg.startsWith('--theme')) {
    const value = arg.includes('=') ? arg.split('=')[1] : argv[++i];
    value
      ?.split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
      .forEach((val) => themeFilters.add(val));
  } else if (arg.startsWith('--prop')) {
    const value = arg.includes('=') ? arg.split('=')[1] : argv[++i];
    value
      ?.split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
      .forEach((val) => propFilters.add(val));
  }
}

function shouldProcess(theme, key) {
  const themeMatch = themeFilters.size === 0 || themeFilters.has(theme);
  const propMatch = propFilters.size === 0 || propFilters.has(key);
  return themeMatch && propMatch;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function downloadFile(url, destination) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(destination, Buffer.from(arrayBuffer));
}

const TILE_ID_REGEX = /`([0-9a-fA-F-]{36})`/;
const DOWNLOAD_REGEX = /(https:\/\/api\.pixellab\.ai\/mcp\/isometric-tile\/[0-9a-fA-F-]{36}\/download)/;
const CREATED_REGEX = /Created:\s*([^\n]+)/;

function extractTileId(text) {
  return text.match(TILE_ID_REGEX)?.[1] ?? null;
}

function extractDownloadUrl(text) {
  return text.match(DOWNLOAD_REGEX)?.[1] ?? null;
}

function extractCreatedAt(text) {
  return text.match(CREATED_REGEX)?.[1] ?? null;
}

function buildTransport() {
  const endpoint = new URL('https://api.pixellab.ai/mcp/');
  return new StreamableHTTPClientTransport(endpoint, {
    requestInit: {
      headers: { Authorization: `Bearer ${TOKEN}` },
    },
  });
}

async function createClient() {
  const client = new MCPClient({ name: 'InteriorProps', version: '0.1.0' });
  await client.client.connect(buildTransport());
  return client;
}

async function pollProp(client, tileId) {
  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await client.callTool({
      name: 'get_isometric_tile',
      arguments: { tile_id: tileId },
    });
    const text = response.content.find((item) => item.type === 'text')?.text ?? '';
    const headline = text.split('\n')[0];
    console.log(`   ${tileId} ${headline}`);
    if (headline.startsWith('✅ Isometric Tile')) {
      return { text, response };
    }
    if (text.toLowerCase().includes('status: failed')) {
      throw new Error(`Tile ${tileId} failed: ${text}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`Tile ${tileId} did not complete within timeout`);
}

async function loadThemeMetadata(theme) {
  const metadataPath = path.join(PUBLIC_ROOT, theme, 'metadata.json');
  if (!(await pathExists(metadataPath))) {
    return { theme, tilesetKey: null, props: [] };
  }
  try {
    const raw = await fs.readFile(metadataPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`⚠️ Failed to parse metadata for theme ${theme}, regenerating:`, err);
    return { theme, tilesetKey: null, props: [] };
  }
}

function mergePropMetadata(existingProps, newProp) {
  const filtered = existingProps.filter((item) => item.key !== newProp.key);
  filtered.push(newProp);
  filtered.sort((a, b) => a.key.localeCompare(b.key));
  return filtered;
}

async function processProp(client, themeEntry, propEntry) {
  const themeKey = themeEntry.theme;
  const propKey = propEntry.key;

  const themeOutputDir = path.join(OUTPUT_ROOT, themeKey, 'props', propKey);
  const themePublicDir = path.join(PUBLIC_ROOT, themeKey, 'props');
  const publicImagePath = path.join(themePublicDir, `${propKey}.png`);

  if (!force && (await pathExists(publicImagePath))) {
    console.log(`   ↻ ${themeKey}/${propKey} already exists, skipping`);
    return null;
  }

  await ensureDir(themeOutputDir);
  await ensureDir(themePublicDir);

  const args = {
    description: propEntry.description,
    ...DEFAULT_PROP_OPTIONS,
  };

  const createRes = await client.callTool({
    name: 'create_isometric_tile',
    arguments: args,
  });
  const createText = createRes.content.find((item) => item.type === 'text')?.text ?? '';
  const tileId = extractTileId(createText);
  if (!tileId) {
    throw new Error(`Unable to parse tile id for ${themeKey}/${propKey}:\n${createText}`);
  }

  console.log(`   Tile ID: ${tileId}`);
  const final = await pollProp(client, tileId);
  const finalText = final.text;
  const downloadUrl = extractDownloadUrl(finalText);
  if (!downloadUrl) {
    throw new Error(`Missing download URL for ${themeKey}/${propKey}:\n${finalText}`);
  }

  const generatedImagePath = path.join(themeOutputDir, `${propKey}.png`);
  await downloadFile(downloadUrl, generatedImagePath);
  await fs.copyFile(generatedImagePath, publicImagePath);

  const rawCreatedAt = extractCreatedAt(finalText);
  const createdAt = rawCreatedAt ? rawCreatedAt.replace(/\*/g, '').trim() : new Date().toISOString();

  const propMetadata = {
    key: propKey,
    description: propEntry.description,
    passable: Boolean(propEntry.passable),
    orientation: propEntry.orientation ?? null,
    tags: propEntry.tags ?? [],
    tileId,
    file: `props/${propKey}.png`,
    size: {
      width: DEFAULT_PROP_OPTIONS.size,
      height: DEFAULT_PROP_OPTIONS.size,
    },
    generatedAt: createdAt,
  };

  await fs.writeFile(path.join(themeOutputDir, 'status.md'), finalText, 'utf8');

  return propMetadata;
}

async function run() {
  await ensureDir(OUTPUT_ROOT);
  await ensureDir(PUBLIC_ROOT);

  const client = await createClient();
  try {
    for (const themeEntry of INTERIOR_PROPS) {
      if (themeFilters.size > 0 && !themeFilters.has(themeEntry.theme)) continue;

      console.log(`\n🎨 Theme: ${themeEntry.theme}`);
      const themeMetadata = await loadThemeMetadata(themeEntry.theme);
      if (!themeMetadata.theme) {
        themeMetadata.theme = themeEntry.theme;
      }
      if (!themeMetadata.tilesetKey) {
        themeMetadata.tilesetKey = themeEntry.tilesetKey;
      }

      for (const propEntry of themeEntry.props) {
        if (!shouldProcess(themeEntry.theme, propEntry.key)) continue;
        try {
          const propMetadata = await processProp(client, themeEntry, propEntry);
          if (propMetadata) {
            themeMetadata.props = mergePropMetadata(themeMetadata.props ?? [], propMetadata);
          }
        } catch (err) {
          console.error(`❌ Failed to generate ${themeEntry.theme}/${propEntry.key}:`, err);
          if (!force) {
            throw err;
          }
        }
      }

      const themePublicDir = path.join(PUBLIC_ROOT, themeEntry.theme);
      await ensureDir(themePublicDir);
      await fs.writeFile(
        path.join(themePublicDir, 'metadata.json'),
        JSON.stringify(themeMetadata, null, 2),
      );
    }
  } finally {
    await client.close();
  }
}

run()
  .then(() => {
    console.log('\n🎉 Interior prop generation complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed to generate interior props:', error);
    process.exit(1);
  });
