// ════════════════════════════════════════════════════════════════════════════
// Wizard Forge Service — Phase 1A deck-forge redesign
// ════════════════════════════════════════════════════════════════════════════
// Two-step pipeline distinct from the legacy `forgeDeck()`:
//
//   1. EXTRACT (Gemini multimodal) — reads every attached Document and
//      returns a clean structured extraction (topics, claims, citations).
//   2. DRAFT  (Opus)               — reads the extraction + briefing +
//      faculty intent and authors the slide JSON, ALSO flags initial
//      enhancement suggestions in the same call.
//
// The wizard at /faculty/decks/new is the only caller. The legacy single-
// source forge (/api/decks/forge) keeps using forgeDeck() unchanged — the
// two flows coexist per the "two parallel intakes, one shared studio"
// architectural choice.

import { db } from '@/lib/db';
import { s3, BUCKET } from '@/lib/storage';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import {
  DeckForgeStatus,
  DeckForgeSource,
  DeckForgeIntent,
  DeckForgeInputRole,
  DocumentKind,
  SlideLayout,
  type Prisma,
} from '@prisma/client';
import {
  aiExtractFromSourceJson,
  aiEnhanceContentJson,
  AiUnavailableError,
  AiUnparseableError,
} from '@/server/services/ai/router';
import { getFacultyHistoryContext } from './faculty-analytics-history';

// ─── Public types ──────────────────────────────────────────────────────────

export interface WizardForgeBriefing {
  audience: string; // e.g. "PG-2 ophthalmology resident"
  sessionType: 'LECTURE' | 'CASE_CONFERENCE' | 'JOURNAL_CLUB' | 'TUTORIAL';
  durationMin: number; // 30 / 45 / 60 / 90
  objectives: string; // 1–3 sentences — what learners take away
  localContext?: string; // LVPEI patient mix, adherence, follow-up gaps, etc.
}

export interface WizardForgeInputDoc {
  documentId: string;
  role: DeckForgeInputRole;
}

export interface WizardForgeInput {
  intent: DeckForgeIntent;
  briefing: WizardForgeBriefing;
  inputs: WizardForgeInputDoc[];
  requestedById: string;
  inputTitle?: string;
}

export interface WizardForgeOutcome {
  jobId: string;
  deckTitle: string;
  slideCount: number;
}

export class WizardForgeError extends Error {
  constructor(
    public readonly code:
      | 'VALIDATION'
      | 'AI_UNAVAILABLE'
      | 'SOURCE_TOO_LARGE'
      | 'SOURCE_NOT_FOUND'
      | 'EMPTY_DECK'
      | 'FORGE_FAILED',
    message: string,
  ) {
    super(message);
  }
}

// ─── Input validation ──────────────────────────────────────────────────────

function validateInputShape(input: WizardForgeInput): void {
  if (!input.inputs.length) {
    throw new WizardForgeError('VALIDATION', 'At least one input document is required');
  }
  const primaryCount = input.inputs.filter((i) => i.role === 'PRIMARY_PPTX').length;
  if (input.intent === 'ENHANCE_EXISTING') {
    if (primaryCount !== 1) {
      throw new WizardForgeError(
        'VALIDATION',
        'Enhance-existing requires exactly one PRIMARY_PPTX input',
      );
    }
  } else {
    if (primaryCount > 0) {
      throw new WizardForgeError(
        'VALIDATION',
        'Draft-from-scratch does not accept a PRIMARY_PPTX input',
      );
    }
  }
  if (input.briefing.durationMin < 10 || input.briefing.durationMin > 240) {
    throw new WizardForgeError('VALIDATION', 'Duration must be between 10 and 240 minutes');
  }
  if (!input.briefing.objectives.trim()) {
    throw new WizardForgeError('VALIDATION', 'Briefing objectives are required');
  }
}

// ─── Source loaders ────────────────────────────────────────────────────────

interface LoadedDoc {
  documentId: string;
  title: string;
  description: string | null;
  kind: DocumentKind;
  mimeType: string;
  s3Key: string;
  pageCount: number | null;
  role: DeckForgeInputRole;
}

