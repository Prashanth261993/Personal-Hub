import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

let client: Client | null = null;
let transport: StdioClientTransport | null = null;
let toolsCache: Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }> | null = null;

async function ensureConnected(): Promise<Client> {
  if (client) return client;

  // Accept either the singular key or the first entry of the rotation pool.
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY
    ?? process.env.ALPHA_VANTAGE_API_KEYS?.split(',').map((k) => k.trim()).find(Boolean);
  if (!apiKey) {
    throw new Error('No Alpha Vantage API key set (ALPHA_VANTAGE_API_KEY or ALPHA_VANTAGE_API_KEYS) — cannot start MCP server');
  }

  transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', 'alpha-vantage-mcp-server@latest', 'start'],
    env: {
      ...process.env as Record<string, string>,
      ALPHA_VANTAGE_API_KEY: apiKey,
    },
  });

  client = new Client({ name: 'personal-hub-agent', version: '1.0.0' });
  await client.connect(transport);
  console.log('[MCP] Connected to Alpha Vantage MCP server');

  return client;
}

export async function listTools() {
  const c = await ensureConnected();
  if (toolsCache) return toolsCache;

  const result = await c.listTools();
  toolsCache = result.tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema as Record<string, unknown>,
  }));
  console.log(`[MCP] Loaded ${toolsCache.length} tools`);
  return toolsCache;
}

export async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  const c = await ensureConnected();
  const result = await c.callTool({ name, arguments: args });

  const textParts = (result.content as Array<{ type: string; text?: string }>)
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text!);

  return textParts.join('\n') || JSON.stringify(result.content);
}

export async function disconnect() {
  if (transport) {
    await transport.close();
    transport = null;
    client = null;
    toolsCache = null;
    console.log('[MCP] Disconnected');
  }
}
