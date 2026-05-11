// ════════════════════════════════════════════════════════════════════════════
// Claude server helper — multi-model (Opus + Sonnet) routing
// ════════════════════════════════════════════════════════════════════════════
// Thin wrapper over the Anthropic SDK. Callers pass `model` per call so the
// AI router (`./router.ts`) can route reasoning-heavy ops to Opus and
// structure/design ops to Sonnet without callers knowing the model IDs.
//
// Existing callers (post-session content, etc.) that don't pass `model` get
// `env.ANTHROPIC_MODEL` (Sonnet by default) — backwards compatible.

import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/lib/env';

export class ClaudeUnavailableError extends Error {}
export class ClaudeUnparseableError extends Error {}

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) throw new ClaudeUnavailableError('ANTHROPIC_API_KEY is not set');
  if (!_client) _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return _client;
}

interface GenerateInput {
  systemInstruction: string;
  userMessage: string;
  /** Specific Anthropic model id. Defaults to env.ANTHROPIC_MODEL. Use the router instead of hardcoding here. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function claudeGenerate(input: GenerateInput): Promise<string> {
  const client = getClient();
  const msg = await client.messages.create({
    model: input.model ?? env.ANTHROPIC_MODEL,
    max_tokens: input.maxTokens ?? 4096,
    system: input.systemInstruction,
    messages: [{ role: 'user', content: input.userMessage }],
    temperature: input.temperature ?? 0.3,
  });
  const block = msg.content[0];
  const text = block.type === 'text' ? block.text : '';
  if (!text) throw new ClaudeUnparseableError('Empty Claude response');
  return text;
}

export function tryParseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) {
      try {
        return JSON.parse(m[1].trim()) as T;
      } catch {
        /* fall through */
      }
    }
    throw new ClaudeUnparseableError(`Could not parse JSON from Claude output: ${text.slice(0, 200)}`);
  }
}
