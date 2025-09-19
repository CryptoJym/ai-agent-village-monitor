import { MCPClient } from 'mcp-client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const TOKEN = process.env.PIXELLAB_TOKEN;
if (!TOKEN) {
  console.error('PIXELLAB_TOKEN env var required');
  process.exit(1);
}

const url = new URL('https://api.pixellab.ai/mcp/');
const transport = new StreamableHTTPClientTransport(url, {
  requestInit: {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  },
});

async function main() {
  const client = new MCPClient({ name: 'AgentVillage', version: '0.1.0' });
  try {
    await client.client.connect(transport);
    const tools = await client.getAllTools();
    console.log('Tools:', tools.map((t) => t.name));
  } finally {
    await client.close();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to list tools:', error);
    process.exit(1);
  });
