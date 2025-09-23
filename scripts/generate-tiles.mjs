#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { MCPClient } from 'mcp-client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

const TOKEN =
  process.env.PIXELLAB_TOKEN ||
  process.env.PIXELLAB_API_TOKEN;

if (!TOKEN) {
  console.error('❌ PIXELLAB_TOKEN environment variable is required.');
  process.exit(1);
}

const OUTPUT_ROOT = path.resolve(__dirname, '..', 'generated', 'pixellab', 'tiles');
const PUBLIC_ROOT = path.resolve(
  __dirname,
  '..',
  'packages',
  'frontend',
  'public',
  'assets',
  'tiles',
);
const DEFAULT_TILE_OPTIONS = {
  tile_size: { width: 32, height: 32 },
  outline: 'single color outline',
  shading: 'medium shading',
  detail: 'medium detail',
  view: 'high top-down',
  tile_strength: 1.1,
  tileset_adherence: 120,
  tileset_adherence_freedom: 550,
  text_guidance_scale: 9,
};

const BIOME_TILESETS = [
  {
    key: 'ocean-beach',
    title: 'Ocean ↔ Beach Shoreline',
    category: 'biome',
    lower: {
      description: 'ocean water with gentle waves, deep teal, subtle foam',
      passable: false,
      tags: ['water', 'coast'],
    },
    upper: {
      description: 'sunlit sandy beach shoreline with shell fragments and wet sand',
      passable: true,
      tags: ['sand', 'shore'],
    },
    transition: {
      description: 'foamy water meeting sand with sparkling highlights',
      size: 0.25,
    },
  },
  {
    key: 'beach-grass',
    title: 'Beach ↔ Meadow Grass',
    category: 'biome',
    chainLowerFrom: 'ocean-beach',
    lower: {
      description: 'warm sandy beach with scattered shells and tide lines',
      passable: true,
      tags: ['sand'],
    },
    upper: {
      description: 'lush meadow grass with wildflowers and clover patches',
      passable: true,
      tags: ['grass'],
    },
    transition: {
      description: 'damp sand blending into grass tufts with seaweed accents',
      size: 0.25,
    },
  },
  {
    key: 'grass-forest',
    title: 'Grassland ↔ Forest Floor',
    category: 'biome',
    lower: {
      description: 'sunlit meadow grass with subtle texture and scattered petals',
      passable: true,
      tags: ['grass'],
    },
    upper: {
      description: 'mossy forest floor with roots, ferns, and leaf litter',
      passable: false,
      tags: ['forest'],
    },
    transition: {
      description: 'gradual blend of grass into mossy underbrush with exposed roots',
      size: 0.5,
    },
  },
  {
    key: 'grass-rock',
    title: 'Grassland ↔ Rocky Cliff',
    category: 'biome',
    lower: {
      description: 'rolling grass field with small flowers and dew sparkle',
      passable: true,
      tags: ['grass'],
    },
    upper: {
      description: 'weathered stone plateau with cracks, lichen, and cliff edge',
      passable: false,
      tags: ['rock', 'cliff'],
    },
    transition: {
      description: 'tufts of grass giving way to rocky outcrop with erosion',
      size: 0.5,
    },
  },
  {
    key: 'grass-road',
    title: 'Grassland ↔ Village Road',
    category: 'biome',
    lower: {
      description: 'soft meadow grass with trimmed edges',
      passable: true,
      tags: ['grass'],
    },
    upper: {
      description: 'cobbled village road with stones and moss between joints',
      passable: true,
      tags: ['road', 'cobblestone'],
    },
    transition: {
      description: 'trimmed grass bordering cobbled road with wooden edging',
      size: 0,
    },
  },
  {
    key: 'river-grass',
    title: 'Freshwater River ↔ Meadow',
    category: 'biome',
    lower: {
      description: 'clear freshwater river with visible stones and shimmering highlights',
      passable: false,
      tags: ['water', 'river'],
    },
    upper: {
      description: 'lush meadow grass with reeds and small blue flowers',
      passable: true,
      tags: ['grass'],
    },
    transition: {
      description: 'riverbank mud with reeds, stones, and ripples meeting grass',
      size: 0.25,
    },
  },
];
const INTERIOR_TILESETS = [
  {
    key: 'javascript-neon',
    title: 'JavaScript Neon Lab Floor',
    category: 'interior',
    lower: {
      description: 'obsidian glass floor with embedded cyan and magenta LED traces',
      passable: true,
      tags: ['tech', 'glass'],
    },
    upper: {
      description: 'transparent holo walkway with luminous circuitry and neon edge glow',
      passable: true,
      tags: ['tech', 'hologram'],
    },
    transition: {
      description: 'plated metal rails and glowing cables bridging obsidian glass and holo walkway',
      size: 0.25,
    },
    options: {
      tile_strength: 1.25,
      tileset_adherence: 160,
      tileset_adherence_freedom: 420,
      text_guidance_scale: 10,
    },
  },
  {
    key: 'typescript-blueprint',
    title: 'TypeScript Blueprint Hall',
    category: 'interior',
    lower: {
      description: 'polished slate floor with painted type annotations and blueprint markings',
      passable: true,
      tags: ['slate', 'blueprint'],
    },
    upper: {
      description: 'rolled blueprint rugs with precise grid lines and glowing node markers',
      passable: true,
      tags: ['blueprint', 'rug'],
    },
    transition: {
      description: 'brass drafting rulers and parchment trim blending slate into blueprint rugs',
      size: 0.25,
    },
    options: {
      tile_strength: 1.1,
      tileset_adherence: 140,
      tileset_adherence_freedom: 400,
      text_guidance_scale: 9,
    },
  },
  {
    key: 'python-observatory',
    title: 'Python Observatory Cottage',
    category: 'interior',
    lower: {
      description: 'warm stone tiles with spiral motifs and candlelight highlights',
      passable: true,
      tags: ['stone', 'spiral'],
    },
    upper: {
      description: 'star map floor in indigo and gold with constellation inlays',
      passable: true,
      tags: ['astronomy', 'mosaic'],
    },
    transition: {
      description: 'etched bronze rings and flowing script connecting stone to star map',
      size: 0.5,
    },
    options: {
      tile_strength: 1.0,
      tileset_adherence: 130,
      tileset_adherence_freedom: 420,
      text_guidance_scale: 9,
    },
  },
  {
    key: 'go-lodge',
    title: 'Go Coastal Lodge',
    category: 'interior',
    lower: {
      description: 'seashell-infused driftwood planks with salt-washed texture',
      passable: true,
      tags: ['wood', 'coastal'],
    },
    upper: {
      description: 'woven rope runner with nautical knots and teal accents',
      passable: true,
      tags: ['rope', 'runner'],
    },
    transition: {
      description: 'whitewashed plinths and braided rope trim separating driftwood and runner',
      size: 0,
    },
    options: {
      tile_strength: 0.9,
      tileset_adherence: 130,
      tileset_adherence_freedom: 380,
      text_guidance_scale: 8,
    },
  },
  {
    key: 'ruby-workshop',
    title: 'Ruby Artisan Workshop',
    category: 'interior',
    lower: {
      description: 'hand-oiled cherrywood planks with ruby inlay pegs and soft sheen',
      passable: true,
      tags: ['wood', 'artisan'],
    },
    upper: {
      description: 'crimson velvet carpet with stitched geometric patterns and gold thread',
      passable: true,
      tags: ['carpet', 'velvet'],
    },
    transition: {
      description: 'carved wooden moulding with brass studs framing wood and velvet',
      size: 0.25,
    },
    options: {
      tile_strength: 1.0,
      tileset_adherence: 140,
      tileset_adherence_freedom: 400,
      text_guidance_scale: 8,
    },
  },
  {
    key: 'java-brew',
    title: 'Java Brew Guild Floor',
    category: 'interior',
    lower: {
      description: 'dark cobblestone floor warmed with coffee stain patina and steam marks',
      passable: true,
      tags: ['stone', 'coffee'],
    },
    upper: {
      description: 'coffee bean mosaic tile with latte art swirls and brass accents',
      passable: true,
      tags: ['mosaic', 'coffee'],
    },
    transition: {
      description: 'copper piping and burlap runners guiding from stone to coffee mosaic',
      size: 0.25,
    },
    options: {
      tile_strength: 1.05,
      tileset_adherence: 145,
      tileset_adherence_freedom: 410,
      text_guidance_scale: 9,
    },
  },
  {
    key: 'csharp-conservatory',
    title: 'C# Azure Conservatory',
    category: 'interior',
    lower: {
      description: 'frosted azure glass floor with bracket-shaped metal framing',
      passable: true,
      tags: ['glass', 'azure'],
    },
    upper: {
      description: 'illuminated glass walkway with cool white light panels and organ pipes',
      passable: true,
      tags: ['glass', 'light'],
    },
    transition: {
      description: 'brushed steel channels and glowing bracket glyphs blending glass levels',
      size: 0.25,
    },
    options: {
      tile_strength: 1.2,
      tileset_adherence: 155,
      tileset_adherence_freedom: 430,
      text_guidance_scale: 10,
    },
  },
  {
    key: 'generic-commons',
    title: 'Commons Guild Hall',
    category: 'interior',
    lower: {
      description: 'neutral stone tiles with gentle wear and community crest engravings',
      passable: true,
      tags: ['stone', 'neutral'],
    },
    upper: {
      description: 'woven tatami mats with understated pattern and warm lantern glow',
      passable: true,
      tags: ['tatami', 'commons'],
    },
    transition: {
      description: 'wooden trim and paper lantern bases easing stone into tatami',
      size: 0.25,
    },
    options: {
      tile_strength: 1.0,
      tileset_adherence: 130,
      tileset_adherence_freedom: 380,
      text_guidance_scale: 8,
    },
  },
];
const TILESET_GROUPS = {
  biome: BIOME_TILESETS,
  interior: INTERIOR_TILESETS,
};

