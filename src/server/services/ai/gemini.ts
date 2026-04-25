// ════════════════════════════════════════════════════════════════════════════
// Gemini server helper — Phase A AI provider
// ════════════════════════════════════════════════════════════════════════════
// Thin wrapper over the Gemini REST API that the rest of the codebase calls.
// Phase B will swap with Vaidix Core via the same `AIProvider` interface;
// callers should depend on this module by name only.

import { env } from '@/lib/env';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiUnavailableError extends Error {}
export class GeminiUnparseableError extends Error {}

interface GenerateInput {
  systemInstruction: string;
  /** Either plain text or a list of parts (for vision: text + inline images). */
  userParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
  responseMimeType?: 'application/json' | 'text/plain';
  temperature?: number;
}

export async function geminiGenerate(input: GenerateInput): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    throw new GeminiUnavailableError('GEMINI_API_KEY is not set');
  }
  const url = `${GEMINI_BASE}/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: input.systemInstruction }] },
      contents: [{ role: 'user', parts: input.userParts }],
      generationConfig: {
        temperature: input.temperature ?? 0.2,
        responseMimeType: input.responseMimeType ?? 'application/json',
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new GeminiUnavailableError(`Gemini ${res.status}: ${detail.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new GeminiUnparseableError('Empty Gemini response');
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
    throw new GeminiUnparseableError(`Could not parse JSON from Gemini output: ${text.slice(0, 200)}`);
  }
}
