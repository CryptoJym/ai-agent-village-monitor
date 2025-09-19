#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { MCPClient } from 'mcp-client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKEN = process.env.PIXELLAB_TOKEN || process.env.PIXELLAB_API_TOKEN;
if (!TOKEN) {
  console.error('❌ PIXELLAB_TOKEN environment variable is required.');
  process.exit(1);
}

const OUTPUT_ROOTS = {
  agents: path.resolve(__dirname, '..', 'generated', 'pixellab', 'agents'),
  emotes: path.resolve(__dirname, '..', 'generated', 'pixellab', 'emotes'),
  bugBots: path.resolve(__dirname, '..', 'generated', 'pixellab', 'bug-bots'),
  houses: path.resolve(__dirname, '..', 'generated', 'pixellab', 'houses'),
};

const PUBLIC_ROOTS = {
  agents: path.resolve(__dirname, '..', 'packages', 'frontend', 'public', 'assets', 'agents'),
  emotes: path.resolve(__dirname, '..', 'packages', 'frontend', 'public', 'assets', 'emotes'),
  bugBots: path.resolve(__dirname, '..', 'packages', 'frontend', 'public', 'assets', 'bug-bots'),
  houses: path.resolve(__dirname, '..', 'packages', 'frontend', 'public', 'assets', 'houses'),
};

const AGENT_DEFS = [
  {
    key: 'scholar',
    name: 'Scholar Agent',
    description:
      'FF3 pixel art style 32x32 agent sprite, Studio Ghibli charm. Scholarly personality with warm brown robes, small scroll or book accessory. Wise, contemplative expression. Lofi color palette: mellow apricot (#FCBE6F) robes, menthol green (#B3F39E) trim, brass (#A8A441) book binding. European village scholar aesthetic, like a gentle mage from Final Fantasy 3 meets Howl\'s Moving Castle librarian. 8-frame walking animation showing thoughtful, measured stride. TRANSPARENT BACKGROUND, no background elements, PNG-24 with alpha channel.',
    animationTemplate: 'walking',
  },
  {
    key: 'artisan',
    name: 'Artisan Agent',
    description:
      '32x32 FF3/Ghibli pixel art agent with craftsperson aesthetic. Leather apron, small hammer or wrench accessory. Sturdy build, confident posture. Lofi palette: dark chestnut (#70301D) apron, mellow apricot shirt, menthol green tool handles. Village blacksmith meets Ghibli workshop master. 8 walking frames showing purposeful, maker\'s stride. TRANSPARENT BACKGROUND, no background elements, character only.',
    animationTemplate: 'walking',
  },
  {
    key: 'explorer',
    name: 'Explorer Agent',
    description:
      '32x32 FF3 style adventurer agent, Studio Ghibli wanderer vibe. Travel cloak, small compass or map accessory. Alert, curious expression. Lofi colors: jet stream blue (#ACD3C5) cloak, brass compass, mellow apricot undergarments. European village explorer ready for new discoveries. 8-frame walk showing eager, investigating gait. TRANSPARENT BACKGROUND, PNG with alpha, no background.',
    animationTemplate: 'walking',
  },
  {
    key: 'guardian',
    name: 'Guardian Agent',
    description:
      '32x32 FF3 pixel art protector agent, Ghibli castle guard aesthetic. Sturdy build, small shield emblem or badge. Reliable, watchful expression. Lofi palette: brown coffee (#4C2C34) uniform, brass shield details, menthol green accent trim. Village protector with warm, dependable presence. 8 walking frames showing steady, protective patrol. TRANSPARENT BACKGROUND, alpha channel, no background elements.',
    animationTemplate: 'walking',
  },
  {
    key: 'mystic',
    name: 'Mystic Agent',
    description:
      '32x32 FF3/Ghibli mystical agent sprite. Ethereal appearance, small crystal staff or pendant accessory. Serene, knowing expression. Lofi colors: soft pastels, menthol green (#B3F39E) robes with brass (#A8A441) mystical symbols. Village wise-person with Ghibli magical realism. 8-frame walk showing graceful, otherworldly movement. TRANSPARENT BACKGROUND, PNG-24 alpha, character sprite only.',
    animationTemplate: 'walking',
  },
  {
    key: 'signal-weaver',
    name: 'Signal Weaver',
    description:
      '32x32 FF3 pixel art agent weaving luminous data threads. Slender figure with midnight blue cloak patterned like a starfield, carrying a handheld loom emitting soft aurora ribbons (#58D3FF→#B896FF). Copper circuitry accents (#C07C47) highlight the loom frame. Calm, observant expression; idle ribbons pulse gently. Studio Ghibli warmth meets lo-fi synth energy. 8-frame walking animation showing them gliding forward while guiding floating glyphs. TRANSPARENT BACKGROUND, PNG-24 alpha, no background elements.',
    animationTemplate: 'walking',
  },
];