const argv = process.argv.slice(2);
const categoryFilters = new Set();
const entryFilters = new Set();
let force = false;

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--force') {
    force = true;
  } else if (arg.startsWith('--category')) {
    const value = arg.includes('=') ? arg.split('=')[1] : argv[++i];
    value
      ?.split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
      .forEach((val) => categoryFilters.add(val));
  } else if (arg.startsWith('--tileset')) {
    const value = arg.includes('=') ? arg.split('=')[1] : argv[++i];
    value
      ?.split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
      .forEach((val) => entryFilters.add(val));
  }
}

function shouldInclude(category, key) {
  const catMatch = categoryFilters.size === 0 || categoryFilters.has(category);
  const entryMatch = entryFilters.size === 0 || entryFilters.has(key);
  return catMatch && entryMatch;
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

async function downloadJson(url) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }
  return response.json();
}
function buildTransport() {
  const endpoint = new URL('https://api.pixellab.ai/mcp/');
  return new StreamableHTTPClientTransport(endpoint, {
    requestInit: {
      headers: { Authorization: `Bearer ${TOKEN}` },
    },
  });
}

async function createPixellabClient() {
  const client = new MCPClient({ name: 'TileGenerator', version: '0.1.0' });
  await client.client.connect(buildTransport());
  return client;
}

