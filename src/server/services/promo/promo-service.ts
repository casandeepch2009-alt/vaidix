// ════════════════════════════════════════════════════════════════════════════
// AI Promo Generator — Stream A9
// ════════════════════════════════════════════════════════════════════════════
// Faculty triggers /api/promo/generate?sessionId=... → service renders three
// SVG templates (flyer, whatsapp_banner, instagram_card) populated with
// session metadata + Gemini-generated copy (subtitle + hook line). Each asset
// is stored in MinIO + a Document row is created with route=PROMO_ASSET so it
// surfaces in the faculty document library.
//
// Copy generation: Gemini-2.5-flash with a marketing-meets-clinical persona.
// Falls back to a deterministic heuristic when GEMINI_API_KEY is absent or
// Gemini fails. SVG output is browser-renderable and downloadable; PNG
// conversion via Chromium is a follow-up (puppeteer-core in roadmap).

import { db } from '@/lib/db';
import { Role, DocumentKind, DocumentRoute, DocumentStatus } from '@prisma/client';
import { s3, BUCKET } from '@/lib/storage';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '@/lib/env';
import { geminiGenerate, GeminiUnavailableError, GeminiUnparseableError, tryParseJson } from '@/server/services/ai/gemini';

export type PromoTemplate = 'flyer' | 'whatsapp_banner' | 'instagram_card';

const TEMPLATE_DIMS: Record<PromoTemplate, { w: number; h: number }> = {
  flyer: { w: 1200, h: 1500 },
  whatsapp_banner: { w: 1080, h: 1920 },
  instagram_card: { w: 1080, h: 1080 },
};

/** Re-exports for the W6.8 teaser-video pipeline so it can reuse the
 * Gemini-with-heuristic-fallback copy builder + the SVG palette without
 * duplicating logic. Keep the implementations private to this file. */
export type { PromoCopy };
export { buildCopy, escapeXml, PALETTE };

export class PromoAccessError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID', message: string) {
    super(message);
  }
}

const FACULTY_LIKE: Role[] = [Role.FACULTY, Role.PROGRAM_DIRECTOR, Role.ADMIN];

interface PromoCopy {
  title: string;
  subtitle: string;
  hook: string;
  hostName: string;
  whenLine: string;
  source?: 'gemini' | 'heuristic';
}

const PROMO_SYSTEM_PROMPT = `You are a marketing writer for LV Prasad Eye Institute's clinical education program.
Output strict JSON only — no prose, no fences:
{
  "subtitle": string,  // 1 line, <= 90 chars, evocative but factual
  "hook": string       // 1 line, <= 70 chars, calls residents to attend; avoid hype words
}

Rules:
- Indian clinical context. No US-specific references.
- "subtitle" describes WHAT learners will gain (skill, framework, decision rule).
  Ground it in the actual session content provided (objectives, study material,
  pre-questions). Don't invent topics that aren't in the source data.
- "hook" is short, in active voice, professional gravitas — not "Don't miss out!" cheese.
  If pre-questions are present, the hook MAY echo the most-asked theme directly.
- Don't put quotes inside the strings.`;