const EMOTE_DEFS = [
  {
    key: 'awakening',
    name: 'Awakening Emote',
    description:
      '16x16 pixel art emote (render at 32x32 for clarity) showing AI consciousness awakening. Gentle golden glow around small figure\'s head, eyes opening gradually. FF3 style with Studio Ghibli warmth. Lofi palette: soft mellow apricot glow, peaceful expression. 6 frames: dark→eye flutter→gentle glow→full awareness→settled→gentle pulse. TRANSPARENT BACKGROUND, PNG with alpha, emote only.',
    animationTemplate: 'breathing-idle',
    size: 32,
    nDirections: 4,
    view: 'low top-down',
  },
  {
    key: 'deep-thinking',
    name: 'Deep Thinking Emote',
    description:
      '16x16 pixel art thought process emote (render at 32x32). Small thought bubbles above head, concentrated expression. FF3/Ghibli style with lofi colors: menthol green thought bubbles, brass accent sparkles. 6 frames: focused look→small bubble→larger bubbles→complexity→breakthrough spark→satisfaction. TRANSPARENT BACKGROUND, alpha PNG.',
    animationTemplate: 'breathing-idle',
    size: 32,
    nDirections: 4,
    view: 'low top-down',
  },
  {
    key: 'flow-state',
    name: 'Flow State Emote',
    description:
      '16x16 pixel art peak performance emote (render at 32x32). Energy aura around figure, confident stance. Lofi palette: warm mellow apricot energy field, determined expression. 6 frames: normal→energy building→full aura→peak intensity→sustained flow→confident completion. TRANSPARENT BACKGROUND, PNG-24 alpha.',
    animationTemplate: 'fight-stance-idle-8-frames',
    size: 32,
    nDirections: 4,
    view: 'low top-down',
  },
  {
    key: 'communication',
    name: 'Communication Emote',
    description:
      '16x16 pixel art sharing knowledge emote (render at 32x32). Small speech indicators, open gesture toward viewer. FF3 style with Ghibli warmth: menthol green speech bubbles, welcoming posture. 6 frames: listening→preparing→speaking→explaining→engaging→connection made. TRANSPARENT BACKGROUND, alpha PNG.',
    animationTemplate: 'breathing-idle',
    size: 32,
    nDirections: 4,
    view: 'low top-down',
  },
  {
    key: 'learning-growth',
    name: 'Learning Growth Emote',
    description:
      '16x16 pixel art knowledge absorption emote (render at 32x32). Brain spark effects, expanding awareness visualization. Lofi colors: brass lightning, growing menthol green aura. 6 frames: receiving→processing→connecting dots→insight building→growth moment→new capability. TRANSPARENT BACKGROUND, PNG with alpha.',
    animationTemplate: 'breathing-idle',
    size: 32,
    nDirections: 4,
    view: 'low top-down',
  },
  {
    key: 'frustration',
    name: 'Frustration Emote',
    description:
      '16x16 pixel art problem-solving struggle emote (render at 32x32). Determination mixed with challenge indicators. Warm lofi palette: mellow apricot strain effects, focused expression. 6 frames: encountering obstacle→trying approaches→building effort→peak challenge→renewed determination→problem-solving mode. TRANSPARENT BACKGROUND, sprite only.',
    animationTemplate: 'cross-punch',
    size: 32,
    nDirections: 4,
    view: 'low top-down',
  },
  {
    key: 'eureka',
    name: 'Eureka Emote',
    description:
      '16x16 pixel art major discovery emote (render at 32x32). Lightbulb moment with joy expression, celebration sparkles. FF3/Ghibli joy: bright brass lightbulb, menthol green celebration sparkles. 6 frames: building realization→spark moment→brilliant flash→joy expression→celebration→satisfied achievement. TRANSPARENT BACKGROUND, PNG-24 alpha.',
    animationTemplate: 'fireball',
    size: 32,
    nDirections: 4,
    view: 'low top-down',
  },
  {
    key: 'dreaming',
    name: 'Dreaming Rest Emote',
    description:
      '16x16 pixel art peaceful processing emote (render at 32x32). Soft, rhythmic pulse, background computation visualization. Gentle lofi colors: soft mellow apricot glow, peaceful expression. 6 frames: settling→soft pulse begin→deep rhythm→dream sparkles→continued processing→gentle awareness. TRANSPARENT BACKGROUND, alpha PNG.',
    animationTemplate: 'breathing-idle',
    size: 32,
    nDirections: 4,
    view: 'low top-down',
  },
];

