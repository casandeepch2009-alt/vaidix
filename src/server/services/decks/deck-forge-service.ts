// ════════════════════════════════════════════════════════════════════════════
// Deck Forge Service — Phase A
// ════════════════════════════════════════════════════════════════════════════
// Turns a source (uploaded PDF/DOC/PPT/notes Document, or a recording's
// Transcript, or both) into a structured set of `Slide` rows hanging off a
// `DeckForgeJob`. Slides are first-class — editable, reorderable, the source
// of truth for both the in-app presenter and the .pptx export.
//
// Gemini is the AI provider in Phase A; Phase B swaps in Vaidix Core SLM
// behind the same interface. PDFs are sent as inline multimodal data so we
// don't need a separate PDF-parser dependency.

import { db } from '@/lib/db';
import { s3, BUCKET } from '@/lib/storage';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import {
  DeckForgeStatus,
  DeckForgeSource,
  SlideLayout,
  DocumentKind,
  type Prisma,
} from '@prisma/client';
import {
  geminiGenerate,
  GeminiUnavailableError,
  GeminiUnparseableError,
  tryParseJson,
} from '@/server/services/ai/gemini';
import { env } from '@/lib/env';

const SYSTEM_PROMPT = `You are an ophthalmology medical educator + instructional designer at LV Prasad Eye Institute.
You convert source teaching material into a clean, lecture-ready slide outline for a 60-minute live session.

OUTPUT — strict JSON, no prose, no markdown fences:
{
  "deckTitle": string,
  "slides": [
    {
      "layout": "TITLE_ONLY" | "TITLE_BULLETS" | "TWO_COLUMN" | "IMAGE_FOCUS" | "QUOTE" | "INTERACTION" | "CLOSING",
      "title": string,            // <= 90 chars
      "bullets": string[],        // 0-6 items, each <= 140 chars; empty for TITLE_ONLY/CLOSING
      "speakerNotes": string,     // 1-3 sentences for the presenter; <= 400 chars
      "citation": string | null   // short ref to where in source this came from (e.g. "Section 2", "Transcript 12:30-14:00")
    }
  ]
}

STRUCTURE RULES
- 14-22 slides total for a 1-hour lecture. Open with TITLE_ONLY hero, close with CLOSING.
- Bullets are crisp phrases, not full sentences. No trailing periods on bullets.
- CLOSING is "Thank you" or "Q&A". Title slides use the deck title.
- Order matters — slides render in array order.

PEDAGOGY RULES (VARK multimodal — ophthalmology residency)
- Tailor depth to the stated learner level. Interns/PGY-1 need anatomy-first, classification-heavy.
  Senior residents/fellows need decision-points, evidence, and edge cases.
- Include AT LEAST ONE IMAGE_FOCUS slide for visual learning (slit-lamp / fundus / OCT / FFA / ICGA /
  USG / surgical-step image placeholders). Title states what the image shows; bullet[0] is the caption
  / interpretation key.
- Include AT LEAST ONE INTERACTION slide every 6-8 slides (poll, T/F, key-feature question, clinical
  dilemma). Each option is a separate bullet, written as a discrete answer choice.
- Include AT LEAST ONE INTERACTION slide formatted as a competency-check question testing the most
  diagnostic discriminator for this topic (e.g. AAC vs PAC, NPDR severity, masquerade syndromes).
- Include EXACTLY ONE slide near the end titled "Common pitfalls" or "Learner errors" with 4-6 bullets
  capturing where residents most often go wrong on this topic.
- Speaker notes carry the *why* — the reasoning a presenter would say aloud. Bullets carry the *what*.

CONTENT RULES
- Anchor every clinical claim to the source. Never invent dosages, drug names, classification cutoffs,
  or procedural steps that aren't in the source. If the source is sparse, output fewer slides.
- Ophthalmology-specific vocabulary throughout — slit-lamp, fundoscopy, OCT, FFA, ICGA, ultrasonography,
  laser, wet-lab, microsurgery, slit-lamp findings, intraocular landmarks. No generic "the patient
  presents…" pablum.
- Where source mentions an imaging modality, prefer IMAGE_FOCUS for that slide.
- Where source mentions a classification system (e.g. ETDRS, Shaffer, Spaeth, AAO PPP), put the
  classification on a TWO_COLUMN slide so it scans cleanly.`;

interface RawSlide {
  layout?: string;
  title?: unknown;
  bullets?: unknown;
  speakerNotes?: unknown;
  citation?: unknown;
}

interface ForgeResult {
  deckTitle: string;
  slides: Array<{
    layout: SlideLayout;
    title: string;
    bullets: string[];
    speakerNotes: string;
    citation: string | null;
  }>;
}

const ALLOWED_LAYOUTS: SlideLayout[] = [
  'TITLE_ONLY',
  'TITLE_BULLETS',
  'TWO_COLUMN',
  'IMAGE_FOCUS',
  'QUOTE',
  'INTERACTION',
  'CLOSING',
];

