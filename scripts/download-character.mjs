#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { MCPClient } from 'mcp-client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const token = process.env.PIXELLAB_TOKEN || process.env.PIXELLAB_API_TOKEN;
if (!token) {
  console.error('PIXELLAB_TOKEN env var required');
  process.exit(1);
}

const characterId = process.argv[2];
const outDir = process.argv[3];
if (!characterId || !outDir) {
  console.error('Usage: node scripts/download-character.mjs <characterId> <outputDir>');
  process.exit(1);
}

const WAIT_MS = 30000;

function extractDownload(text) {
  const match = text.match(/Download as ZIP]\(([^)]+)\)/i);
  return match ? match[1] : null;
}

function hasPending(text) {
  return /Pending Jobs/i.test(text) || /still being generated/i.test(text);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function createClient() {
  const transport = new StreamableHTTPClientTransport(new URL('https://api.pixellab.ai/mcp/'), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  const client = new MCPClient({ name: 'AgentVillage', version: '0.1.0' });
  await client.client.connect(transport);
  return client;
}

async function pollAndDownload() {
  const client = await createClient();
  try {
    while (true) {
      const res = await client.callTool({
        name: 'get_character',
        arguments: { character_id: characterId },
      });
      const text = res.content.find((item) => item.type === 'text')?.text ?? '';
      const downloadUrl = extractDownload(text);
      const pending = hasPending(text);
      if (!pending && downloadUrl) {
        await fs.mkdir(outDir, { recursive: true });
        const zipPath = path.join(outDir, `${characterId}.zip`);
        const resp = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) throw new Error(`Failed download ${resp.status}`);
        const buf = Buffer.from(await resp.arrayBuffer());
        await fs.writeFile(zipPath, buf);
        console.log('Downloaded ZIP to', zipPath);
        return;
      }
      console.log('Pending; waiting...');
      await sleep(WAIT_MS);
    }
  } finally {
    await client.close();
  }
}

(async () => {
  try {
    await pollAndDownload();
    process.exit(0);
  } catch (error) {
    console.error('Failed to download character:', error);
    process.exit(1);
  }
})();