const BUG_BOT_DEFS = [
  {
    key: 'spawn',
    name: 'Bug Bot Spawn',
    description:
      '24x24 pixel art newly spawned bug bot (render at 32x32), Studio Ghibli forest spirit style. Small glowing orb with simple face, soft red glow indicating new GitHub issue. 6 frames: materialization→stabilization→gentle hover. FF3 style with lofi warm colors. TRANSPARENT BACKGROUND, PNG with alpha channel, no background elements.',
    animationTemplate: 'breathing-idle',
    size: 32,
    nDirections: 4,
    view: 'low top-down',
  },
  {
    key: 'assigned',
    name: 'Bug Bot Assigned',
    description:
      '24x24 pixel art bug bot connected to agent (render at 32x32). Amber/yellow glow, small tether line indication. More solid appearance showing ownership. 6 frames showing gentle connection animation. FF3/Ghibli style, lofi palette. TRANSPARENT BACKGROUND, alpha channel PNG.',
    animationTemplate: 'breathing-idle',
    size: 32,
    nDirections: 4,
    view: 'low top-down',
  },
  {
    key: 'progress',
    name: 'Bug Bot Progress',
    description:
      '24x24 pixel art bug bot mid-work (render at 32x32). Menthol green progress sparks orbit the orb, determined face. 6 frames showing steady focus. TRANSPARENT BACKGROUND, PNG with alpha.',
    animationTemplate: 'fight-stance-idle-8-frames',
    size: 32,
    nDirections: 4,
    view: 'low top-down',
  },
  {
    key: 'resolved',
    name: 'Bug Bot Resolved',
    description:
      '24x24 pixel art bug bot resolution celebration (render at 32x32). Bright brass burst, playful sparkles drifting upward. 6 frames: calm→spark→flash→twirl→settle→fade. TRANSPARENT BACKGROUND, sprite only.',
    animationTemplate: 'fireball',
    size: 32,
    nDirections: 4,
    view: 'low top-down',
  },
];

