// ════════════════════════════════════════════════════════════════════════════
// Pre-question clustering — W6
// ════════════════════════════════════════════════════════════════════════════
// Calls Gemini to cluster a session's submitted pre-questions into themes.
// Returns label + summary + assignments (questionId → themeIndex). Caller
// persists the result through pre-questions-service.applyClustering().
//
// Phase B will swap to Vaidix Core via the same shape — keep this module
// provider-agnostic at the seam.

import { geminiGenerate, tryParseJson, GeminiUnavailableError } from '@/server/services/ai/gemini';

export interface ClusterInputQuestion {
  id: string;
  content: string;
  voteCount: number;
}

export interface ClusterOutputTheme {
  /** Index-based id used by `assignments` to reference this theme. */
  themeIndex: number;
  label: string;
  summary: string;
}

export interface ClusterOutput {
  themes: ClusterOutputTheme[];
  /** Per-question assignment to a theme (or null if unclassifiable). */
  assignments: Array<{ questionId: string; themeIndex: number | null }>;
}

const SYSTEM_INSTRUCTION = [
  'You are an academic medical educator preparing a faculty member for a teaching session.',
  'You will receive a list of questions submitted by residents/fellows ahead of the session.',
  'Cluster the questions into the smallest set of themes that captures their concerns.',
  'A theme is a short clinical concept (≤6 words for label, ≤30 words for summary).',
  'Output STRICT JSON of shape: { "themes": [{label, summary}], "assignments": [{questionId, themeIndex}] }.',
  'themeIndex is the 0-based index into the themes array. Use null if a question does not fit any theme.',
  'Maximum 10 themes. Avoid overlap; merge near-duplicates. Prefer fewer, broader themes over many narrow ones.',
  'Do NOT include any prose, explanation, or markdown outside the JSON object.',
].join('\n');

interface RawCluster {
  themes?: Array<{ label?: string; summary?: string }>;
  assignments?: Array<{ questionId?: string; themeIndex?: number | null }>;
}

export async function clusterPreQuestions(
  questions: ClusterInputQuestion[]
): Promise<ClusterOutput> {
  if (questions.length === 0) return { themes: [], assignments: [] };

  // Compact prompt — only the fields the model needs.
  const userText = JSON.stringify(
    questions.map((q) => ({ id: q.id, content: q.content, votes: q.voteCount })),
    null,
    2
  );

  let raw: string;
  try {
    raw = await geminiGenerate({
      systemInstruction: SYSTEM_INSTRUCTION,
      userParts: [{ text: userText }],
      responseMimeType: 'application/json',
      temperature: 0.2,
    });
  } catch (err) {
    if (err instanceof GeminiUnavailableError) throw err;
    throw err;
  }

  const parsed = tryParseJson<RawCluster>(raw);
  const themes: ClusterOutputTheme[] = (parsed.themes ?? [])
    .slice(0, 10)
    .map((t, i) => ({
      themeIndex: i,
      label: (t.label ?? 'Untitled theme').trim().slice(0, 80) || 'Untitled theme',
      summary: (t.summary ?? '').trim().slice(0, 600),
    }));

  const themeCount = themes.length;
  const assignments = (parsed.assignments ?? [])
    .filter((a): a is { questionId: string; themeIndex: number | null } => typeof a.questionId === 'string')
    .map((a) => ({
      questionId: a.questionId,
      themeIndex:
        a.themeIndex == null || a.themeIndex < 0 || a.themeIndex >= themeCount
          ? null
          : a.themeIndex,
    }));

  return { themes, assignments };
}
