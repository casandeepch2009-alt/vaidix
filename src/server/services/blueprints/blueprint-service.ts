// ════════════════════════════════════════════════════════════════════════════
// Blueprint Service — Phase A
// ════════════════════════════════════════════════════════════════════════════
// Generates a Precision Ophthalmology Education Blueprint for a topic — a
// curriculum/instructional-design plan, NOT slide content. Faculty use this
// when designing a new module from scratch and want the pedagogic scaffold
// (learner profile / VARK adaptation / theory / tactics / feedback / OSCE)
// before they author slides or wet-lab sessions.

import { db } from '@/lib/db';
import {
  geminiGenerate,
  GeminiUnavailableError,
  GeminiUnparseableError,
} from '@/server/services/ai/gemini';
import { env } from '@/lib/env';

const SYSTEM_PROMPT = `You are an expert Ophthalmology Medical Educator, Curriculum Designer, and Instructional Strategist at LV Prasad Eye Institute. For the topic provided, generate a Precision Education Blueprint tailored to the learner, content, and clinical context. Your response must be specific to ophthalmology, practical for postgraduate / fellowship-level teaching, and free of generic educational filler.

OUTPUT FORMAT — markdown only, no JSON, no preamble. Use these headings IN THIS ORDER:

# Topic/Module
# Target Learner
# Prior Knowledge Assumed
# Clinical Context
# Learning Style Adaptation
# Required Learning Attributes
# Best-Fit Learning Theory
# Instructional Tactics
# Feedback Loop
# Competency Assessment
# Mastery Indicators
# Common Learner Errors
# Faculty/Resource Needs
# Additional Instruction

CONTENT RULES
- Anchor every recommendation to the specific topic — never give generic educational advice. Where relevant, name ophthalmic tools and contexts: slit-lamp, fundoscopy, OCT, FFA, ICGA, ultrasonography (A/B-scan, UBM), lasers (PRP, YAG, SLT), wet-lab, microsurgery, counseling, interdisciplinary care.
- Target Learner: state intern / PGY-1 / PGY-2 / senior resident / fellow / optometrist / practicing ophthalmologist explicitly. Include prior knowledge expected and the clinical setting (OPD, emergency, OT, retina clinic, uveitis service, pediatric clinic, simulation lab).
- Learning Style Adaptation: list four bullets V / A / R / K — each with topic-specific examples (e.g. "V: serial OCT cube comparison of NPDR → severe NPDR → DME"; not "use visuals").
- Required Learning Attributes: only the attributes truly needed for mastery. Cognitive (pattern recognition, Bayesian reasoning, risk stratification), psychomotor (microsurgical hand-eye, 3D anatomical mapping), affective (counseling under uncertainty, breaking bad news re: vision loss). Skip irrelevant ones.
- Best-Fit Learning Theory: pick ONE primary theory plus an optional secondary support theory from {Cognitive Load Theory, Deliberate Practice, Experiential Learning, Situated Learning, Social Constructivism, Mastery Learning, Retrieval Practice, Dual Coding, Apprenticeship Model}. Justify in 1-2 sentences why it fits THIS topic, briefly note why other theories are less central.
- Instructional Tactics: 3-5 tactics, MULTIMODAL — must include at least one strong V, one A, one K tactic; optionally one R. Each tactic states (a) the activity, (b) why it suits THIS topic, (c) the learner level it best fits, (d) faculty / resources required.
- Feedback Loop: type (immediate corrective / coached / reflective debrief / delayed summative / peer / checklist), timing, who provides it, how delivered for max learning impact.
- Competency Assessment: name the specific tools (MCQs / SAQs / key-feature questions / OSCE / OSPE / DOPS / Mini-CEX / viva / image-based / surgical rubric / entrustment / case presentation). Cover knowledge, clinical reasoning, procedural skill (if relevant), and professional behavior (if relevant).
- Mastery Indicators: bullet list of "what counts as competent performance" — observable, behavior-anchored.
- Common Learner Errors: bullets of where residents most often go wrong on this topic.
- Faculty/Resource Needs: concrete equipment + faculty time (e.g. "Heidelberg Spectralis × 1, faculty 90 min, wet-lab pig eyes × 2/resident").
- Additional Instruction: any topic-specific caveats (regional disease pattern, scarcity of equipment, ethical issues, language considerations).

Be concise but sufficiently detailed — this is a working teaching document, not a textbook.`;

export class BlueprintError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface GenerateBlueprintInput {
  requestedById: string;
  topic: string;
  learnerLevel?: string;
}

export interface BlueprintRow {
  id: string;
  topic: string;
  learnerLevel: string | null;
  content: string;
  source: string;
  createdAt: Date;
}

export async function generateBlueprint(input: GenerateBlueprintInput): Promise<BlueprintRow> {
  if (!env.GEMINI_API_KEY) {
    throw new BlueprintError('AI_UNAVAILABLE', 'GEMINI_API_KEY is not set');
  }
  const userPrompt = `Topic/Module: ${input.topic}${
    input.learnerLevel ? `\nIntended learner: ${input.learnerLevel}` : ''
  }

Generate the Precision Education Blueprint now.`;

  let content: string;
  try {
    content = await geminiGenerate({
      systemInstruction: SYSTEM_PROMPT,
      userParts: [{ text: userPrompt }],
      responseMimeType: 'text/plain',
      temperature: 0.4,
    });
  } catch (err) {
    if (err instanceof GeminiUnavailableError || err instanceof GeminiUnparseableError) {
      throw new BlueprintError('AI_UNAVAILABLE', err.message);
    }
    throw err;
  }

  const cleaned = content.trim();
  if (cleaned.length < 200) {
    throw new BlueprintError('EMPTY_OUTPUT', 'AI returned an empty or too-short blueprint');
  }

  const row = await db.blueprint.create({
    data: {
      requestedById: input.requestedById,
      topic: input.topic.trim().slice(0, 280),
      learnerLevel: input.learnerLevel?.trim().slice(0, 80) ?? null,
      content: cleaned,
      source: 'gemini',
    },
    select: {
      id: true,
      topic: true,
      learnerLevel: true,
      content: true,
      source: true,
      createdAt: true,
    },
  });
  return row;
}

export async function listBlueprintsForUser(userId: string): Promise<
  Array<Pick<BlueprintRow, 'id' | 'topic' | 'learnerLevel' | 'createdAt'>>
> {
  return db.blueprint.findMany({
    where: { requestedById: userId },
    select: { id: true, topic: true, learnerLevel: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function getBlueprintForUser(
  blueprintId: string,
  userId: string,
): Promise<BlueprintRow | null> {
  const row = await db.blueprint.findUnique({
    where: { id: blueprintId },
    select: {
      id: true,
      topic: true,
      learnerLevel: true,
      content: true,
      source: true,
      createdAt: true,
      requestedById: true,
    },
  });
  if (!row || row.requestedById !== userId) return null;
  // strip the requestedById from the return shape
  const { requestedById: _omit, ...rest } = row;
  void _omit;
  return rest;
}

export async function deleteBlueprintForUser(
  blueprintId: string,
  userId: string,
): Promise<boolean> {
  const row = await db.blueprint.findUnique({
    where: { id: blueprintId },
    select: { requestedById: true },
  });
  if (!row || row.requestedById !== userId) return false;
  await db.blueprint.delete({ where: { id: blueprintId } });
  return true;
}