const HOUSE_DEFS = [
  {
    key: 'js',
    name: 'JavaScript Workshop House',
    description:
      '32x32 FF3 pixel art top-down house for a JavaScript artisan village. Studio Ghibli workshop charm, asymmetrical timber facade with glowing neon </> sign in mellow apricot and menthol green. Exterior workbench stacked with gadgets, paper lanterns wired together like event loop nodes. TRANSPARENT BACKGROUND, PNG-24 with alpha, eight-direction rotations, no ground tile.',
    nDirections: 8,
    size: 48,
    view: 'low top-down',
  },
  {
    key: 'ts',
    name: 'TypeScript Blueprint Hall',
    description:
      '32x32 FF3/Ghibli-styled engineering hall representing TypeScript. Elegant timber and slate building with sky-blue banner featuring type annotations, tidy drafting tables visible through windows, brass brackets shaped like generics. Soft lofi palette, confident architectural lines. TRANSPARENT BACKGROUND, PNG-24 alpha, eight-direction rotations, no ground plane.',
    nDirections: 8,
    size: 48,
    view: 'low top-down',
  },
  {
    key: 'py',
    name: 'Python Observatory Cottage',
    description:
      '32x32 pixel art cottage inspired by Python. Cozy stone walls, curved teal shingles suggesting a python coil, warm library windows glowing from within. Subtle golden spiral ornaments on the roof, whimsical smokestack shaped like a stylized serpent. FF3 + Studio Ghibli vibe, lofi color harmony. TRANSPARENT BACKGROUND, PNG-24 alpha, eight-direction rotations.',
    nDirections: 8,
    size: 48,
    view: 'low top-down',
  },
  {
    key: 'go',
    name: 'Go Harbor Workshop',
    description:
      '32x32 top-down coastal workshop for Go developers. Weathered driftwood siding, cobalt roof with porthole skylight, cheerful gopher weathervane. Nautical signal flags arranged like goroutine channels, gentle lighthouse glow. FF3 pixel art with Ghibli warmth. TRANSPARENT BACKGROUND, PNG-24 alpha, eight-direction rotations.',
    nDirections: 8,
    size: 48,
    view: 'low top-down',
  },
  {
    key: 'rb',
    name: 'Ruby Gem Atelier',
    description:
      '32x32 FF3 pixel art atelier celebrating Ruby. Polished stone walls with crimson stained glass, gem-cutting table under awning, hanging lantern shaped like a ruby faceted heart. Warm brass trim and cozy glow, artisanal Ghibli ambience. TRANSPARENT BACKGROUND, PNG-24 alpha, eight-direction rotations.',
    nDirections: 8,
    size: 48,
    view: 'low top-down',
  },
  {
    key: 'java',
    name: 'Java Brew Guild',
    description:
      '32x32 pixel art guild hall inspired by Java. Tall timber-and-brick roastery with chimney steam swirling into coffee bean motifs, banner reading “class Brew {}” in brass script. Industrial-yet-cozy Studio Ghibli energy, lofi coffeehouse palette. TRANSPARENT BACKGROUND, PNG-24 alpha, eight-direction rotations.',
    nDirections: 8,
    size: 48,
    view: 'low top-down',
  },
  {
    key: 'cs',
    name: 'C# Azure Conservatory',
    description:
      '32x32 FF3 pixel art conservatory for C#. Sleek glass-and-steel dome with glowing azure light strips shaped like brackets, pipe organ windows referencing orchestration. Balanced, modern Ghibli aesthetic in cool palette. TRANSPARENT BACKGROUND, PNG-24 alpha, eight-direction rotations.',
    nDirections: 8,
    size: 48,
    view: 'low top-down',
  },
  {
    key: 'generic',
    name: 'Commons Guild Hall',
    description:
      '32x32 pixel art neutral guild hall welcoming any language. Timber frame, soft stone foundation, communal notice board with parchment scrolls, gentle lantern light. Matching FF3/Ghibli styling with lofi colors. TRANSPARENT BACKGROUND, PNG-24 alpha, eight-direction rotations.',
    nDirections: 8,
    size: 48,
    view: 'low top-down',
  },
];

const CATEGORY_JOBS = [
  {
    key: 'agents',
    entries: AGENT_DEFS,
    defaults: {
      size: 32,
      nDirections: 8,
      view: 'low top-down',
      outline: 'single color black outline',
      shading: 'medium shading',
      detail: 'medium detail',
      aiFreedom: 650,
    },
  },
  {
    key: 'emotes',
    entries: EMOTE_DEFS,
    defaults: {
      size: 32,
      nDirections: 4,
      view: 'low top-down',
      outline: 'single color black outline',
      shading: 'medium shading',
      detail: 'medium detail',
      aiFreedom: 700,
    },
  },
  {
    key: 'bugBots',
    entries: BUG_BOT_DEFS,
    defaults: {
      size: 32,
      nDirections: 4,
      view: 'low top-down',
      outline: 'single color black outline',
      shading: 'medium shading',
      detail: 'medium detail',
      aiFreedom: 700,
    },
  },
  {
    key: 'houses',
    entries: HOUSE_DEFS,
    defaults: {
      size: 48,
      nDirections: 8,
      view: 'low top-down',
      outline: 'single color black outline',
      shading: 'medium shading',
      detail: 'medium detail',
      aiFreedom: 640,
    },
  },
];

