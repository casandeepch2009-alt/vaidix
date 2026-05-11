// ════════════════════════════════════════════════════════════════════════════
// Post-Session Content Pack — W8.3
// ════════════════════════════════════════════════════════════════════════════
// After a session transcript is finalized, this service uses Claude to extract:
//   1. 3 key learning Pearls → pearls table (unapproved, extractedByAi=true)
//   2. 5 Q&A pairs          → post_session_qa table
//   3. 1 SJT case           → sjt_cases table (unapproved)
//   4. 1 PBL scenario       → pbl_scenarios table (unapproved)
//
// NOTE: Uses $queryRaw / $executeRawUnsafe for the three new tables and for the
// new sourceSessionTranscriptId field on pearls, because the Prisma client can
// not be regenerated while the Next.js dev server holds the query-engine DLL.
// Column names match the migration (camelCase, quoted in PostgreSQL).
// Once Prisma client is regenerated, raw SQL can be replaced with typed methods.

import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { claudeGenerate, tryParseJson, ClaudeUnavailableError } from '@/server/services/ai/claude';

const MIN_CONTENT_LENGTH = 200;
const MAX_CONTENT_LENGTH = 12_000;

// ─── System prompts ────────────────────────────────────────────────────────

const PEARL_PROMPT = `You are a clinical educator at LVPEI (L V Prasad Eye Institute), one of India's premier ophthalmology institutions.
Extract exactly 3 key learning pearls from the ophthalmology session transcript.
Each pearl must be:
- Clinically actionable and specific (no generic statements)
- Grounded in content from the transcript
- Written for ophthalmology trainees (residents / fellows)
- Under 60 words for body

Return a JSON array with exactly 3 objects:
[{"title": "<concise pearl title ≤10 words>", "body": "<clinical pearl ≤60 words>"}]`;

const QA_PROMPT = `You are a clinical educator at LVPEI.
Extract exactly 5 clinically relevant Q&A pairs from this ophthalmology session transcript.
Questions should be what a trainee might ask; answers should reflect content from the session.
Each answer must be precise and under 80 words.

Return a JSON array with exactly 5 objects:
[{"question": "<question>", "answer": "<answer ≤80 words>"}]`;

const SJT_PROMPT = `You are a clinical educator at LVPEI.
Generate exactly 1 Situational Judgment Test (SJT) case based on clinical content in this ophthalmology transcript.
The case should present a realistic management dilemma that tests clinical reasoning.
Choose a scenario explicitly present in or directly derivable from the transcript.

Return a single JSON object:
{"stem": "<clinical scenario ≤150 words>", "options": ["<A>", "<B>", "<C>", "<D>"], "correctIndex": 0, "rationale": "<why this is correct ≤100 words>"}`;

const PBL_PROMPT = `You are a clinical educator at LVPEI.
Generate exactly 1 Problem-Based Learning (PBL) scenario based on this ophthalmology session transcript.
The scenario should trigger self-directed enquiry and promote deeper learning of the session's key concepts.

Return a single JSON object:
{"trigger": "<opening clinical trigger ≤100 words>", "objectives": ["<learning objective 1>", "<learning objective 2>", "<learning objective 3>"], "content": "<background notes for facilitators ≤200 words>"}`;

// ─── Types ─────────────────────────────────────────────────────────────────

interface RawPearl { title: string; body: string }
interface RawQa { question: string; answer: string }
interface RawSjt { stem: string; options: string[]; correctIndex?: number; rationale: string }
interface RawPbl { trigger: string; objectives: string[]; content: string }

export interface PostSessionPackResult {
  pearls: number;
  qaPairs: number;
  sjtCases: number;
  pblScenarios: number;
  skipped: boolean;
  reason?: string;
}

function newId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

// ─── Main entry ────────────────────────────────────────────────────────────