async function loadDocs(inputs: WizardForgeInputDoc[]): Promise<LoadedDoc[]> {
  const docs = await db.document.findMany({
    where: { id: { in: inputs.map((i) => i.documentId) }, deletedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      kind: true,
      mimeType: true,
      s3Key: true,
      pageCount: true,
    },
  });
  const byId = new Map(docs.map((d) => [d.id, d]));
  for (const i of inputs) {
    if (!byId.has(i.documentId)) {
      throw new WizardForgeError('SOURCE_NOT_FOUND', `Document ${i.documentId} not found`);
    }
  }
  return inputs.map((i) => {
    const d = byId.get(i.documentId)!;
    return {
      documentId: d.id,
      title: d.title,
      description: d.description,
      kind: d.kind,
      mimeType: d.mimeType,
      s3Key: d.s3Key,
      pageCount: d.pageCount,
      role: i.role,
    };
  });
}

const GEMINI_INLINE_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  // images for IMAGE-kind documents
  'image/png',
  'image/jpeg',
  'image/webp',
]);

// Aggregate inline-blob cap per forge job. Gemini's hard limit is much
// higher but we stay safe by capping the total at 20 MB.
const TOTAL_INLINE_CAP_BYTES = 20 * 1024 * 1024;

async function fetchInline(s3Key: string): Promise<{ data: string; mimeType: string; byteLength: number }> {
  const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }));
  const stream = out.Body as AsyncIterable<Uint8Array> | undefined;
  if (!stream) throw new WizardForgeError('SOURCE_NOT_FOUND', `Empty S3 body for ${s3Key}`);
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  const buf = Buffer.concat(chunks);
  return {
    data: buf.toString('base64'),
    mimeType: out.ContentType ?? 'application/octet-stream',
    byteLength: buf.byteLength,
  };
}

// ─── Extract step ──────────────────────────────────────────────────────────

const EXTRACT_SYSTEM_PROMPT = `You are a medical-education content extractor. You read source material that a faculty member uploaded for an ophthalmology teaching session and produce a clean, structured extraction the deck author (Claude Opus) will use.

OUTPUT — strict JSON, no prose, no markdown fences:
{
  "topics": [                              // 5–15 distinct teaching topics
    { "topic": string, "summary": string, "sourceRefs": string[] }
  ],
  "keyFacts": [                            // 8–25 concrete clinical facts with citations
    { "fact": string, "sourceRef": string }
  ],
  "definitions": [                         // 0–15 terms worth defining
    { "term": string, "definition": string }
  ],
  "imagesAvailable": [                     // 0–10 image/figure descriptions found in source
    { "description": string, "sourceRef": string }
  ],
  "openQuestions": [                       // 0–8 things the source explicitly raises but doesn't answer — good poll/discussion fodder
    string
  ],
  "primaryDeckOutline": [                  // ONLY if a PRIMARY_PPTX was provided — current slide order so the enhancer keeps the shape
    { "slideIndex": number, "title": string, "summary": string }
  ]
}

EXTRACTION RULES
- Stay faithful. Do not invent dosages, classification thresholds, or guideline references not in the source.
- Use clinical vocabulary (slit-lamp, OCT, FFA, ICGA, fundus, IOP, etc.) — not generic language.
- sourceRef is a short pointer the deck author can cite back to: "Section 2 page 3", "Transcript 12:30-14:00", "Slide 7 of original deck", etc.
- If multiple files are provided, prefix sourceRef with the file role: "[PRIMARY_PPTX] Slide 7", "[SOURCE pdf] Page 3", "[PRIOR_TRANSCRIPT] 10:42".
- omit fields that have no content rather than emitting empty arrays of placeholder text.`;

interface ExtractionResult {
  topics: Array<{ topic: string; summary: string; sourceRefs?: string[] }>;
  keyFacts?: Array<{ fact: string; sourceRef?: string }>;
  definitions?: Array<{ term: string; definition: string }>;
  imagesAvailable?: Array<{ description: string; sourceRef?: string }>;
  openQuestions?: string[];
  primaryDeckOutline?: Array<{ slideIndex: number; title: string; summary: string }>;
}