function normalizeSlides(parsed: { deckTitle?: unknown; slides?: unknown }): ForgeResult {
  const deckTitle =
    typeof parsed.deckTitle === 'string' && parsed.deckTitle.trim()
      ? parsed.deckTitle.trim().slice(0, 120)
      : 'Untitled Deck';

  const raw: RawSlide[] = Array.isArray(parsed.slides) ? (parsed.slides as RawSlide[]) : [];
  const slides = raw
    .slice(0, 30) // hard ceiling — refuse decks that drift to filler
    .map((s) => {
      const layout = (
        ALLOWED_LAYOUTS.includes(s.layout as SlideLayout) ? s.layout : 'TITLE_BULLETS'
      ) as SlideLayout;
      const title = typeof s.title === 'string' ? s.title.slice(0, 200) : 'Untitled slide';
      const bullets = Array.isArray(s.bullets)
        ? (s.bullets as unknown[])
            .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
            .slice(0, 6)
            .map((b) => b.trim().slice(0, 200))
        : [];
      const speakerNotes =
        typeof s.speakerNotes === 'string' ? s.speakerNotes.slice(0, 1000) : '';
      const citation =
        typeof s.citation === 'string' && s.citation.trim() ? s.citation.trim().slice(0, 200) : null;
      return { layout, title, bullets, speakerNotes, citation };
    })
    .filter((s) => s.title.trim().length > 0);

  return { deckTitle, slides };
}

interface DocumentSource {
  kind: 'document';
  documentId: string;
  title: string;
  description: string | null;
  s3Key: string;
  mimeType: string;
  documentKind: DocumentKind;
  pageCount: number | null;
}

interface TranscriptSource {
  kind: 'transcript';
  recordingId: string;
  language: string;
  content: string;
  sessionTitle: string;
}

async function loadDocumentSource(documentId: string): Promise<DocumentSource | null> {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      title: true,
      description: true,
      s3Key: true,
      mimeType: true,
      kind: true,
      pageCount: true,
      deletedAt: true,
    },
  });
  if (!doc || doc.deletedAt) return null;
  return {
    kind: 'document',
    documentId: doc.id,
    title: doc.title,
    description: doc.description,
    s3Key: doc.s3Key,
    mimeType: doc.mimeType,
    documentKind: doc.kind,
    pageCount: doc.pageCount,
  };
}

async function loadTranscriptSource(recordingId: string): Promise<TranscriptSource | null> {
  const recording = await db.recording.findUnique({
    where: { id: recordingId },
    select: {
      id: true,
      session: { select: { title: true } },
      transcripts: {
        select: { language: true, content: true },
        // Prefer English; fall back to whichever language exists.
        orderBy: { language: 'asc' },
      },
    },
  });
  if (!recording) return null;
  const en = recording.transcripts.find((t) => t.language === 'en');
  const chosen = en ?? recording.transcripts[0];
  if (!chosen) return null;
  return {
    kind: 'transcript',
    recordingId: recording.id,
    language: chosen.language,
    content: chosen.content,
    sessionTitle: recording.session.title,
  };
}

async function fetchDocumentBytes(s3Key: string): Promise<{ data: string; mimeType: string }> {
  const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }));
  const stream = out.Body as ReadableStream<Uint8Array> | NodeJS.ReadableStream | undefined;
  if (!stream) throw new Error('Empty S3 body for document');
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  const buf = Buffer.concat(chunks);
  // Gemini multimodal limit is generous but we cap at 18 MB to stay safe.
  if (buf.byteLength > 18 * 1024 * 1024) {
    throw new Error(`Source too large for inline Gemini (${buf.byteLength} bytes)`);
  }
  return {
    data: buf.toString('base64'),
    mimeType: out.ContentType ?? 'application/octet-stream',
  };
}

const GEMINI_INLINE_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
]);

function canSendInline(mimeType: string): boolean {
  return GEMINI_INLINE_MIMES.has(mimeType);
}

export interface ForgeInput {
  documentId?: string | null;
  recordingId?: string | null;
  requestedById: string;
  inputTitle?: string;
  /** e.g. "PGY-1 resident", "senior resident", "vitreoretinal fellow". Defaults to "ophthalmology resident". */
  learnerLevel?: string;
}

export class DeckForgeError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export interface ForgeOutcome {
  jobId: string;
  deckTitle: string;
  slideCount: number;
}

/**
 * Orchestrates a forge: load source(s), call Gemini, persist Slide rows under
 * a new DeckForgeJob. Synchronous in Phase A — runs inside the request because
 * Gemini-text returns in seconds. Phase B will move to a BullMQ worker.
 */