async function geminiPromoCopy(input: {
  title: string;
  description: string | null;
  hostName: string;
  scheduledStart: Date;
  objectives?: Array<{ text: string; blooms: number }>;
  studyMaterial?: Array<{ kind: string; title: string }>;
  topPreQuestions?: Array<{ content: string; voteCount: number }>;
  tags?: string[];
}): Promise<{ subtitle: string; hook: string }> {
  const objectivesBlock = input.objectives && input.objectives.length > 0
    ? `\n\nLearning objectives (the curator's stated goals — Bloom's level in brackets):\n${input.objectives
        .map((o, i) => `${i + 1}. ${o.text} [Bloom ${o.blooms}]`)
        .join('\n')}`
    : '';

  const studyBlock = input.studyMaterial && input.studyMaterial.length > 0
    ? `\n\nPre-session study material residents are expected to review:\n${input.studyMaterial
        .map((m, i) => `${i + 1}. (${m.kind}) ${m.title}`)
        .join('\n')}`
    : '';

  const questionsBlock = input.topPreQuestions && input.topPreQuestions.length > 0
    ? `\n\nTop pre-class questions from residents (votes in brackets — strongest signal of demand):\n${input.topPreQuestions
        .map((q, i) => `${i + 1}. ${q.content} [${q.voteCount} votes]`)
        .join('\n')}`
    : '';

  const tagsLine = input.tags && input.tags.length > 0
    ? `\nSub-specialty tags: ${input.tags.join(', ')}`
    : '';

  const userPrompt = `Session title: ${input.title}
Host: ${input.hostName}
When: ${input.scheduledStart.toISOString()}${tagsLine}
Description: ${input.description ?? '(none provided)'}${objectivesBlock}${studyBlock}${questionsBlock}

Return JSON only.`;
  const text = await geminiGenerate({
    systemInstruction: PROMO_SYSTEM_PROMPT,
    userParts: [{ text: userPrompt }],
    responseMimeType: 'application/json',
    temperature: 0.6,
  });
  const parsed = tryParseJson<{ subtitle?: string; hook?: string }>(text);
  return {
    subtitle: typeof parsed.subtitle === 'string' && parsed.subtitle.length > 0
      ? parsed.subtitle.slice(0, 120)
      : 'Live clinical learning session',
    hook: typeof parsed.hook === 'string' && parsed.hook.length > 0
      ? parsed.hook.slice(0, 90)
      : 'Hands-on. Case-based. Real outcomes.',
  };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Heuristic fallback when Gemini is absent or fails. Even without an LLM we
 *  prefer real session signals over canned strings: the first objective makes
 *  a stronger subtitle than "Live clinical learning session", and the
 *  top-voted resident pre-question makes a real hook. */
function heuristicCopy(input: {
  title: string;
  description: string | null;
  hostName: string;
  scheduledStart: Date;
  objectives?: Array<{ text: string; blooms: number }>;
  topPreQuestions?: Array<{ content: string; voteCount: number }>;
}): PromoCopy {
  const dateLine = input.scheduledStart.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const timeLine = input.scheduledStart.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const firstObj = input.objectives?.[0]?.text;
  const subtitle =
    firstObj?.slice(0, 90).trim() ||
    input.description?.split(/[.!?]/)[0]?.slice(0, 90).trim() ||
    'Live clinical learning session';

  const topQ = input.topPreQuestions?.[0]?.content;
  const hook = topQ
    ? topQ.slice(0, 70).trim().replace(/[.?!]+$/, '') + '?'
    : 'Hands-on. Case-based. Real outcomes.';

  return {
    title: input.title,
    subtitle,
    hook,
    hostName: input.hostName,
    whenLine: `${dateLine} · ${timeLine}`,
    source: 'heuristic',
  };
}

/** Compose the full PromoCopy by calling Gemini for subtitle+hook and
 * structurally building hostName/whenLine from session metadata. */
async function buildCopy(input: {
  title: string;
  description: string | null;
  hostName: string;
  scheduledStart: Date;
  objectives?: Array<{ text: string; blooms: number }>;
  studyMaterial?: Array<{ kind: string; title: string }>;
  topPreQuestions?: Array<{ content: string; voteCount: number }>;
  tags?: string[];
}): Promise<PromoCopy> {
  const baseHeuristic = heuristicCopy(input);
  if (!env.GEMINI_API_KEY) return baseHeuristic;
  try {
    const aiCopy = await geminiPromoCopy(input);
    return { ...baseHeuristic, subtitle: aiCopy.subtitle, hook: aiCopy.hook, source: 'gemini' };
  } catch (err) {
    if (err instanceof GeminiUnavailableError || err instanceof GeminiUnparseableError) {
      console.warn('[promo] gemini failed, falling back to heuristic:', (err as Error).message);
      return baseHeuristic;
    }
    throw err;
  }
}

const PALETTE = {
  bg: '#0b1727',
  accent: '#22d3ee',
  text: '#f8fafc',
  muted: '#94a3b8',
  highlight: '#fbbf24',
};

function renderSvg(template: PromoTemplate, copy: PromoCopy): string {
  const { w, h } = TEMPLATE_DIMS[template];
  const titleSize = template === 'flyer' ? 64 : template === 'whatsapp_banner' ? 56 : 56;
  const subtitleSize = 28;
  const padding = 80;

  // Word-wrap the title for SVG (very lightweight: split every ~22 chars at word boundary).
  function wrap(s: string, max: number): string[] {
    const words = s.split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (next.length > max) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = next;
      }
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 4);
  }
  const titleMaxChars = template === 'flyer' ? 22 : template === 'instagram_card' ? 18 : 20;
  const titleLines = wrap(copy.title, titleMaxChars);

  let titleTspans = '';
  titleLines.forEach((line, i) => {
    const dy = i === 0 ? 0 : titleSize + 8;
    titleTspans += `<tspan x="${padding}" dy="${dy}">${escapeXml(line)}</tspan>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PALETTE.bg}"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect x="${padding}" y="${padding}" width="120" height="6" fill="${PALETTE.accent}"/>
  <text x="${padding}" y="${padding + 60}" fill="${PALETTE.muted}" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="500" letter-spacing="3">VAIDIX · LVPEI</text>
  <text x="${padding}" y="${padding + 200}" fill="${PALETTE.text}" font-family="Inter, system-ui, sans-serif" font-size="${titleSize}" font-weight="700">
    ${titleTspans}
  </text>
  <text x="${padding}" y="${padding + 200 + titleLines.length * (titleSize + 8) + 40}" fill="${PALETTE.muted}" font-family="Inter, system-ui, sans-serif" font-size="${subtitleSize}">${escapeXml(copy.subtitle)}</text>

  <text x="${padding}" y="${h - 280}" fill="${PALETTE.highlight}" font-family="Inter, system-ui, sans-serif" font-size="${subtitleSize + 4}" font-style="italic">${escapeXml(copy.hook)}</text>
  <line x1="${padding}" y1="${h - 220}" x2="${padding + 200}" y2="${h - 220}" stroke="${PALETTE.accent}" stroke-width="3"/>

  <text x="${padding}" y="${h - 140}" fill="${PALETTE.text}" font-family="Inter, system-ui, sans-serif" font-size="32" font-weight="600">${escapeXml(copy.hostName)}</text>
  <text x="${padding}" y="${h - 90}" fill="${PALETTE.muted}" font-family="Inter, system-ui, sans-serif" font-size="26">${escapeXml(copy.whenLine)}</text>
</svg>`;
}

export interface GeneratePromoInput {
  sessionId: string;
  templates?: PromoTemplate[];
  actor: { userId: string; role: Role };
}

export interface GeneratePromoResult {
  documents: Array<{
    template: PromoTemplate;
    documentId: string;
    s3Key: string;
  }>;
}

export async function generatePromoAssets(input: GeneratePromoInput): Promise<GeneratePromoResult> {
  if (!FACULTY_LIKE.includes(input.actor.role)) {
    throw new PromoAccessError('FORBIDDEN', 'Only faculty/PD/admin can generate promo assets');
  }
  const session = await db.teachingSession.findUnique({
    where: { id: input.sessionId },
    select: {
      id: true,
      title: true,
      description: true,
      scheduledStart: true,
      host: { select: { name: true } },
    },
  });
  if (!session) throw new PromoAccessError('NOT_FOUND', 'Session not found');

  const templates = input.templates ?? (['flyer', 'whatsapp_banner', 'instagram_card'] as const);
  const copy = await buildCopy({
    title: session.title,
    description: session.description,
    hostName: session.host.name,
    scheduledStart: session.scheduledStart,
  });

  const out: GeneratePromoResult['documents'] = [];
  for (const tmpl of templates) {
    const svg = renderSvg(tmpl, copy);
    const buf = Buffer.from(svg, 'utf8');
    const key = `documents/raw/${input.actor.userId}/promo-${input.sessionId}-${tmpl}-${Date.now()}.svg`;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buf,
        ContentType: 'image/svg+xml',
      })
    );
    const doc = await db.document.create({
      data: {
        uploadedById: input.actor.userId,
        title: `${session.title} — ${tmpl.replace(/_/g, ' ')}`,
        description: `Auto-generated promo asset (${tmpl}) for session "${session.title}".`,
        kind: DocumentKind.IMAGE,
        route: DocumentRoute.PROMO_ASSET,
        s3Key: key,
        sizeBytes: BigInt(buf.byteLength),
        mimeType: 'image/svg+xml',
        status: DocumentStatus.PRIVATE_FACULTY,
        visibility: DocumentStatus.PRIVATE_FACULTY,
        sessionLinks: {
          create: { sessionId: input.sessionId, linkedById: input.actor.userId },
        },
      },
      select: { id: true, s3Key: true },
    });
    out.push({ template: tmpl, documentId: doc.id, s3Key: doc.s3Key });
  }
  return { documents: out };
}
