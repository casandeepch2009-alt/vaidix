// ════════════════════════════════════════════════════════════════════════════
// Vaidix — Database Seed Script
// ════════════════════════════════════════════════════════════════════════════
// Run: npx prisma db seed
// Idempotent: safe to re-run. Uses upsert where possible.
//
// Two profiles:
//   SEED_DEMO=true (or NODE_ENV !== 'production')
//     Full demo dataset — admin + 4 demo users (resident/faculty/PD/external),
//     role mappings, pearls, atlas images, case templates, sample courses.
//     Used for local dev and staging.
//
//   default in production
//     PRODUCTION-SAFE seed — only the irreducible minimum required for the
//     app to function: 4 levels, 16 topics, 1 admin user, retention policies,
//     feature flags. NO demo users, NO mock content.

import { PrismaClient, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

// Demo content gate. Production deploys must boot WITHOUT this flag set, so
// patient-facing instances never accumulate mock pearls / atlas / cases.
const SEED_DEMO =
  process.env.SEED_DEMO === 'true' || process.env.NODE_ENV !== 'production';

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

interface CaseTemplateSeed {
  id: string;
  title: string;
  condition: string;
  specialty: string;
  bloomsLevel: number;
  patientName: string;
  patientAge: string | number;
  patientGender: string;
  difficulty: string; // 'beginner' | 'intermediate' | 'advanced'
  estimatedMinutes: number;
  description: string;
  tags: string[];
  imageCount: number;
  topic?: string;
  oslerianPrinciples?: string[];
  isEmergency?: boolean;
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

// ─── Default passwords ────────────────────────────────────────────────────
const DEFAULT_PASSWORD      = 'Vaidix@2026!';
const DEMO_PASSWORD         = '12345678';

async function main() {
  console.log('🌱 Seeding Vaidix database...\n');

  const passwordHash     = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const demoPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

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

  // ─── 3. USERS ─────────────────────────────────────────────────────────────
  console.log(`👥 Seeding Users... (profile: ${SEED_DEMO ? 'DEMO' : 'PRODUCTION'})`);

  const adminUser = {
    email:       'sandeep@vaidix.local',
    mobile:      '+919876543210',
    name:        'Sandeep',
    role:        Role.ADMIN,
    hash:        passwordHash,
    affiliation: 'Vaidix Platform',
  };

  const demoNonAdminUsers = [
    {
      email:       'arjun.mehta@vaidix.local',
      mobile:      '+919876543211',
      name:        'Arjun Mehta',
      role:        Role.RESIDENT,
      hash:        demoPasswordHash,
      affiliation: 'LVPEI Residency Program',
    },
    {
      email:       'meera.krishnan@vaidix.local',
      mobile:      '+919876543212',
      name:        'Dr. Meera Krishnan',
      role:        Role.FACULTY,
      hash:        demoPasswordHash,
      affiliation: 'LVPEI Faculty',
    },
    {
      email:       'rajeev.nair@vaidix.local',
      mobile:      '+919876543213',
      name:        'Dr. Rajeev Nair',
      role:        Role.PROGRAM_DIRECTOR,
      hash:        demoPasswordHash,
      affiliation: 'LVPEI Program Leadership',
    },
    {
      email:       'priya.sharma@vaidix.local',
      mobile:      '+919876543214',
      name:        'Priya Sharma',
      role:        Role.EXTERNAL_LEARNER,
      hash:        demoPasswordHash,
      affiliation: 'External',
    },
  ];

  // Admin always seeded so the platform is reachable. Non-admin demo users
  // skipped in production so the deployment starts empty.
  const usersToSeed = SEED_DEMO ? [adminUser, ...demoNonAdminUsers] : [adminUser];

  for (const u of usersToSeed) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { mobile: u.mobile, passwordHash: u.hash },
      create: {
        email:          u.email,
        mobile:         u.mobile,
        name:           u.name,
        role:           u.role,
        status:         UserStatus.ACTIVE,
        passwordHash:   u.hash,
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            affiliation: u.affiliation,
            languages:   ['en'],
            timezone:    'Asia/Kolkata',
          },
        },
        preferences: { create: {} },
        stats:       { create: {} },
      },
    });
    console.log(`   ✓ ${u.mobile}  ${u.name.padEnd(24)} [${u.role}]`);
  }

  // ─── 4. ROLE MAPPINGS (Faculty → PD, Cohort → Faculty mentor) ─────────────
  // Demo-only — references the demo users seeded above. Production deploys
  // skip this entirely; admins wire mappings via /admin/users + /admin/cohorts.
  if (SEED_DEMO) {
    console.log('🪢 Seeding mappings (faculty↔PD, cohort↔mentor)...');
    const sandeep = await prisma.user.findUnique({ where: { email: 'sandeep@vaidix.local' } });
    const rajeev  = await prisma.user.findUnique({ where: { email: 'rajeev.nair@vaidix.local' } });
    const meera   = await prisma.user.findUnique({ where: { email: 'meera.krishnan@vaidix.local' } });
    const arjun   = await prisma.user.findUnique({ where: { email: 'arjun.mehta@vaidix.local' } });

    if (meera && rajeev && meera.programDirectorId !== rajeev.id) {
      await prisma.user.update({
        where: { id: meera.id },
        data:  { programDirectorId: rajeev.id },
      });
      console.log(`   ✓ Meera → reports to Rajeev (PD)`);
    }

    if (sandeep && meera && arjun) {
      const cohortName = 'PGY-1 Residents 2026–27';
      const existing = await prisma.cohort.findFirst({
        where: { name: cohortName, deletedAt: null },
        select: { id: true, facultyId: true },
      });
      const cohort = existing
        ? await prisma.cohort.update({
            where: { id: existing.id },
            data:  { facultyId: meera.id },
          })
        : await prisma.cohort.create({
            data: {
              name:         cohortName,
              description:  'Demo cohort wired up by seed: PGY-1 ophthalmology residents.',
              academicYear: '2026–27',
              createdBy:    sandeep.id,
              facultyId:    meera.id,
            },
          });
      await prisma.cohortMember.upsert({
        where:  { cohortId_userId: { cohortId: cohort.id, userId: arjun.id } },
        create: { cohortId: cohort.id, userId: arjun.id, addedBy: sandeep.id },
        update: {},
      });
      console.log(`   ✓ Cohort "${cohortName}" — mentor: Meera, member: Arjun`);
    }
  }

  // ─── 5. PEARLS (demo-only — mock content from src/mock-data/pearls.json) ─
  const topics = await prisma.topic.findMany();
  const topicBySlug = new Map(topics.map((t) => [t.slug, t]));

  if (SEED_DEMO) {
    console.log('💎 Seeding Pearls...');
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
  }

  // ─── 6. ATLAS IMAGES (demo-only) ─────────────────────────────────────────
  if (SEED_DEMO) {
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
  }

  // ─── 7. CASE TEMPLATES (demo-only — library of clinical cases) ───────────
  if (SEED_DEMO) {
    console.log('📚 Seeding Case Templates...');
    const mockCases = loadJson<CaseTemplateSeed[]>('cases.json');
    let templateCount = 0;
    for (const c of mockCases) {
    const topic = c.topic ? topicBySlug.get(c.topic) : undefined;
    const ageYears = typeof c.patientAge === 'number'
      ? c.patientAge
      : parseInt(String(c.patientAge).replace(/[^0-9]/g, ''), 10) || 0;
    const difficulty =
      c.difficulty === 'beginner' ? 'BEGINNER'
      : c.difficulty === 'advanced' ? 'ADVANCED'
      : 'INTERMEDIATE';
    await prisma.caseTemplate.upsert({
      where: { legacyId: c.id },
      update: {
        title: c.title,
        condition: c.condition,
        specialty: c.specialty,
        topicId: topic?.id ?? null,
        bloomsLevel: c.bloomsLevel,
        difficulty,
        estimatedMinutes: c.estimatedMinutes,
        description: c.description,
        patientName: c.patientName,
        patientAgeYears: ageYears,
        patientSex: c.patientGender,
        patientPresentingComplaint: c.description,
        oslerianPrinciples: c.oslerianPrinciples ?? [],
        tags: c.tags ?? [],
        imageCount: c.imageCount ?? 0,
        isEmergency: c.isEmergency ?? false,
      },
      create: {
        legacyId: c.id,
        title: c.title,
        condition: c.condition,
        specialty: c.specialty,
        topicId: topic?.id ?? null,
        bloomsLevel: c.bloomsLevel,
        difficulty,
        estimatedMinutes: c.estimatedMinutes,
        description: c.description,
        patientName: c.patientName,
        patientAgeYears: ageYears,
        patientSex: c.patientGender,
        patientPresentingComplaint: c.description,
        oslerianPrinciples: c.oslerianPrinciples ?? [],
        tags: c.tags ?? [],
        imageCount: c.imageCount ?? 0,
        isEmergency: c.isEmergency ?? false,
        publishedAt: new Date(),
      },
    });
    templateCount++;
    }
    console.log(`   ✓ ${templateCount} case templates`);
  }

  // ─── 8. SAMPLE COURSES (demo-only) ──────────────────────────────────────
  if (SEED_DEMO) {
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
  }

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
  if (SEED_DEMO) {
    console.log('📝 Demo credentials (password: 12345678 except Sandeep):');
    console.log('   9876543210  Sandeep           [ADMIN]            pw: Vaidix@2026!');
    console.log('   9876543211  Arjun Mehta        [RESIDENT]');
    console.log('   9876543212  Dr. Meera Krishnan [FACULTY]');
    console.log('   9876543213  Dr. Rajeev Nair    [PROGRAM_DIRECTOR]');
    console.log('   9876543214  Priya Sharma        [EXTERNAL_LEARNER]');
    console.log('');
  } else {
    console.log('🛡️  PRODUCTION seed: only admin (sandeep@vaidix.local) was created.');
    console.log('   All other users must be invited via /admin/invitations.');
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