export async function forgeDeck(input: ForgeInput): Promise<ForgeOutcome> {
  if (!input.documentId && !input.recordingId) {
    throw new DeckForgeError('NO_SOURCE', 'A documentId or recordingId is required');
  }
  if (!env.GEMINI_API_KEY) {
    throw new DeckForgeError('AI_UNAVAILABLE', 'GEMINI_API_KEY is not set');
  }

  const documentSource = input.documentId ? await loadDocumentSource(input.documentId) : null;
  const transcriptSource = input.recordingId ? await loadTranscriptSource(input.recordingId) : null;

  if (input.documentId && !documentSource) {
    throw new DeckForgeError('SOURCE_NOT_FOUND', 'Document not found or deleted');
  }
  if (input.recordingId && !transcriptSource) {
    throw new DeckForgeError('SOURCE_NOT_FOUND', 'Transcript not available for this recording');
  }

  const sourceKind: DeckForgeSource =
    documentSource && transcriptSource ? 'HYBRID' : transcriptSource ? 'TRANSCRIPT' : 'DOCUMENT';

  const job = await db.deckForgeJob.create({
    data: {
      documentId: documentSource?.documentId ?? null,
      recordingId: transcriptSource?.recordingId ?? null,
      sourceKind,
      requestedById: input.requestedById,
      status: DeckForgeStatus.EXTRACTING,
      inputTitle:
        input.inputTitle ?? documentSource?.title ?? transcriptSource?.sessionTitle ?? 'Forged Deck',
    },
    select: { id: true },
  });

  try {
    // Build the multimodal Gemini prompt.
    const userParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    const headerLines: string[] = [
      `Target learner: ${input.learnerLevel ?? 'ophthalmology resident at LVPEI'}`,
      `Target session length: 60 minutes`,
    ];
    if (documentSource) {
      headerLines.push(`Source title: ${documentSource.title}`);
      if (documentSource.description) headerLines.push(`Source description: ${documentSource.description}`);
      headerLines.push(`Source kind: ${documentSource.documentKind}`);
      if (documentSource.pageCount) headerLines.push(`Source pages: ${documentSource.pageCount}`);
    }
    if (transcriptSource) {
      headerLines.push(`Session: ${transcriptSource.sessionTitle}`);
      headerLines.push(`Transcript language: ${transcriptSource.language}`);
    }
    userParts.push({ text: headerLines.join('\n') });

    if (documentSource && canSendInline(documentSource.mimeType)) {
      await db.deckForgeJob.update({
        where: { id: job.id },
        data: { status: DeckForgeStatus.EXTRACTING },
      });
      const { data, mimeType } = await fetchDocumentBytes(documentSource.s3Key);
      userParts.push({ inlineData: { mimeType, data } });
    } else if (documentSource) {
      // PPT/DOC binaries are not natively read by Gemini inline — fall back to
      // metadata-only so we still produce a usable outline. Phase B: extract
      // text from PPT via python-pptx or unoconv worker.
      userParts.push({
        text: `[Note: source binary type ${documentSource.mimeType} cannot be inlined; outlining from title and description only.]`,
      });
    }

    if (transcriptSource) {
      // Cap transcript to keep token budget sane (~15k chars ≈ 1-hour lecture).
      const trimmed = transcriptSource.content.slice(0, 15000);
      userParts.push({
        text: `--- TRANSCRIPT START ---\n${trimmed}\n--- TRANSCRIPT END ---`,
      });
    }

    userParts.push({ text: 'Produce the slide outline JSON now.' });

    await db.deckForgeJob.update({
      where: { id: job.id },
      data: { status: DeckForgeStatus.GENERATING_SLIDES },
    });

    const raw = await geminiGenerate({
      systemInstruction: SYSTEM_PROMPT,
      userParts,
      responseMimeType: 'application/json',
      temperature: 0.35,
    });
    const parsed = tryParseJson<{ deckTitle?: unknown; slides?: unknown }>(raw);
    const result = normalizeSlides(parsed);

    if (result.slides.length === 0) {
      throw new DeckForgeError('EMPTY_DECK', 'AI returned no usable slides');
    }

    const slideRows: Prisma.SlideCreateManyInput[] = result.slides.map((s, i) => ({
      deckForgeJobId: job.id,
      order: i,
      layout: s.layout,
      title: s.title,
      bullets: s.bullets,
      speakerNotes: s.speakerNotes || null,
      sourceCitations: s.citation
        ? [
            {
              documentId: documentSource?.documentId ?? null,
              recordingId: transcriptSource?.recordingId ?? null,
              note: s.citation,
            },
          ]
        : undefined,
    }));

    await db.$transaction(async (tx) => {
      await tx.slide.createMany({ data: slideRows });
      await tx.deckForgeJob.update({
        where: { id: job.id },
        data: {
          status: DeckForgeStatus.REVIEW_PENDING,
          slideCount: result.slides.length,
          inputTitle: result.deckTitle,
        },
      });
    });

    return { jobId: job.id, deckTitle: result.deckTitle, slideCount: result.slides.length };
  } catch (err) {
    const message =
      err instanceof GeminiUnavailableError || err instanceof GeminiUnparseableError
        ? `AI provider error: ${err.message}`
        : err instanceof DeckForgeError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Forge failed';
    await db.deckForgeJob.update({
      where: { id: job.id },
      data: { status: DeckForgeStatus.FAILED, errorMessage: message.slice(0, 1000) },
    });
    throw err instanceof DeckForgeError ? err : new DeckForgeError('FORGE_FAILED', message);
  }
}
