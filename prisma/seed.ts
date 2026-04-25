// ════════════════════════════════════════════════════════════════════════════
// Vaidix — Database Seed Script
// ════════════════════════════════════════════════════════════════════════════
// Run: npx prisma db seed
// Idempotent: safe to re-run. Uses upsert where possible.
// Loads: super-admin (Sandeep) + reference data (topics, pearls, atlas, courses)

import { PrismaClient, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

const MOCK_DIR = path.join(__dirname, '../src/mock-data');

function loadJson<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(MOCK_DIR, filename), 'utf-8'));
}

interface PearlSeed {
  id: string;
  topic?: string;
  question?: string;
  answer?: string;
  mechanism?: string;
}
interface AtlasSeed {
  id: string;
  topic?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  mechanism?: string;
  modality?: string;
}

// ─── Ophthalmology subspecialty topics (16 LVPEI subspecialties) ──────────
const TOPICS = [
  { slug: 'cornea', name: 'Cornea & Anterior Segment', subspecialty: 'Cornea' },
  { slug: 'retina', name: 'Vitreoretinal Surgery', subspecialty: 'Retina' },
  { slug: 'glaucoma', name: 'Glaucoma', subspecialty: 'Glaucoma' },
  { slug: 'pediatric', name: 'Pediatric Ophthalmology & Strabismus', subspecialty: 'Pediatric' },
  { slug: 'uvea', name: 'Uveitis & Ocular Immunology', subspecialty: 'Uvea' },
  { slug: 'oculoplasty', name: 'Oculoplasty & Orbit', subspecialty: 'Oculoplasty' },
  { slug: 'neuro-ophth', name: 'Neuro-Ophthalmology', subspecialty: 'Neuro' },
  { slug: 'ocular-oncology', name: 'Ocular Oncology', subspecialty: 'Oncology' },
  { slug: 'contact-lens', name: 'Contact Lens & Keratoconus', subspecialty: 'Cornea' },
  { slug: 'refractive', name: 'Refractive Surgery', subspecialty: 'Cornea' },
  { slug: 'community', name: 'Community Ophthalmology', subspecialty: 'Public Health' },
  { slug: 'low-vision', name: 'Low Vision & Rehabilitation', subspecialty: 'Rehabilitation' },
  { slug: 'rop', name: 'Retinopathy of Prematurity', subspecialty: 'Pediatric' },
  { slug: 'imaging', name: 'Ocular Imaging', subspecialty: 'Diagnostics' },
  { slug: 'infections', name: 'Ocular Infections', subspecialty: 'General' },
  { slug: 'trauma', name: 'Ocular Trauma', subspecialty: 'Emergency' },
];

const LEVELS = [
  { levelNumber: 1, name: 'Novice', description: 'Foundational knowledge acquisition', minMastery: 0 },
  { levelNumber: 2, name: 'Advanced Beginner', description: 'Pattern recognition with guidance', minMastery: 40 },
  { levelNumber: 3, name: 'Competent', description: 'Independent clinical reasoning', minMastery: 65 },
  { levelNumber: 4, name: 'Proficient', description: 'Teaching and supervising others', minMastery: 85 },
];

// ─── Default password for all seeded users ────────────────────────────────
const DEFAULT_PASSWORD = 'Vaidix@2026!';