async function extractFromSources(loaded: LoadedDoc[]): Promise<ExtractionResult> {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  parts.push({
    text:
      `Inputs (${loaded.length} file${loaded.length > 1 ? 's' : ''}):\n` +
      loaded
        .map(
          (d, i) =>
            `[${i + 1}] role=${d.role} kind=${d.kind} mime=${d.mimeType} title="${d.title}"` +
            (d.description ? `\n    description: ${d.description.slice(0, 400)}` : ''),
        )
        .join('\n'),
  });

  let totalBytes = 0;
  for (const d of loaded) {
    if (!GEMINI_INLINE_MIMES.has(d.mimeType)) {
      // PPT/DOC binaries — describe by metadata, content extraction in Phase 2.
      parts.push({
        text:
          `[${d.role} | ${d.title}] cannot be inlined as ${d.mimeType}. ` +
          `Use the file metadata above; treat this as an outline-only signal. ` +
          `Phase 2 will swap in a real .pptx text extractor.`,
      });
      continue;
    }
    const blob = await fetchInline(d.s3Key);
    totalBytes += blob.byteLength;
    if (totalBytes > TOTAL_INLINE_CAP_BYTES) {
      throw new WizardForgeError(
        'SOURCE_TOO_LARGE',
        `Combined source bytes exceed ${TOTAL_INLINE_CAP_BYTES / 1024 / 1024} MB inline cap`,
      );
    }
    parts.push({ text: `[Begin file: ${d.role} | ${d.title}]` });
    parts.push({ inlineData: { mimeType: blob.mimeType, data: blob.data } });
    parts.push({ text: `[End file: ${d.title}]` });
  }

  parts.push({ text: 'Produce the extraction JSON now.' });

  return aiExtractFromSourceJson<ExtractionResult>({
    systemPrompt: EXTRACT_SYSTEM_PROMPT,
    parts,
    temperature: 0.2,
  });
}

// ─── Draft step ────────────────────────────────────────────────────────────

const DRAFT_SYSTEM_PROMPT = `You are a senior ophthalmology consultant + master curriculum designer at LV Prasad Eye Institute. You are authoring a teaching deck from a structured extraction Gemini produced from the faculty's source materials.

OUTPUT — strict JSON, no prose, no markdown fences:
{
  "deckTitle": string,
  "slides": [
    {
      "layout": "TITLE_ONLY" | "TITLE_BULLETS" | "TWO_COLUMN" | "IMAGE_FOCUS" | "QUOTE" | "INTERACTION" | "CLOSING",
      "title": string,            // <= 90 chars
      "bullets": string[],        // 0-6 items, each <= 140 chars
      "speakerNotes": string,     // 1-3 sentences for the presenter; <= 400 chars
      "citation": string | null   // pointer back to source (Gemini's sourceRef)
    }
  ],
  "initialSuggestions": [        // 0-8 issues you flagged WHILE drafting — surfaced as suggestions in the studio
    {
      "kind": "CLINICAL" | "DENSITY" | "PEDAGOGY" | "VISUAL" | "INTERACTION",
      "slideIndex": number,      // 0-based; reference your own slides array
      "severity": "HIGH" | "MED" | "LOW",
      "message": string,         // <= 200 chars, actionable
      "rationale": string        // 1-2 sentence reasoning the faculty would respect
    }
  ]
}

INTENT BRANCH
- If intent = ENHANCE_EXISTING: the extraction includes "primaryDeckOutline". Keep the original slide order and titles when possible — only insert / merge / split where the source genuinely needs it. The faculty wants their deck improved, not rebuilt.
- If intent = DRAFT_FROM_SCRATCH: you author the structure freely. Open with TITLE_ONLY hero, close with CLOSING.

STRUCTURE RULES (briefing-driven)
- Total slide count scales with duration: 30 min → 8-12, 45 min → 12-16, 60 min → 14-22, 90 min → 18-28.
- Bullets are crisp phrases, not full sentences. No trailing periods.
- Speaker notes carry the *why*. Bullets carry the *what*.
- Cite back to the source via "citation" using the sourceRef Gemini gave you.

PEDAGOGY RULES
- Tailor depth to briefing.audience. PG-1/early residents: anatomy-first, classification-heavy. Senior residents/fellows: decision-points, evidence, edge cases.
- At least ONE IMAGE_FOCUS slide for visual learning (use imagesAvailable if present).
- At least ONE INTERACTION slide every 6-8 slides (poll, T/F, decision-point question). Each option as a separate bullet.
- Include EXACTLY ONE "Common pitfalls" / "Learner errors" slide near the end with 4-6 bullets.
- briefing.localContext (LVPEI patient mix, adherence patterns) should show up in case discussion + pitfalls if relevant.

INITIAL SUGGESTIONS (deliberately small list)
- Only flag things that genuinely need faculty judgment — not nitpicks. Examples:
  • CLINICAL: a guideline number that needs faculty verification.
  • DENSITY: slide you authored that is borderline overloaded (>5 dense bullets).
  • PEDAGOGY: an "open question" from source that would make a great poll the deck didn't already use.
  • INTERACTION: a slide that begs for a case-vignette pause.
- Faculty veto is preserved — these are PROPOSALS, the slides above are what gets rendered initially.`;

