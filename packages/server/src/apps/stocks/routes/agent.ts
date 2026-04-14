import { Router } from 'express';
import type { Request, Response } from 'express';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions.js';
import { listTools, callTool } from '../lib/mcpClient.js';

const router = Router();

const SYSTEM_PROMPT = `You are a financial research assistant embedded in a personal stock-tracking app. You have access to Alpha Vantage tools for real-time market data, company fundamentals, technical indicators, and news sentiment.

Guidelines:
- Be concise and data-driven. Lead with numbers.
- Format currency values with $ and commas. Format percentages with %.
- When comparing stocks, use structured comparisons.
- If a tool call fails, explain what happened and suggest alternatives.
- Do not fabricate data. Only present data returned by tools.
- When asked about a stock, default to providing the current price and key metrics unless asked for something specific.`;

const MAX_TOOL_ROUNDS = 10;

function getOpenAIClient(): OpenAI {
  const token = process.env.GITHUB_MODELS_TOKEN;
  if (!token) {
    throw new Error('GITHUB_MODELS_TOKEN is not configured');
  }
  const baseURL = process.env.AGENT_BASE_URL || 'https://models.github.ai/inference';
  return new OpenAI({ apiKey: token, baseURL });
}

function mcpToolsToOpenAI(
  mcpTools: Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }>
): ChatCompletionTool[] {
  return mcpTools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description || '',
      parameters: t.inputSchema,
    },
  }));
}

router.post('/chat', async (req: Request, res: Response) => {
  // --- validate ---
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  // --- check config ---
  if (!process.env.GITHUB_MODELS_TOKEN) {
    res.status(503).json({ error: 'Agent is not configured. Set GITHUB_MODELS_TOKEN in your .env file.' });
    return;
  }

  // --- SSE headers ---
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const openai = getOpenAIClient();
    const model = process.env.AGENT_MODEL || 'openai/gpt-4o-mini';

    // Load MCP tools
    let tools: ChatCompletionTool[] = [];
    try {
      const mcpTools = await listTools();
      tools = mcpToolsToOpenAI(mcpTools);
      send('status', { type: 'tools_loaded', count: tools.length });
    } catch (err) {
      console.error('[Agent] Failed to load MCP tools:', err);
      send('status', { type: 'tools_error', message: 'Could not connect to Alpha Vantage MCP server. Proceeding without tools.' });
    }

    // Build conversation
    const conversation: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // --- tool-call loop ---
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await openai.chat.completions.create({
        model,
        messages: conversation,
        tools: tools.length > 0 ? tools : undefined,
        stream: false,
      });

      const choice = response.choices[0];
      if (!choice) break;

      const msg = choice.message;

      // If there are tool calls, execute them
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        conversation.push(msg);

        for (const tc of msg.tool_calls) {
          if (tc.type !== 'function') continue;
          const toolName = tc.function.name;
          let toolArgs: Record<string, unknown> = {};
          try {
            toolArgs = JSON.parse(tc.function.arguments);
          } catch {
            // keep empty args
          }

          send('status', { type: 'tool_call', tool: toolName, args: toolArgs });

          let toolResult: string;
          try {
            toolResult = await callTool(toolName, toolArgs);
          } catch (err) {
            toolResult = `Error calling ${toolName}: ${err instanceof Error ? err.message : String(err)}`;
          }

          conversation.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: toolResult,
          });
        }
        // Continue the loop to let LLM process tool results
        continue;
      }

      // No tool calls — stream the final text response
      if (msg.content) {
        // Re-call with streaming for the final answer
        const stream = await openai.chat.completions.create({
          model,
          messages: conversation,
          stream: true,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            send('token', { content: delta });
          }
        }
      }

      break; // Done
    }

    send('done', {});
  } catch (err) {
    console.error('[Agent] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('401') || message.includes('Unauthorized')) {
      send('error', { message: 'Authentication failed. Check your GITHUB_MODELS_TOKEN.' });
    } else if (message.includes('429') || message.includes('rate limit')) {
      send('error', { message: 'Rate limit reached. Please wait a moment and try again.' });
    } else {
      send('error', { message });
    }
    send('done', {});
  } finally {
    res.end();
  }
});

export default router;