async function main() {
  console.log('🌱 Seeding Vaidix database...\n');

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  // ─── 1. LEVELS ────────────────────────────────────────────────────────────
  console.log('📊 Seeding Levels...');
  for (const l of LEVELS) {
    await prisma.level.upsert({
      where: { levelNumber: l.levelNumber },
      update: {},
      create: l,
    });
  }
  console.log(`   ✓ ${LEVELS.length} levels`);

  // ─── 2. TOPICS ────────────────────────────────────────────────────────────
  console.log('📚 Seeding Topics...');
  for (const t of TOPICS) {
    await prisma.topic.upsert({
      where: { slug: t.slug },
      update: {},
      create: t,
    });
  }
  console.log(`   ✓ ${TOPICS.length} topics`);

  // ─── 3. SUPER ADMIN (only seeded user — all others invited via admin UI) ─
  console.log('👑 Seeding Super Admin...');
  await prisma.user.upsert({
    where: { email: 'sandeep@vaidix.local' },
    update: {},
    create: {
      email: 'sandeep@vaidix.local',
      name: 'Sandeep',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash,
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          affiliation: 'Vaidix Platform',
          languages: ['en'],
          timezone: 'Asia/Kolkata',
        },
      },
      preferences: { create: {} },
      stats: { create: {} },
    },
  });
  console.log('   ✓ sandeep@vaidix.local (super admin)');

  // ─── 5. PEARLS ────────────────────────────────────────────────────────────
  console.log('💎 Seeding Pearls...');
  const topics = await prisma.topic.findMany();
  const topicBySlug = new Map(topics.map((t) => [t.slug, t]));
  const mockPearls = loadJson<PearlSeed[]>('pearls.json');
  let pearlCount = 0;
  for (const p of mockPearls) {
    const topic = (p.topic ? topicBySlug.get(p.topic) : undefined) ?? topicBySlug.get('retina')!;
    await prisma.pearl.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        title: p.question?.slice(0, 200) ?? 'Pearl',
        body: `${p.question}\n\n${p.answer}\n\n${p.mechanism ?? ''}`,
        topicId: topic.id,
        sourceType: 'manual',
        extractedByAi: false,
        approved: true,
      },
    });
    pearlCount++;
  }
  console.log(`   ✓ ${pearlCount} pearls`);

  // ─── 6. ATLAS IMAGES ──────────────────────────────────────────────────────
  console.log('🖼️  Seeding Atlas Images...');
  const mockSigns = loadJson<AtlasSeed[]>('signs-atlas.json');
  let atlasCount = 0;
  for (const s of mockSigns) {
    const topic = (s.topic ? topicBySlug.get(s.topic) : undefined) ?? topicBySlug.get('retina')!;
    await prisma.atlasImage.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        title: s.name,
        description: s.description,
        imageUrl: s.imageUrl ?? `/atlas/${s.id}.jpg`,
        caption: s.mechanism,
        topicId: topic.id,
        modality: s.modality ?? 'CLINICAL',
      },
    });
    atlasCount++;
  }
  console.log(`   ✓ ${atlasCount} atlas images`);

  // Cases skipped — no residents seeded. They'll be created after first invited resident logs in.

  // ─── 8. SAMPLE COURSES (for W7+ but useful to have) ───────────────────────
  console.log('🎓 Seeding Sample Courses...');
  const sampleCourses = [
    { slug: 'empathy-basics', title: 'Clinical Empathy Fundamentals', track: 'HEART' as const },
    { slug: 'diff-dx-anterior', title: 'Differential Diagnosis — Anterior Segment', track: 'HEAD' as const },
    { slug: 'slit-lamp-mastery', title: 'Slit-Lamp Examination Mastery', track: 'HANDS' as const },
  ];
  for (const c of sampleCourses) {
    await prisma.course.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        slug: c.slug,
        title: c.title,
        description: `LVPEI-accredited training course: ${c.title}`,
        track: c.track,
        format: 'MIXED',
        estimatedMinutes: 120,
      },
    });
  }
  console.log(`   ✓ ${sampleCourses.length} courses`);

  // ─── 9. RETENTION POLICIES (DPDPA defaults) ───────────────────────────────
  console.log('⚖️  Seeding Retention Policies...');
  const policies = [
    { entityType: 'recording', retentionDays: 730, archiveAfterDays: 365 },
    { entityType: 'transcript', retentionDays: 730, archiveAfterDays: 365 },
    { entityType: 'document', retentionDays: 1825, archiveAfterDays: 730 },
    { entityType: 'audit_event', retentionDays: 2555, archiveAfterDays: null },
    { entityType: 'conversation', retentionDays: 1095, archiveAfterDays: 365 },
  ];
  for (const p of policies) {
    await prisma.retentionPolicy.upsert({
      where: { entityType: p.entityType },
      update: {},
      create: p,
    });
  }
  console.log(`   ✓ ${policies.length} retention policies`);

  // ─── 10. FEATURE FLAGS ────────────────────────────────────────────────────
  console.log('🚩 Seeding Feature Flags...');
  const flags = [
    { key: 'recording_auto_transcribe', enabled: true, description: 'Auto-run transcription pipeline on recording finish' },
    { key: 'deck_forge_enabled', enabled: true, description: 'Deck Forge (AI PPT generation)' },
    { key: 'breakout_rooms_enabled', enabled: false, description: 'Breakout rooms in live sessions' },
    { key: 'vcce_gate_deployments', enabled: true, description: 'VCCE must pass before LoRA deployment' },
    { key: 'silence_test_every_deploy', enabled: true, description: 'Silence Test blocks all deploys on failure' },
    { key: 'rag_enabled', enabled: true, description: 'RAG retrieval in Knowledge Hub' },
  ];
  for (const f of flags) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      update: {},
      create: f,
    });
  }
  console.log(`   ✓ ${flags.length} feature flags`);

  console.log('\n✅ Seed complete.\n');
  console.log('📝 Super Admin credentials:');
  console.log('   • Email:    sandeep@vaidix.local');
  console.log(`   • Password: ${DEFAULT_PASSWORD}`);
  console.log('\n   All other users must be invited via /admin/invitations.\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