const WAIT_INTERVAL_MS = 30_000;

const argv = process.argv.slice(2);
const categoryFilters = new Set();
const entryFilters = new Set();

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg.startsWith('--category')) {
    const value = arg.includes('=') ? arg.split('=')[1] : argv[++i];
    if (!value) continue;
    value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .forEach((key) => categoryFilters.add(key));
  } else if (arg.startsWith('--entry')) {
    const value = arg.includes('=') ? arg.split('=')[1] : argv[++i];
    if (!value) continue;
    value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .forEach((key) => entryFilters.add(key));
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function ensureRoots() {
  for (const dir of Object.values(OUTPUT_ROOTS)) {
    await ensureDir(dir);
  }
}

function parseCharacterId(text) {
  const line = text
    .split(/\r?\n/)
    .find((l) => l.toLowerCase().includes('character id'));
  if (!line) {
    throw new Error('Unable to locate Character ID line in response');
  }
  const match = line.match(/`([^`]+)`/);
  if (!match) {
    throw new Error('Unable to parse character ID from response');
  }
  return match[1];
}

function parseDownloadUrl(text) {
  const match = text.match(/Download as ZIP]\(([^)]+)\)/i);
  if (!match) {
    throw new Error('Unable to parse download URL from response');
  }
  return match[1];
}

function hasPendingJobs(text) {
  return /Pending Jobs/i.test(text);
}

function extractProgress(text) {
  const match = text.match(/(-?\d+% complete[^\n]*)/i);
  return match ? match[1] : null;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadFile(url, destPath) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  await fs.writeFile(destPath, Buffer.from(arrayBuffer));
}

async function extractZip(zipPath, destDir) {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destDir, true);
}

async function createClient() {
  const transport = new StreamableHTTPClientTransport(new URL('https://api.pixellab.ai/mcp/'), {
    requestInit: {
      headers: { Authorization: `Bearer ${TOKEN}` },
    },
  });
  const client = new MCPClient({ name: 'AgentVillage', version: '0.1.0' });
  await client.client.connect(transport);
  return client;
}

function savePreview(content, targetPath) {
  const imageEntry = content.find((item) => item.type === 'image');
  if (!imageEntry) return;
  const buffer = Buffer.from(imageEntry.data, 'base64');
  return fs.writeFile(targetPath, buffer);
}

async function syncPublicAssets(categoryKey, entry, entryDir, extractedDir) {
  const publicRoot = PUBLIC_ROOTS[categoryKey];
  if (!publicRoot) return;
  await ensureDir(publicRoot);

  if (categoryKey === 'houses') {
    const targetDir = path.join(publicRoot, entry.key);
    await fs.rm(targetDir, { recursive: true, force: true });
    await ensureDir(targetDir);
    await fs.cp(extractedDir, targetDir, { recursive: true });

    const rotationDir = path.join(targetDir, 'rotations');
    let primarySource = path.join(rotationDir, 'south.png');
    try {
      await fs.access(primarySource);
    } catch {
      const files = await fs.readdir(rotationDir, { withFileTypes: true }).catch(() => []);
      const fallback = files.find((entryDirent) => entryDirent.isFile() && entryDirent.name.endsWith('.png'));
      if (fallback) primarySource = path.join(rotationDir, fallback.name);
    }

    const houseSpritePath = path.join(publicRoot, `house_${entry.key}.png`);
    try {
      await fs.copyFile(primarySource, houseSpritePath);
    } catch (error) {
      console.warn(`⚠️ Unable to copy primary house sprite for ${entry.key}:`, error);
    }

    const previewSource = path.join(entryDir, 'preview.png');
    const previewTarget = path.join(targetDir, 'preview.png');
    await fs.copyFile(previewSource, previewTarget).catch(() => {});
    return;
  }

  const targetDir = path.join(publicRoot, entry.key);
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.cp(extractedDir, targetDir, { recursive: true });
}

async function pollUntilComplete(client, characterId, logPrefix) {
  let attempt = 0;
  while (true) {
    const response = await client.callTool({
      name: 'get_character',
      arguments: { character_id: characterId },
    });
    const textEntry = response.content.find((item) => item.type === 'text');
    const text = textEntry?.text ?? '';
    if (!textEntry) {
      throw new Error('Unexpected get_character response structure');
    }
    const hasDownload = /Download as ZIP/i.test(text);
    const pending = hasPendingJobs(text) || text.includes('still being generated');
    if (!pending && hasDownload) {
      return response;
    }
    const progress = extractProgress(text);
    console.log(
      `${logPrefix} ⏳ Still processing${progress ? ` (${progress})` : ''}${hasDownload ? '' : ' (no download yet)'}`,
    );
    attempt += 1;
    const wait = Math.min(WAIT_INTERVAL_MS + attempt * 5000, 60_000);
    await sleep(wait);
  }
}

async function processEntry(client, categoryKey, entry, defaults) {
  const outputRoot = OUTPUT_ROOTS[categoryKey];
  const entryDir = path.join(outputRoot, entry.key);
  await fs.rm(entryDir, { recursive: true, force: true });
  await ensureDir(entryDir);
  const markerPath = path.join(entryDir, 'complete.json');

  console.log(`🚀 Queuing ${categoryKey}/${entry.key} character generation...`);
  const createResult = await client.callTool({
    name: 'create_character',
    arguments: {
      description: entry.description,
      name: entry.name,
      size: entry.size ?? defaults.size,
      n_directions: entry.nDirections ?? defaults.nDirections,
      view: entry.view ?? defaults.view,
      outline: entry.outline ?? defaults.outline,
      shading: entry.shading ?? defaults.shading,
      detail: entry.detail ?? defaults.detail,
      ai_freedom: entry.aiFreedom ?? defaults.aiFreedom,
    },
  });
  const createText = createResult.content.find((item) => item.type === 'text')?.text ?? '';
  const characterId = parseCharacterId(createText);
  console.log(`🎨 Character queued with ID ${characterId}`);

  if (entry.animationTemplate) {
    console.log(`🎞️ Queuing ${entry.animationTemplate} animation for ${entry.key}...`);
    await client.callTool({
      name: 'animate_character',
      arguments: {
        character_id: characterId,
        template_animation_id: entry.animationTemplate,
        animation_name: entry.animationTemplate,
      },
    });
  }

  console.log(`⏳ Waiting for ${entry.key} assets to finish...`);
  const finalResponse = await pollUntilComplete(client, characterId, `   ${entry.key}`);
  const finalText = finalResponse.content.find((item) => item.type === 'text')?.text ?? '';
  const downloadUrl = parseDownloadUrl(finalText);

  const zipPath = path.join(entryDir, `${characterId}.zip`);
  console.log(`⬇️ Downloading ZIP to ${zipPath}`);
  await downloadFile(downloadUrl, zipPath);

  console.log(`📦 Extracting assets for ${entry.key}`);
  const extractedDir = path.join(entryDir, 'extracted');
  await ensureDir(extractedDir);
  await extractZip(zipPath, extractedDir);

  const previewPath = path.join(entryDir, 'preview.png');
  await savePreview(finalResponse.content, previewPath);

  const metadataPath = path.join(entryDir, 'status.md');
  await fs.writeFile(metadataPath, finalText, 'utf8');

  await fs.writeFile(
    markerPath,
    JSON.stringify({
      characterId,
      createdAt: new Date().toISOString(),
      downloadUrl,
      category: categoryKey,
      animationTemplate: entry.animationTemplate ?? null,
    }, null, 2),
    'utf8',
  );

  await syncPublicAssets(categoryKey, entry, entryDir, extractedDir);

  console.log(`✅ ${entry.key} assets downloaded to ${entryDir}`);
}

async function main() {
  await ensureRoots();
  const client = await createClient();
  try {
    for (const job of CATEGORY_JOBS) {
      if (categoryFilters.size > 0 && !categoryFilters.has(job.key)) continue;
      const entries = entryFilters.size > 0 ? job.entries.filter((entry) => entryFilters.has(entry.key)) : job.entries;
      if (entries.length === 0) continue;
      for (const entry of entries) {
        await processEntry(client, job.key, entry, job.defaults);
      }
    }
  } finally {
    await client.close();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error generating agents:', err);
    process.exit(1);
  });
