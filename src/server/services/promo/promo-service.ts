// ════════════════════════════════════════════════════════════════════════════
// AI Promo Generator — Stream A9
// ════════════════════════════════════════════════════════════════════════════
// Faculty triggers /api/promo/generate?sessionId=... → service renders three
// SVG templates (flyer, whatsapp_banner, instagram_card) populated with
// session metadata. Each is stored in MinIO + a Document row is created with
// route=PROMO_ASSET so it surfaces in the faculty document library.
//
// Phase A: copy is heuristic. Phase B: Gemini call enriches subtitle + hook.
// SVG output is browser-renderable and downloadable; PNG conversion via
// Chromium is a follow-up (puppeteer-core is in package.json roadmap).

import { db } from '@/lib/db';
import { Role, DocumentKind, DocumentRoute, DocumentStatus } from '@prisma/client';
import { s3, BUCKET } from '@/lib/storage';
import { PutObjectCommand } from '@aws-sdk/client-s3';

export type PromoTemplate = 'flyer' | 'whatsapp_banner' | 'instagram_card';

const TEMPLATE_DIMS: Record<PromoTemplate, { w: number; h: number }> = {
  flyer: { w: 1200, h: 1500 },
  whatsapp_banner: { w: 1080, h: 1920 },
  instagram_card: { w: 1080, h: 1080 },
};

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
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Phase A heuristic copy generator. Phase B: replace with Gemini call. */
function heuristicCopy(input: {
  title: string;
  description: string | null;
  hostName: string;
  scheduledStart: Date;
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
  const subtitle =
    input.description?.split(/[.!?]/)[0]?.slice(0, 90).trim() ||
    'Live clinical learning session';
  return {
    title: input.title,
    subtitle,
    hook: 'Hands-on. Case-based. Real outcomes.',
    hostName: input.hostName,
    whenLine: `${dateLine} · ${timeLine}`,
  };
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
  const copy = heuristicCopy({
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