export async function generatePostSessionPack(
  sessionId: string,
): Promise<PostSessionPackResult> {
  const transcript = await db.sessionTranscript.findUnique({
    where: { sessionId_language: { sessionId, language: 'en' } },
    select: { id: true, contentText: true, finalized: true },
  });
  if (!transcript?.contentText || transcript.contentText.length < MIN_CONTENT_LENGTH) {
    return { pearls: 0, qaPairs: 0, sjtCases: 0, pblScenarios: 0, skipped: true, reason: 'insufficient-content' };
  }

  const session = await db.teachingSession.findUnique({
    where: { id: sessionId },
    select: { programId: true, topicId: true },
  });
  if (!session) {
    return { pearls: 0, qaPairs: 0, sjtCases: 0, pblScenarios: 0, skipped: true, reason: 'session-not-found' };
  }

  // Idempotency — raw SQL because postSessionQa is not in the stale Prisma client.
  const existingRows = await db.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM post_session_qa WHERE "sessionTranscriptId" = ${transcript.id}
  `;
  if (Number(existingRows[0]?.count ?? 0) > 0) {
    return { pearls: 0, qaPairs: 0, sjtCases: 0, pblScenarios: 0, skipped: true, reason: 'already-generated' };
  }

  const content = transcript.contentText.slice(-MAX_CONTENT_LENGTH);
  const transcriptId = transcript.id;

  let pearlsCreated = 0;
  let qaCreated = 0;
  let sjtCreated = 0;
  let pblCreated = 0;

  await Promise.allSettled([
    extractPearls(content, transcriptId, session.programId, session.topicId).then((n) => { pearlsCreated = n; }),
    extractQaPairs(content, transcriptId).then((n) => { qaCreated = n; }),
    generateSjt(content, transcriptId).then((n) => { sjtCreated = n; }),
    generatePbl(content, transcriptId).then((n) => { pblCreated = n; }),
  ]);

  return { pearls: pearlsCreated, qaPairs: qaCreated, sjtCases: sjtCreated, pblScenarios: pblCreated, skipped: false };
}

// ─── Individual generators ─────────────────────────────────────────────────

async function extractPearls(
  content: string,
  transcriptId: string,
  programId: string,
  topicId: string | null,
): Promise<number> {
  try {
    const raw = await claudeGenerate({
      systemInstruction: PEARL_PROMPT,
      userMessage: `TRANSCRIPT:\n${content}`,
    });
    const parsed = tryParseJson<RawPearl[]>(raw);
    if (!Array.isArray(parsed)) return 0;
    const valid = parsed.slice(0, 3).filter((p) => p.title && p.body);
    for (const p of valid) {
      await db.$executeRawUnsafe(
        `INSERT INTO pearls (id, title, body, "programId", "topicId", "sourceType", "sourceSessionTranscriptId", "extractedByAi", approved, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, 'session_transcript', $6, true, false, now(), now())`,
        newId(),
        p.title.slice(0, 120),
        p.body.slice(0, 500),
        programId,
        topicId ?? null,
        transcriptId,
      );
    }
    return valid.length;
  } catch (err) {
    if (!(err instanceof ClaudeUnavailableError)) console.error('[post-session-pack] pearls failed', err);
    return 0;
  }
}

async function extractQaPairs(content: string, transcriptId: string): Promise<number> {
  try {
    const raw = await claudeGenerate({
      systemInstruction: QA_PROMPT,
      userMessage: `TRANSCRIPT:\n${content}`,
    });
    const parsed = tryParseJson<RawQa[]>(raw);
    if (!Array.isArray(parsed)) return 0;
    const valid = parsed.slice(0, 5).filter((q) => q.question && q.answer);
    for (const q of valid) {
      await db.$executeRawUnsafe(
        `INSERT INTO post_session_qa (id, "sessionTranscriptId", question, answer, source, "createdAt")
         VALUES ($1, $2, $3, $4, 'claude', now())`,
        newId(),
        transcriptId,
        q.question.slice(0, 500),
        q.answer.slice(0, 1000),
      );
    }
    return valid.length;
  } catch (err) {
    if (!(err instanceof ClaudeUnavailableError)) console.error('[post-session-pack] qa failed', err);
    return 0;
  }
}

async function generateSjt(content: string, transcriptId: string): Promise<number> {
  try {
    const raw = await claudeGenerate({
      systemInstruction: SJT_PROMPT,
      userMessage: `TRANSCRIPT:\n${content}`,
    });
    const parsed = tryParseJson<RawSjt>(raw);
    if (!parsed?.stem) return 0;
    const options = Array.isArray(parsed.options) ? parsed.options.slice(0, 4) : [];
    const correctIndex = typeof parsed.correctIndex === 'number' ? parsed.correctIndex : null;
    await db.$executeRawUnsafe(
      `INSERT INTO sjt_cases (id, "sessionTranscriptId", stem, options, "correctIndex", rationale, "createdByAi", approved, "createdAt")
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, true, false, now())`,
      newId(),
      transcriptId,
      parsed.stem.slice(0, 2000),
      JSON.stringify(options),
      correctIndex,
      (parsed.rationale ?? '').slice(0, 1000),
    );
    return 1;
  } catch (err) {
    if (!(err instanceof ClaudeUnavailableError)) console.error('[post-session-pack] sjt failed', err);
    return 0;
  }
}

async function generatePbl(content: string, transcriptId: string): Promise<number> {
  try {
    const raw = await claudeGenerate({
      systemInstruction: PBL_PROMPT,
      userMessage: `TRANSCRIPT:\n${content}`,
    });
    const parsed = tryParseJson<RawPbl>(raw);
    if (!parsed?.trigger) return 0;
    const objectives = Array.isArray(parsed.objectives) ? parsed.objectives.slice(0, 5) : [];
    await db.$executeRawUnsafe(
      `INSERT INTO pbl_scenarios (id, "sessionTranscriptId", "trigger", objectives, content, "createdByAi", approved, "createdAt")
       VALUES ($1, $2, $3, $4::jsonb, $5, true, false, now())`,
      newId(),
      transcriptId,
      parsed.trigger.slice(0, 1000),
      JSON.stringify(objectives),
      (parsed.content ?? '').slice(0, 3000),
    );
    return 1;
  } catch (err) {
    if (!(err instanceof ClaudeUnavailableError)) console.error('[post-session-pack] pbl failed', err);
    return 0;
  }
}

// ─── Read helpers (used by the GET /post-session route) ────────────────────

interface QaRow { id: string; question: string; answer: string; createdAt: Date }
interface SjtRow { id: string; stem: string; options: unknown; correctIndex: number | null; rationale: string; createdAt: Date }
interface PblRow { id: string; trigger: string; objectives: unknown; content: string; createdAt: Date }
interface PearlRow { id: string; title: string; body: string; approved: boolean; createdAt: Date }

export async function readPostSessionPack(sessionId: string) {
  const transcript = await db.sessionTranscript.findUnique({
    where: { sessionId_language: { sessionId, language: 'en' } },
    select: { id: true, finalized: true, finalizedAt: true },
  });
  if (!transcript) return null;

  const [pearls, qaPairs, sjtCases, pblScenarios] = await Promise.all([
    db.$queryRaw<PearlRow[]>`
      SELECT id, title, body, approved, "createdAt" FROM pearls
      WHERE "sourceSessionTranscriptId" = ${transcript.id} ORDER BY "createdAt" ASC`,
    db.$queryRaw<QaRow[]>`
      SELECT id, question, answer, "createdAt" FROM post_session_qa
      WHERE "sessionTranscriptId" = ${transcript.id} ORDER BY "createdAt" ASC`,
    db.$queryRaw<SjtRow[]>`
      SELECT id, stem, options, "correctIndex", rationale, "createdAt" FROM sjt_cases
      WHERE "sessionTranscriptId" = ${transcript.id} ORDER BY "createdAt" ASC`,
    db.$queryRaw<PblRow[]>`
      SELECT id, "trigger", objectives, content, "createdAt" FROM pbl_scenarios
      WHERE "sessionTranscriptId" = ${transcript.id} ORDER BY "createdAt" ASC`,
  ]);

  return {
    transcriptId: transcript.id,
    finalized: transcript.finalized,
    finalizedAt: transcript.finalizedAt?.toISOString() ?? null,
    pearls: pearls.map((p) => ({ id: p.id, title: p.title, body: p.body, approved: p.approved, createdAt: p.createdAt })),
    qaPairs: qaPairs.map((q) => ({ id: q.id, question: q.question, answer: q.answer, createdAt: q.createdAt })),
    sjtCases: sjtCases.map((s) => ({ id: s.id, stem: s.stem, options: s.options, correctIndex: s.correctIndex, rationale: s.rationale, createdAt: s.createdAt })),
    pblScenarios: pblScenarios.map((p) => ({ id: p.id, trigger: p.trigger, objectives: p.objectives, content: p.content, createdAt: p.createdAt })),
  };
}