interface DraftedSlide {
  layout?: string;
  title?: unknown;
  bullets?: unknown;
  speakerNotes?: unknown;
  citation?: unknown;
}

interface DraftResult {
  deckTitle?: unknown;
  slides?: DraftedSlide[];
  initialSuggestions?: Array<{
    kind?: string;
    slideIndex?: number;
    severity?: string;
    message?: string;
    rationale?: string;
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

function normalize(draft: DraftResult): {
  deckTitle: string;
  slides: Array<{
    layout: SlideLayout;
    title: string;
    bullets: string[];
    speakerNotes: string;
    citation: string | null;
  }>;
  initialSuggestions: Array<{
    kind: string;
    slideIndex: number;
    severity: 'HIGH' | 'MED' | 'LOW';
    message: string;
    rationale: string;
  }>;
} {
  const deckTitle =
    typeof draft.deckTitle === 'string' && draft.deckTitle.trim()
      ? draft.deckTitle.trim().slice(0, 120)
      : 'Untitled Deck';
  const raw = Array.isArray(draft.slides) ? draft.slides : [];
  const slides = raw
    .slice(0, 30)
    .map((s) => ({
      layout: (ALLOWED_LAYOUTS.includes(s.layout as SlideLayout)
        ? s.layout
        : 'TITLE_BULLETS') as SlideLayout,
      title: typeof s.title === 'string' ? s.title.slice(0, 200) : 'Untitled slide',
      bullets: Array.isArray(s.bullets)
        ? (s.bullets as unknown[])
            .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
            .slice(0, 6)
            .map((b) => b.trim().slice(0, 200))
        : [],
      speakerNotes: typeof s.speakerNotes === 'string' ? s.speakerNotes.slice(0, 1000) : '',
      citation:
        typeof s.citation === 'string' && s.citation.trim() ? s.citation.trim().slice(0, 200) : null,
    }))
    .filter((s) => s.title.trim().length > 0);

  const initialSuggestions = (draft.initialSuggestions ?? [])
    .slice(0, 8)
    .filter(
      (r): r is { kind: string; slideIndex: number; severity: string; message: string; rationale: string } =>
        typeof r.kind === 'string' &&
        typeof r.slideIndex === 'number' &&
        typeof r.message === 'string',
    )
    .map((r): {
      kind: string;
      slideIndex: number;
      severity: 'HIGH' | 'MED' | 'LOW';
      message: string;
      rationale: string;
    } => ({
      kind: r.kind.slice(0, 32),
      slideIndex: Math.max(0, Math.min(slides.length - 1, Math.floor(r.slideIndex))),
      severity:
        r.severity === 'HIGH' || r.severity === 'LOW' ? r.severity : 'MED',
      message: r.message.slice(0, 300),
      rationale: typeof r.rationale === 'string' ? r.rationale.slice(0, 500) : '',
    }));

  return { deckTitle, slides, initialSuggestions };
}

async function draftFromExtraction(args: {
  intent: DeckForgeIntent;
  briefing: WizardForgeBriefing;
  extraction: ExtractionResult;
  /** Optional faculty-history prompt block — null when faculty has no prior
   *  sessions in the lookback window. Skipped from the prompt when null. */
  historyContext: string | null;
}): Promise<DraftResult> {
  const historyBlock = args.historyContext
    ? `\n${args.historyContext}\n`
    : '';
  const userMessage =
    `Intent: ${args.intent}\n\n` +
    `BRIEFING\n` +
    `  audience: ${args.briefing.audience}\n` +
    `  sessionType: ${args.briefing.sessionType}\n` +
    `  durationMin: ${args.briefing.durationMin}\n` +
    `  objectives: ${args.briefing.objectives}\n` +
    (args.briefing.localContext ? `  localContext: ${args.briefing.localContext}\n` : '') +
    historyBlock +
    `\nEXTRACTION (from upstream extractor)\n${JSON.stringify(args.extraction, null, 2)}\n\n` +
    `Author the deck JSON now.`;
  return aiEnhanceContentJson<DraftResult>({
    systemPrompt: DRAFT_SYSTEM_PROMPT,
    userMessage,
    jsonOutput: true,
    temperature: 0.35,
    maxTokens: 8000,
  });
}

// ─── Orchestrator ──────────────────────────────────────────────────────────

export async function wizardForgeDeck(input: WizardForgeInput): Promise<WizardForgeOutcome> {
  validateInputShape(input);

  const loaded = await loadDocs(input.inputs);
  const sourceKind: DeckForgeSource = 'DOCUMENT'; // wizard always doc-driven for v1

  // 1. Create job + input rows in one transaction so the studio can resume
  //    if the AI step crashes.
  const created = await db.$transaction(async (tx) => {
    const job = await tx.deckForgeJob.create({
      data: {
        intent: input.intent,
        briefing: input.briefing as unknown as Prisma.InputJsonValue,
        requestedById: input.requestedById,
        status: DeckForgeStatus.EXTRACTING,
        sourceKind,
        inputTitle: input.inputTitle ?? loaded[0]?.title ?? 'Forged Deck',
      },
      select: { id: true },
    });
    await tx.deckForgeJobInput.createMany({
      data: loaded.map((d) => ({ jobId: job.id, documentId: d.documentId, role: d.role })),
    });
    return job;
  });

  try {
    // 2. EXTRACT — Gemini multimodal
    const extraction = await extractFromSources(loaded);

    await db.deckForgeJob.update({
      where: { id: created.id },
      data: {
        status: DeckForgeStatus.GENERATING_SLIDES,
        extractedPearls: extraction as unknown as Prisma.InputJsonValue,
      },
    });

    // 3. DRAFT — Opus authors + flags initial suggestions.
    // Faculty-history is consulted in parallel; null when faculty has no
    // prior sessions (new instructor, no signals yet).
    const history = await getFacultyHistoryContext(input.requestedById).catch(() => null);

    const draft = await draftFromExtraction({
      intent: input.intent,
      briefing: input.briefing,
      extraction,
      historyContext: history?.promptContext ?? null,
    });
    const result = normalize(draft);

    if (result.slides.length === 0) {
      throw new WizardForgeError('EMPTY_DECK', 'AI returned no usable slides');
    }

    // 4. Persist slides + seed the analysisResult with initial suggestions so
    //    the studio can render them on first load without calling /analyze.
    const slideRows: Prisma.SlideCreateManyInput[] = result.slides.map((s, i) => ({
      deckForgeJobId: created.id,
      order: i,
      layout: s.layout,
      title: s.title,
      bullets: s.bullets,
      speakerNotes: s.speakerNotes || null,
      sourceCitations: s.citation
        ? [{ note: s.citation, documentId: loaded[0]?.documentId ?? null, recordingId: null }]
        : undefined,
    }));

    await db.$transaction(async (tx) => {
      await tx.slide.createMany({ data: slideRows });
      await tx.deckForgeJob.update({
        where: { id: created.id },
        data: {
          status: DeckForgeStatus.REVIEW_PENDING,
          slideCount: result.slides.length,
          inputTitle: result.deckTitle,
          // analysisResult intentionally left null — the legacy DeckAiCoach
          // expects the post-/analyze DeckAnalysisResult shape (scores +
          // passes + DeckSuggestion[]) and crashes on partial shapes. The
          // wizard's initialSuggestions will live in Phase 1C's Studio under
          // its own UI; for now, faculty clicks "Analyze" in the editor and
          // gets a real analysisResult written.
        },
      });
    });

    return {
      jobId: created.id,
      deckTitle: result.deckTitle,
      slideCount: result.slides.length,
    };
  } catch (err) {
    const code =
      err instanceof WizardForgeError
        ? err.code
        : err instanceof AiUnavailableError
          ? 'AI_UNAVAILABLE'
          : 'FORGE_FAILED';
    const message =
      err instanceof AiUnavailableError || err instanceof AiUnparseableError
        ? `AI provider error: ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Forge failed';
    await db.deckForgeJob.update({
      where: { id: created.id },
      data: { status: DeckForgeStatus.FAILED, errorMessage: message.slice(0, 1000) },
    });
    throw err instanceof WizardForgeError ? err : new WizardForgeError(code, message);
  }
}