const ID_REGEX = /`([0-9a-fA-F-]{36})`/g;
const DOWNLOAD_REGEX = /(https:\/\/api\.pixellab\.ai\/mcp\/tilesets\/[0-9a-fA-F-]{36}\/image)/;
const METADATA_REGEX = /(https:\/\/api\.pixellab\.ai\/mcp\/tilesets\/[0-9a-fA-F-]{36}\/metadata)/;
const LOWER_BASE_REGEX = /Lower .*?: `([0-9a-fA-F-]{36})`/i;
const UPPER_BASE_REGEX = /Upper .*?: `([0-9a-fA-F-]{36})`/i;

function extractIdFromText(text) {
  const match = ID_REGEX.exec(text);
  ID_REGEX.lastIndex = 0;
  return match ? match[1] : null;
}

function extractBaseIds(text) {
  const lower = LOWER_BASE_REGEX.exec(text)?.[1] ?? null;
  const upper = UPPER_BASE_REGEX.exec(text)?.[1] ?? null;
  return { lower, upper };
}

function extractDownloadLinks(text) {
  const png = DOWNLOAD_REGEX.exec(text)?.[1] ?? null;
  const meta = METADATA_REGEX.exec(text)?.[1] ?? null;
  return { png, meta };
}
async function pollTileset(client, tilesetId) {
  const maxAttempts = 40;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await client.callTool({
      name: 'get_topdown_tileset',
      arguments: { tileset_id: tilesetId },
    });
    const text = response.content.find((item) => item.type === 'text')?.text ?? '';
    const headline = text.split('\n')[0];
    console.log(`   ${tilesetId} ${headline}`);
    if (headline.startsWith('✅ Tileset')) {
      return { text, response };
    }
    if (text.toLowerCase().includes('status: failed')) {
      throw new Error(`Tileset ${tilesetId} failed to generate\n${text}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
  throw new Error(`Tileset ${tilesetId} did not complete within timeout`);
}
function buildArguments(entry, baseLookup) {
  const merged = { ...DEFAULT_TILE_OPTIONS, ...(entry.options ?? {}) };
  const args = {
    lower_description: entry.lower.description,
    upper_description: entry.upper.description,
    transition_size: entry.transition?.size ?? 0,
    transition_description: entry.transition?.description ?? null,
    ...merged,
  };
  if (!args.transition_description) {
    delete args.transition_description;
  }
  if (entry.lowerBaseId) {
    args.lower_base_tile_id = entry.lowerBaseId;
  }
  if (entry.upperBaseId) {
    args.upper_base_tile_id = entry.upperBaseId;
  }
  if (entry.chainLowerFrom && baseLookup.has(entry.chainLowerFrom)) {
    args.lower_base_tile_id = baseLookup.get(entry.chainLowerFrom).upper;
  }
  if (entry.chainUpperFrom && baseLookup.has(entry.chainUpperFrom)) {
    args.upper_base_tile_id = baseLookup.get(entry.chainUpperFrom).upper;
  }
  return args;
}
async function processEntry(client, entry, baseLookup) {
  const entryKey = `${entry.category}/${entry.key}`;
  console.log(`\n🚀 Generating tileset: ${entryKey}`);

  const generatedDir = path.join(OUTPUT_ROOT, entry.category, entry.key);
  const publicDir = path.join(PUBLIC_ROOT, entry.category, entry.key);
  const metadataPath = path.join(publicDir, 'metadata.json');

  if (!force && (await pathExists(metadataPath))) {
    console.log(`   ↻ Existing tileset found at ${metadataPath}, skipping generation.`);
    try {
      const existing = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      baseLookup.set(entry.key, {
        lower: existing.lower?.baseTileId ?? null,
        upper: existing.upper?.baseTileId ?? null,
      });
    } catch (err) {
      console.warn(`   ⚠️ Failed to parse existing metadata, regeneration recommended: ${err}`);
    }
    return;
  }

  const args = buildArguments(entry, baseLookup);
  const createRes = await client.callTool({ name: 'create_topdown_tileset', arguments: args });
  const createText = createRes.content.find((item) => item.type === 'text')?.text ?? '';
  const tilesetId = extractIdFromText(createText);
  if (!tilesetId) {
    throw new Error(`Unable to parse tileset id for ${entryKey}:\n${createText}`);
  }

  console.log(`   Tileset ID: ${tilesetId}`);
  const final = await pollTileset(client, tilesetId);
  const finalText = final.text;
  const downloads = extractDownloadLinks(finalText);
  if (!downloads.png || !downloads.meta) {
    throw new Error(`Missing download links for ${entryKey}:\n${finalText}`);
  }
  const baseIds = extractBaseIds(finalText);
  baseLookup.set(entry.key, baseIds);

  await ensureDir(generatedDir);
  await ensureDir(publicDir);

  const pngPath = path.join(generatedDir, 'tileset.png');
  await downloadFile(downloads.png, pngPath);
  await fs.copyFile(pngPath, path.join(publicDir, 'tileset.png'));

  const wangMetadata = await downloadJson(downloads.meta);
  const wangMetadataPath = path.join(generatedDir, 'wang-metadata.json');
  await fs.writeFile(wangMetadataPath, JSON.stringify(wangMetadata, null, 2));
  await fs.writeFile(
    path.join(publicDir, 'wang-metadata.json'),
    JSON.stringify(wangMetadata, null, 2),
  );

  const statusPath = path.join(generatedDir, 'status.md');
  await fs.writeFile(statusPath, finalText, 'utf8');

  const metadata = {
    tilesetId,
    title: entry.title,
    category: entry.category,
    key: entry.key,
    lower: {
      description: entry.lower.description,
      passable: entry.lower.passable,
      tags: entry.lower.tags ?? [],
      baseTileId: baseIds.lower,
    },
    upper: {
      description: entry.upper.description,
      passable: entry.upper.passable,
      tags: entry.upper.tags ?? [],
      baseTileId: baseIds.upper,
    },
    transition: {
      size: entry.transition?.size ?? 0,
      description: entry.transition?.description ?? null,
    },
    tileSize: {
      width: args.tile_size?.width ?? DEFAULT_TILE_OPTIONS.tile_size.width,
      height: args.tile_size?.height ?? DEFAULT_TILE_OPTIONS.tile_size.height,
    },
    files: {
      image: 'tileset.png',
      definition: 'wang-metadata.json',
    },
    notes: entry.notes ?? null,
    generatedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    path.join(generatedDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
  );
  await fs.writeFile(path.join(publicDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  console.log(
    `✅ Saved tileset ${entryKey} to ${path.relative(process.cwd(), publicDir)} (base tiles: ${baseIds.lower} / ${baseIds.upper})`,
  );
}
async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
async function run() {
  await ensureDir(OUTPUT_ROOT);
  await ensureDir(PUBLIC_ROOT);

  const baseLookup = new Map();
  const client = await createPixellabClient();
  try {
    for (const [category, entries] of Object.entries(TILESET_GROUPS)) {
      for (const entry of entries) {
        if (!shouldInclude(category, entry.key)) continue;
        await processEntry(client, entry, baseLookup);
      }
    }
  } finally {
    await client.close();
  }
}

run()
  .then(() => {
    console.log('\n🎉 Tile generation complete.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed to generate tiles:', error);
    process.exit(1);
  });
