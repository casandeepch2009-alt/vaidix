'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Plus_Jakarta_Sans, DM_Serif_Display } from 'next/font/google';
import styles from './landing.module.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
});

/**
 * Vaidix marketing landing page.
 *
 * Rendered at `/` for unauthenticated visitors (authenticated users are
 * redirected to /dashboard by src/app/page.tsx before this ever mounts).
 *
 * Heads-up: the .mediaFrame blocks under "Hero", "Live Classroom", and
 * "Deck Forge" are placeholders for real product GIFs/MP4s — see the
 * TODO comments next to each. Swap the inner placeholder div for a
 * <video> tag once footage is captured.
 */
export function Landing() {
  const [demoSent, setDemoSent] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Scroll reveal + active nav highlight
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(styles.revealVisible);
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.07 },
    );
    root.querySelectorAll(`.${styles.reveal}`).forEach((el) => observer.observe(el));

    const navSections = ['lxs', 'features', 'ai', 'faculty', 'assessment', 'faq'];
    const onScroll = () => {
      const pos = window.scrollY + 80;
      navSections.forEach((id) => {
        const el = document.getElementById(id);
        const link = root.querySelector<HTMLAnchorElement>(`a[href="#${id}"]`);
        if (!el || !link) return;
        const inSection = el.offsetTop <= pos && el.offsetTop + el.offsetHeight > pos;
        link.style.color = inSection ? '#1e9b8e' : '';
      });
    };
    window.addEventListener('scroll', onScroll);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const handleDemo = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: wire to a real backend endpoint, e.g. POST /api/marketing/demo-requests
    setDemoSent(true);
  };

  return (
    <div ref={rootRef} className={`${jakarta.className} ${styles.root}`}>

      {/* ══════════════════════════ NAV ══════════════════════════ */}
      <nav className={styles.navGlass} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '0 1.5rem', height: 66, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Image src="/vaidix-logo.png" alt="Vaidix" width={36} height={36} priority style={{ height: 36, width: 'auto' }} />
            <span style={{ fontSize: 17, fontWeight: 900, color: '#0d1224', letterSpacing: '-0.01em' }}>Vaidix</span>
            <span className={styles.pill} style={{ fontSize: '0.62rem', padding: '3px 10px' }}>LXS</span>
          </div>

          <div className="hidden md:flex" style={{ alignItems: 'center', gap: 32, fontSize: 13, fontWeight: 600, color: '#4a5370' }}>
            <a href="#lxs">Why LXS</a>
            <a href="#features">Features</a>
            <a href="#ai">AI Core</a>
            <a href="#faculty">For Faculty</a>
            <a href="#assessment">Assessment</a>
            <a href="#faq">FAQ</a>
          </div>

          <div className="hidden md:flex" style={{ alignItems: 'center', gap: 8 }}>
            <Link href="/login" style={{ padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, color: '#252b43' }}>Login</Link>
            <a href="#demo" className={styles.btnPrimary} style={{ padding: '10px 20px', borderRadius: 12, fontSize: 13, textDecoration: 'none' }}>Request Demo →</a>
          </div>
        </div>
      </nav>


      {/* ══════════════════════════ HERO ══════════════════════════ */}
      <section className={styles.heroBg} style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '7rem 1.5rem 5rem', overflow: 'hidden' }}>
        <div className={styles.dotGrid} style={{ position: 'absolute', inset: 0, opacity: 0.6, pointerEvents: 'none' }} />

        <div style={{ position: 'absolute', top: 128, left: -60, width: 420, height: 420, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, rgba(30,155,142,.12), transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: 80, right: -40, width: 340, height: 340, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, rgba(91,111,219,.09), transparent 70%)' }} />

        <div style={{ position: 'relative', zIndex: 10, maxWidth: '72rem', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <div className={styles.pill}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1e9b8e', display: 'inline-block' }} />
              Purpose-built for Medical Residency &amp; Fellowship Programs
            </div>
          </div>

          <h1 style={{ fontSize: 'clamp(58px, 7vw, 84px)', fontWeight: 900, color: '#0d1224', letterSpacing: '-0.025em', lineHeight: 1.02, marginBottom: 28 }}>
            From morning rounds<br />
            <span className={`${dmSerif.className} ${styles.gTeal}`} style={{ fontStyle: 'italic', fontWeight: 400 }}>to mastery.</span>
          </h1>

          <p style={{ fontSize: 20, color: '#343c57', maxWidth: '40rem', margin: '0 auto 40px', lineHeight: 1.6 }}>
            The Learning Xperience System for medical residency — live clinical teaching, AI-guided case learning, and competency assessment in one platform built for the bedside.
          </p>

          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 64, flexWrap: 'wrap' }}>
            <a href="#demo" className={styles.btnPrimary} style={{ padding: '16px 36px', borderRadius: 16, fontSize: 15, textDecoration: 'none' }}>Request a Demo →</a>
            <a href="#features" className={styles.btnGhost} style={{ padding: '16px 36px', borderRadius: 16, fontSize: 15, textDecoration: 'none' }}>See How It Works</a>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '12px 24px', fontSize: 13, color: '#4a5370' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg className={styles.icoSm} viewBox="0 0 24 24" stroke="#1e9b8e"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>
              DPDPA Compliant · PHI Protected
            </div>
            <div style={{ width: 1, height: 16, background: '#c9cedc' }} className="hidden sm:block" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg className={styles.icoSm} viewBox="0 0 24 24" stroke="#1e9b8e"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>
              Indic language support · India-first
            </div>
            <div style={{ width: 1, height: 16, background: '#c9cedc' }} className="hidden sm:block" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg className={styles.icoSm} viewBox="0 0 24 24" stroke="#1e9b8e"><path d="M12 2 4 7v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V7l-8-5z"/></svg>
              Built by clinicians, for clinicians
            </div>
          </div>
        </div>

        {/* Hero product preview — SWAP with real GIF */}
        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '72rem', marginTop: 80, padding: '0 1rem' }} className={styles.float}>
          <div className={styles.mediaFrame}>
            <span className={styles.cornerTag}>PRODUCT PREVIEW</span>
            <div className={styles.mediaBar}>
              <div className={styles.dotR} /><div className={styles.dotY} /><div className={styles.dotG} />
              <span className={styles.mediaBarLabel}>Vaidix · Live Session</span>
              <div className={styles.mediaBarLive}><div className={styles.liveDot} />LIVE</div>
            </div>
            <div className={styles.mediaBody}>
              {/* TODO: replace this block with <video> autoplay loop muted playsinline src="/marketing/hero-live.mp4" */}
              <button type="button" className={styles.playBtn} aria-label="Play product preview">
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </button>
              <div className={styles.mediaTitle}>Watch the live classroom in action</div>
              <div className={styles.mediaSub}>A 30-second walkthrough of a live grand round on Vaidix</div>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════ TESTIMONIAL ══════════════════════════ */}
      <section className={styles.sectionWhite} style={{ padding: '5rem 1.5rem', borderTop: '1px solid #e4e7ef', borderBottom: '1px solid #e4e7ef' }}>
        <div className={styles.reveal} style={{ maxWidth: '48rem', margin: '0 auto' }}>
          <div className={styles.cardWhite} style={{ position: 'relative', padding: 'clamp(40px, 6vw, 56px)', borderRadius: 24 }}>
            <span className={styles.quoteMark}>&ldquo;</span>
            <p style={{ fontSize: 'clamp(24px, 3vw, 28px)', fontWeight: 500, color: '#1a1f33', lineHeight: 1.4, position: 'relative', zIndex: 1 }}>
              Vaidix consolidated four separate tools we used for our residency programme. The faculty time saved is measurable; the resident engagement is undeniable.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 32 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1e9b8e, #2db3aa)' }}>
                <svg className={styles.ico} viewBox="0 0 24 24" stroke="white"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#0d1224' }}>Program Director</div>
                <div style={{ fontSize: 13, color: '#4a5370' }}>Tertiary eye care institute · South India</div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════ STATS ══════════════════════════ */}
      <section className={styles.statsDark} style={{ padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 24 }}>
            {[
              { num: '6', label: 'Clinical learning stages', sub: 'Story to Reflection' },
              { num: '5', label: 'EPA entrustment levels', sub: 'Observation to Supervision' },
              { num: '4', label: 'Kirkpatrick levels', sub: 'Reaction to Patient Outcomes' },
              { num: '3H', label: 'Competency framework', sub: 'Head · Heart · Hands' },
            ].map((s, i) => (
              <div key={i} className={styles.reveal} style={{ textAlign: 'center', transitionDelay: `${i * 0.1}s` }}>
                <div className={styles.gDark} style={{ fontSize: 60, fontWeight: 900, marginBottom: 8 }}>{s.num}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#c9cedc' }}>{s.label}</div>
                <div style={{ fontSize: 11, color: '#6b7494', marginTop: 4 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════ WHY LXS ══════════════════════════ */}
      <section id="lxs" className={styles.sectionLight} style={{ padding: '7rem 1.5rem' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className={styles.reveal} style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className={styles.pill} style={{ marginBottom: 20 }}>Not Your Average LMS</div>
            <h2 style={{ fontSize: 'clamp(44px, 5vw, 56px)', fontWeight: 900, color: '#0d1224', lineHeight: 1.1, marginBottom: 20 }}>
              Why <span className={dmSerif.className} style={{ fontStyle: 'italic', fontWeight: 400 }}>Learning Xperience</span><span className={styles.gTeal}>?</span>
            </h2>
            <p style={{ color: '#343c57', fontSize: 18, maxWidth: '36rem', margin: '0 auto', lineHeight: 1.6 }}>
              LMS platforms deliver content. Vaidix delivers <strong>clinical transformation</strong>.
            </p>
          </div>

          <div className="grid md:grid-cols-2" style={{ gap: 24, marginBottom: 40 }}>
            <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 36 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <div className={styles.iconWrap} style={{ background: '#f0f2f7' }}>
                  <svg className={styles.ico} viewBox="0 0 24 24" stroke="#9aa3bc"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h4"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#9aa3bc', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>Old Paradigm</div>
                  <div style={{ fontWeight: 700, color: '#252b43' }}>Learning Management System</div>
                </div>
              </div>
              <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                {[
                  'Upload slides, record a video, upload a quiz',
                  'Residents consume content passively',
                  'Assessment is a checkbox, not a competency window',
                  'AI is an afterthought — a chatbot in the corner',
                  'Faculty spends 4+ hours per session on admin',
                ].map((t, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#4a5370', marginBottom: 12 }}>
                    <span style={{ color: '#f87171', fontWeight: 700, marginTop: 2 }}>✗</span>{t}
                  </li>
                ))}
              </ul>
            </div>

            <div className={`${styles.gradBorder} ${styles.reveal}`} style={{ background: '#fff' }}>
              <div style={{ padding: 36 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                  <div className={styles.iconWrap} style={{ background: 'rgba(30,155,142,.10)' }}>
                    <svg className={styles.ico} viewBox="0 0 24 24" stroke="#1e9b8e"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#177d73', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>Vaidix</div>
                    <div style={{ fontWeight: 700, color: '#0d1224' }}>Learning Xperience System</div>
                  </div>
                </div>
                <ul className={styles.checkList} style={{ padding: 0, margin: 0 }}>
                  <li>Live sessions with AI engagement scoring + real-time captions</li>
                  <li>AI-guided case dialogues across 6 structured clinical stages</li>
                  <li>DOPS, Mini-CEX, EPA — structured competency assessment</li>
                  <li>Proprietary clinical AI trained for medical education</li>
                  <li>Automated audit trails for accreditation compliance</li>
                </ul>
              </div>
            </div>
          </div>

          <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 36 }}>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <div style={{ fontSize: 11, color: '#9aa3bc', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 8 }}>The 3H Framework</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#0d1224' }}>Three dimensions of clinical mastery</div>
            </div>
            <div className="grid md:grid-cols-3" style={{ gap: 20 }}>
              {[
                { label: 'HEAD', color: '#5B6FDB', text: 'Knowledge depth — pathophysiology, diagnosis, evidence-based protocols', svg: <><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></> },
                { label: 'HEART', color: '#D85D4F', text: 'Clinical empathy — patient communication, ethics, professional behaviour', svg: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/> },
                { label: 'HANDS', color: '#4AB074', text: 'Procedural skill — DOPS-assessed technique and surgical readiness', svg: <><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></> },
              ].map((h, i) => (
                <div key={i} style={{ padding: 28, borderRadius: 16, textAlign: 'center', background: `${h.color}0d`, border: `1px solid ${h.color}26` }}>
                  <div className={styles.iconWrapLg} style={{ margin: '0 auto 16px', background: `${h.color}1a` }}>
                    <svg className={styles.icoLg} viewBox="0 0 24 24" stroke={h.color}>{h.svg}</svg>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8, color: h.color }}>{h.label}</div>
                  <div style={{ fontSize: 13, color: '#343c57' }}>{h.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════ FEATURES ══════════════════════════ */}
      <section id="features" className={styles.sectionWhite} style={{ padding: '7rem 1.5rem' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className={styles.reveal} style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className={styles.pill} style={{ marginBottom: 20 }}>Platform Features</div>
            <h2 style={{ fontSize: 'clamp(44px, 5vw, 56px)', fontWeight: 900, color: '#0d1224', lineHeight: 1.1, marginBottom: 20 }}>
              Every Tool a <span className={styles.gTeal}>Clinical Teacher Needs</span>
            </h2>
          </div>

          {/* 01 Live Classroom */}
          <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 40, marginBottom: 24 }}>
            <div className="grid md:grid-cols-2" style={{ gap: 48, alignItems: 'center' }}>
              <div>
                <div className={styles.chip} style={{ marginBottom: 20 }}>01 — Live Classroom</div>
                <h3 style={{ fontSize: 32, fontWeight: 900, color: '#0d1224', lineHeight: 1.15, marginBottom: 20 }}>Grand Rounds,<br />Reinvented</h3>
                <p style={{ color: '#343c57', lineHeight: 1.65, marginBottom: 24, fontSize: 15 }}>
                  Live teaching sessions with low-latency video, real-time captions in English and Indic languages, interactive Q&amp;A, polls, and breakout rooms. Every session auto-recorded, transcribed, and AI-processed.
                </p>
                <ul className={styles.checkList} style={{ padding: 0, margin: 0 }}>
                  <li>Hospital-grade low-latency video conferencing</li>
                  <li>Live captions in English and Indic languages</li>
                  <li>Interactive hooks: polls, T/F, dilemma prompts</li>
                  <li>Pinned Q&amp;A, hand-raise, threaded replies</li>
                  <li>Breakout rooms with sub-session recording</li>
                </ul>
              </div>
              {/* TODO: replace with <video> for real classroom GIF */}
              <div className={`${styles.mediaFrame} ${styles.floatD}`}>
                <span className={styles.cornerTag}>GIF</span>
                <div className={styles.mediaBar}>
                  <div className={styles.dotR} /><div className={styles.dotY} /><div className={styles.dotG} />
                  <div className={styles.mediaBarLive}><div className={styles.liveDot} />LIVE</div>
                </div>
                <div className={`${styles.mediaBody} ${styles.mediaBodyCompact}`}>
                  <button type="button" className={styles.playBtn} aria-label="Play classroom demo">
                    <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                  <div className={styles.mediaTitle}>Live Classroom Demo</div>
                  <div className={styles.mediaSub}>Captions · Q&amp;A · Polls · Engagement</div>
                </div>
              </div>
            </div>
          </div>

          {/* 02 + 03 */}
          <div className="grid md:grid-cols-2" style={{ gap: 24, marginBottom: 24 }}>
            {/* 02 Case Learning */}
            <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 32 }}>
              <div className={styles.chip} style={{ marginBottom: 16 }}>02 — Case-Based Learning</div>
              <h3 style={{ fontSize: 24, fontWeight: 900, color: '#0d1224', marginBottom: 12 }}>AI Tutor That Thinks Like a Clinician</h3>
              <p style={{ color: '#343c57', fontSize: 14, lineHeight: 1.65, marginBottom: 20 }}>Our proprietary clinical AI guides residents through structured cases across 6 stages — a mentor that prompts, probes, and adapts.</p>
              <div style={{ padding: 16, borderRadius: 16, background: '#f9f9fb', border: '1px solid #e4e7ef', marginBottom: 20 }}>
                <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 2px', background: '#edfaf8', border: '1px solid rgba(30,155,142,.2)', fontSize: 12, color: '#252b43', marginBottom: 10 }}>
                  A 68-year-old presents with 6 months of progressive vision loss. What would you examine first?
                </div>
                <div style={{ padding: '10px 14px', borderRadius: '16px 16px 2px 16px', background: '#fff', border: '1px solid #e4e7ef', fontSize: 12, color: '#252b43', marginBottom: 10, marginLeft: 20 }}>
                  Start with visual acuity — corrected and uncorrected — then slit-lamp for lens clarity...
                </div>
                <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 2px', background: '#edfaf8', border: '1px solid rgba(30,155,142,.2)', fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: '#177d73' }}>Good reasoning.</span> <span style={{ color: '#252b43' }}>Slit-lamp shows posterior subcapsular opacity. How does this shift your differential?</span>
                </div>
              </div>
              <ul className={styles.checkList} style={{ padding: 0, margin: 0, fontSize: 13 }}>
                <li>6 clinical stages: Story → Reflection</li>
                <li>Socratic dialogue — prompts thinking, never spoon-feeds</li>
                <li>Case Forge: generate cases from session transcripts</li>
              </ul>
            </div>

            {/* 03 Deck Forge */}
            <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 32, transitionDelay: '0.15s' }}>
              <div className={styles.chip} style={{ marginBottom: 16 }}>03 — Deck Forge</div>
              <h3 style={{ fontSize: 24, fontWeight: 900, color: '#0d1224', marginBottom: 12 }}>Upload a PDF.<br />Get a Teaching Deck.</h3>
              <p style={{ color: '#343c57', fontSize: 14, lineHeight: 1.65, marginBottom: 20 }}>Upload any document. AI extracts teaching points, generates slide structure, produces export-ready decks — in minutes.</p>
              {/* TODO: replace with <video> for real deck forge GIF */}
              <div className={styles.mediaFrame} style={{ marginBottom: 20 }}>
                <span className={styles.cornerTag}>GIF</span>
                <div className={styles.mediaBar}>
                  <div className={styles.dotR} /><div className={styles.dotY} /><div className={styles.dotG} />
                  <span className={styles.mediaBarLabel}>Deck Forge</span>
                </div>
                <div className={`${styles.mediaBody} ${styles.mediaBodyCompact}`}>
                  <button type="button" className={styles.playBtn} aria-label="Play deck forge demo">
                    <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </button>
                  <div className={styles.mediaTitle}>PDF → Teaching Deck</div>
                  <div className={styles.mediaSub}>Watch the full transformation in 15 seconds</div>
                </div>
              </div>
              <ul className={styles.checkList} style={{ padding: 0, margin: 0, fontSize: 13 }}>
                <li>Saves faculty 4+ hours of prep per session</li>
                <li>AI suggestions: add, reorder, cut</li>
                <li>Exports to fully editable PPTX</li>
              </ul>
            </div>
          </div>

          {/* Blueprint + Pearl */}
          <div className="grid md:grid-cols-2" style={{ gap: 24 }}>
            <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 32 }}>
              <div className={styles.iconWrapLg} style={{ marginBottom: 20, background: 'rgba(30,155,142,.10)' }}>
                <svg className={styles.icoLg} viewBox="0 0 24 24" stroke="#1e9b8e"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/></svg>
              </div>
              <div style={{ fontWeight: 900, color: '#0d1224', fontSize: 18, marginBottom: 8 }}>Blueprint Generator</div>
              <p style={{ color: '#343c57', fontSize: 14, lineHeight: 1.65, marginBottom: 16 }}>AI generates a pre-session teaching roadmap — objectives, key questions, suggested interactive moments — for your topic and audience.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className={styles.chip}>Learning objectives</span><span className={styles.chip}>Pre-session Q-bank</span>
              </div>
            </div>
            <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 32, transitionDelay: '0.15s' }}>
              <div className={styles.iconWrapLg} style={{ marginBottom: 20, background: 'rgba(30,155,142,.10)' }}>
                <svg className={styles.icoLg} viewBox="0 0 24 24" stroke="#1e9b8e"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/></svg>
              </div>
              <div style={{ fontWeight: 900, color: '#0d1224', fontSize: 18, marginBottom: 8 }}>Pearl Library + WhatsApp</div>
              <p style={{ color: '#343c57', fontSize: 14, lineHeight: 1.65, marginBottom: 16 }}>Microlearning &ldquo;pearls&rdquo; — bite-sized clinical facts and tips — delivered to residents&apos; WhatsApp. Learning that fits in the OT corridor.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className={styles.chip}>WhatsApp delivery</span><span className={styles.chip}>Scheduled sends</span>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════ AI ══════════════════════════ */}
      <section id="ai" className={styles.statsDark} style={{ padding: '7rem 1.5rem' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className={styles.reveal} style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className={styles.pillDark} style={{ marginBottom: 20 }}>Vaidix Intelligence</div>
            <h2 style={{ fontSize: 'clamp(44px, 5vw, 56px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 20 }}>
              Purpose-built AI.<br /><span className={`${dmSerif.className} ${styles.gDark}`} style={{ fontStyle: 'italic', fontWeight: 400 }}>Not a bolted-on chatbot.</span>
            </h2>
            <p style={{ color: '#6b7494', fontSize: 18, maxWidth: '40rem', margin: '0 auto', lineHeight: 1.6 }}>
              Every capability is powered by purpose-trained clinical AI — built for medical education, not adapted from a generic assistant.
            </p>
          </div>

          <div className="grid md:grid-cols-3" style={{ gap: 20, marginBottom: 40 }}>
            {[
              { title: 'Clinical AI Tutor', sub: 'Vaidix Core', color: '#5dd4ca', bg: 'rgba(30,155,142,.15)', desc: 'Trained on medical literature, guides residents through case discussions with speciality-specific precision.', chips: ['Case dialogue', 'Gap detection'], svg: <><circle cx="12" cy="2.5" r="1.5"/><circle cx="19.5" cy="19.5" r="1.5"/><circle cx="4.5" cy="14.5" r="1.5"/><path d="M16 22s-1-1.5-2-2.5C13 18.5 11 17 9 17a4 4 0 0 1-4-4c0-2 2-4 4-4 1 0 3 .5 4 1.5l1 1"/><path d="m12 4 4 4M16 4l-4 4"/></> },
              { title: 'Content Intelligence', sub: 'Reasoning Engine', color: '#93a3f8', bg: 'rgba(91,111,219,.15)', desc: 'Deep clinical reasoning for content quality — reviews case accuracy, structures decks, scores assessments.', chips: ['Content review', 'Deck design'], svg: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/> },
              { title: 'Language Engine', sub: 'Multimodal & Multilingual', color: '#6ee7b7', bg: 'rgba(74,176,116,.12)', desc: 'Clinical illustrations, Indic language support, and intelligent document classification for content ingestion.', chips: ['Image generation', 'Indic language'], svg: <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></> },
            ].map((p, i) => (
              <div key={i} className={`${styles.cardDark} ${styles.reveal}`} style={{ padding: 28, transitionDelay: `${i * 0.15}s` }}>
                <div className={styles.iconWrapLg} style={{ marginBottom: 20, background: p.bg }}>
                  <svg className={styles.icoLg} viewBox="0 0 24 24" stroke={p.color}>{p.svg}</svg>
                </div>
                <div style={{ fontWeight: 900, fontSize: 18, color: p.color, marginBottom: 4 }}>{p.title}</div>
                <div style={{ fontSize: 11, color: '#6b7494', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 12 }}>{p.sub}</div>
                <p style={{ color: '#6b7494', fontSize: 13, lineHeight: 1.65, marginBottom: 16 }}>{p.desc}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {p.chips.map((c) => <span key={c} className={styles.chipDark}>{c}</span>)}
                </div>
              </div>
            ))}
          </div>

          {/* Engagement Intelligence */}
          <div className={`${styles.cardDark} ${styles.reveal}`} style={{ padding: 36 }}>
            <div className="grid md:grid-cols-2" style={{ gap: 40, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 20, color: '#fff', marginBottom: 12 }}>Engagement Intelligence</div>
                <p style={{ color: '#6b7494', fontSize: 14, lineHeight: 1.65, marginBottom: 20 }}>Vaidix tracks attention, participation, and interaction patterns — delivering real-time alerts to the presenter so no resident gets lost silently.</p>
                <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                  {['Attention drop detection — immediate presenter alert', 'Silent participant identification', 'Interaction scoring across polls, chat, Q&A, reactions', 'Post-session Kirkpatrick 1–4 evaluation'].map((t, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#c9cedc', marginBottom: 10 }}>
                      <span style={{ color: '#2db3aa', fontWeight: 700, marginTop: 2 }}>→</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: 16, borderRadius: 16, background: 'rgba(74,176,116,.07)', border: '1px solid rgba(74,176,116,.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#6ee7b7' }}>Session Engagement</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#6ee7b7' }}>87%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.1)' }}>
                    <div className={styles.growBar} style={{ '--w': '87%', height: 8, borderRadius: 999, background: 'linear-gradient(90deg,#1e9b8e,#4AB074)' } as React.CSSProperties} />
                  </div>
                </div>
                <div style={{ padding: 16, borderRadius: 16, background: 'rgba(30,155,142,.07)', border: '1px solid rgba(30,155,142,.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2db3aa' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#5dd4ca' }}>Presenter Alert</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#6b7494' }}>3 participants silent for 8 min — consider launching a poll now</p>
                </div>
                <div style={{ padding: 16, borderRadius: 16, background: 'rgba(91,111,219,.07)', border: '1px solid rgba(91,111,219,.2)' }}>
                  <div style={{ fontSize: 10, color: '#6b7494', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>AI Post-Session Summary</div>
                  {[['Clinical accuracy', '94/100'], ['Avg engagement', 'High'], ['Objectives covered', '5 of 6']].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                      <span style={{ color: '#6b7494' }}>{k}</span>
                      <span style={{ fontWeight: 700, color: '#93a3f8' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════ FACULTY ══════════════════════════ */}
      <section id="faculty" className={styles.sectionLight} style={{ padding: '7rem 1.5rem' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className={styles.reveal} style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className={styles.pill} style={{ marginBottom: 20 }}>Faculty Enablement</div>
            <h2 style={{ fontSize: 'clamp(44px, 5vw, 56px)', fontWeight: 900, color: '#0d1224', lineHeight: 1.1, marginBottom: 20 }}>
              Built to Give Faculty<br /><span className={styles.gTeal}>Their Time Back</span>
            </h2>
            <p style={{ color: '#343c57', fontSize: 18, maxWidth: '36rem', margin: '0 auto' }}>Automate the repetitive. Surface the important. Give clinicians superpowers, not more screens.</p>
          </div>

          <div className="grid md:grid-cols-2" style={{ gap: 24, marginBottom: 24 }}>
            <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 32 }}>
              <div className={styles.iconWrapLg} style={{ marginBottom: 20, background: 'rgba(30,155,142,.10)' }}>
                <svg className={styles.icoLg} viewBox="0 0 24 24" stroke="#1e9b8e"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              </div>
              <div style={{ fontWeight: 900, color: '#0d1224', fontSize: 18, marginBottom: 8 }}>Smart Session Scheduling</div>
              <p style={{ color: '#343c57', fontSize: 14, lineHeight: 1.65, marginBottom: 16 }}>Schedule, invite, set approval flows, add recurrence, sync to iCal — with conflict detection and host overlap warnings.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className={styles.chip}>iCal sync</span><span className={styles.chip}>Approval flow</span><span className={styles.chip}>Recurrence</span>
              </div>
            </div>
            <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 32, transitionDelay: '0.1s' }}>
              <div className={styles.iconWrapLg} style={{ marginBottom: 20, background: 'rgba(30,155,142,.10)' }}>
                <svg className={styles.icoLg} viewBox="0 0 24 24" stroke="#1e9b8e"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
              </div>
              <div style={{ fontWeight: 900, color: '#0d1224', fontSize: 18, marginBottom: 8 }}>Recording + AI Transcription</div>
              <p style={{ color: '#343c57', fontSize: 14, lineHeight: 1.65, marginBottom: 16 }}>Every session auto-recorded, transcoded, transcribed in English + Indic, and streamed via CDN with expiry-controlled share links.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className={styles.chip}>HLS streaming</span><span className={styles.chip}>Multi-language</span><span className={styles.chip}>Share tokens</span>
              </div>
            </div>
          </div>

          {/* Journal Coach */}
          <div className={`${styles.gradBorder} ${styles.reveal}`} style={{ background: '#fff' }}>
            <div style={{ padding: 40 }}>
              <div className="grid md:grid-cols-5" style={{ gap: 32, alignItems: 'center' }}>
                <div className="md:col-span-3">
                  <div style={{ fontSize: 11, color: '#177d73', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 12 }}>Reflective Learning</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div className={styles.iconWrap} style={{ background: 'rgba(30,155,142,.10)' }}>
                      <svg className={styles.ico} viewBox="0 0 24 24" stroke="#1e9b8e"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#0d1224', lineHeight: 1.15 }}>Journal + AI Coach</div>
                  </div>
                  <p style={{ color: '#343c57', fontSize: 14, lineHeight: 1.65, marginBottom: 20 }}>Residents log clinical reflections. The AI coach reads each entry, identifies gaps, and offers a Socratic prompt — not an answer.</p>
                  <ul className={styles.checkList} style={{ padding: 0, margin: 0 }}>
                    <li>Structured reflection with Gibbs/Johns framework</li>
                    <li>AI coaching prompts — guides thinking, not spoon-feeds</li>
                    <li>Faculty can review and comment on entries</li>
                    <li>Longitudinal insights across rotations</li>
                  </ul>
                </div>
                <div className="md:col-span-2" style={{ padding: 20, borderRadius: 16, background: '#edfaf8', border: '1px solid rgba(30,155,142,.15)' }}>
                  <div style={{ fontSize: 10, color: '#9aa3bc', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 12 }}>Today&apos;s Reflection</div>
                  <p style={{ fontSize: 13, color: '#252b43', fontStyle: 'italic', lineHeight: 1.6, marginBottom: 12 }}>&ldquo;I struggled to differentiate OCT patterns between NTG and POAG during rounds today...&rdquo;</p>
                  <div style={{ padding: 14, borderRadius: 12, background: '#fff', border: '1px solid rgba(30,155,142,.18)', fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: '#177d73' }}>Vaidix Coach: </span>
                    <span style={{ color: '#343c57' }}>What structural differences were you expecting, and what did you actually observe?</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════ ASSESSMENT ══════════════════════════ */}
      <section id="assessment" className={styles.sectionWhite} style={{ padding: '7rem 1.5rem' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className={styles.reveal} style={{ textAlign: 'center', marginBottom: 64 }}>
            <div className={styles.pill} style={{ marginBottom: 20 }}>Competency Assessment</div>
            <h2 style={{ fontSize: 'clamp(44px, 5vw, 56px)', fontWeight: 900, color: '#0d1224', lineHeight: 1.1, marginBottom: 20 }}>
              Assessment That <span className={styles.gTeal}>Proves Competence</span>
            </h2>
            <p style={{ color: '#343c57', fontSize: 18, maxWidth: '36rem', margin: '0 auto' }}>DOPS, Mini-CEX, and EPA tracking embedded in your clinical workflow — digitally, traceably, accreditation-ready.</p>
          </div>

          <div className="grid md:grid-cols-3" style={{ gap: 20, marginBottom: 24 }}>
            {[
              { title: 'DOPS', sub: 'Direct Observation of Procedural Skills', color: '#1e9b8e', bg: 'rgba(30,155,142,.10)', text: 'Faculty complete structured forms digitally while observing procedures. AI pre-fills criteria based on case context.', svg: <><path d="M6 18h8M3 22h18M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12 7 4l4-1 2 7"/></> },
              { title: 'Mini-CEX', sub: 'Mini Clinical Evaluation Exercise', color: '#5B6FDB', bg: 'rgba(91,111,219,.10)', text: 'Evaluate history-taking, examination, reasoning, and communication in real encounters — mobile-first, under 5 minutes.', svg: <><path d="M11 2v4a4 4 0 0 1-8 0V2"/><path d="M3 2h8M11 14a4 4 0 0 0 8 0v-4"/><circle cx="19" cy="6" r="3"/><path d="M7 6v2a4 4 0 0 0 4 4v0a4 4 0 0 0 4-4"/></> },
              { title: 'EPA Tracking', sub: 'Entrustable Professional Activities', color: '#4AB074', bg: 'rgba(74,176,116,.10)', text: 'Track progression through 5 entrustment levels — from observation only to supervising others. Visual milestone dashboard.', svg: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></> },
            ].map((a, i) => (
              <div key={i} className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 28, transitionDelay: `${i * 0.1}s` }}>
                <div className={styles.iconWrapLg} style={{ marginBottom: 20, background: a.bg }}>
                  <svg className={styles.icoLg} viewBox="0 0 24 24" stroke={a.color}>{a.svg}</svg>
                </div>
                <div style={{ fontWeight: 900, fontSize: 18, color: a.color, marginBottom: 4 }}>{a.title}</div>
                <div style={{ fontSize: 10, color: '#9aa3bc', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 12 }}>{a.sub}</div>
                <p style={{ fontSize: 13, color: '#343c57', lineHeight: 1.65 }}>{a.text}</p>
              </div>
            ))}
          </div>

          <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 36 }}>
            <div className="grid md:grid-cols-2" style={{ gap: 40 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 24, color: '#0d1224', marginBottom: 12 }}>Kirkpatrick 4-Level Evaluation</div>
                <p style={{ fontSize: 14, color: '#343c57', marginBottom: 24, lineHeight: 1.65 }}>Every session evaluated across all four Kirkpatrick levels.</p>
                {[
                  { l: 'L1', label: 'Reaction',  desc: 'Did residents find it valuable?',     bg: '#2db3aa' },
                  { l: 'L2', label: 'Learning',  desc: 'Did knowledge and skills improve?',  bg: '#1e9b8e' },
                  { l: 'L3', label: 'Behaviour', desc: 'Did clinical practice change?',      bg: '#177d73' },
                  { l: 'L4', label: 'Results',   desc: 'Did patient outcomes improve?',      bg: '#13635b' },
                ].map((k) => (
                  <div key={k.l} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff', flexShrink: 0, background: k.bg }}>{k.l}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f33' }}>{k.label}</div>
                      <div style={{ fontSize: 12, color: '#4a5370' }}>{k.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 24, color: '#0d1224', marginBottom: 12 }}>Resident Portfolio</div>
                {[
                  { k: 'DOPS Completed',   v: '12 / 20',     color: '#177d73' },
                  { k: 'Mini-CEX Logged',  v: '8 / 12',      color: '#177d73' },
                  { k: 'EPA Level (Phaco)', v: 'Level 3 → 4', color: '#5B6FDB' },
                  { k: 'Cases Completed',  v: '34',          color: '#177d73' },
                ].map((p) => (
                  <div key={p.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 12, background: '#f9f9fb', border: '1px solid #e4e7ef', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: '#252b43' }}>{p.k}</span>
                    <span style={{ fontWeight: 900, color: p.color }}>{p.v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 16, border: '2px solid rgba(45,179,170,.5)', background: '#edfaf8' }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#115450' }}>Overall 3H Score</span>
                  <span style={{ fontWeight: 900, color: '#0d1224', fontSize: 20 }}>82<span style={{ fontSize: 16, color: '#4a5370' }}>/100</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════ TRUST ══════════════════════════ */}
      <section className={styles.statsDark} style={{ padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className={styles.reveal} style={{ textAlign: 'center', marginBottom: 40 }}>
            <div className={styles.pillDark} style={{ marginBottom: 16 }}>Trust &amp; Compliance</div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 900, color: '#fff', marginBottom: 12 }}>
              Built for India&apos;s <span className={`${dmSerif.className} ${styles.gDark}`} style={{ fontStyle: 'italic', fontWeight: 400 }}>Clinical Standards</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4" style={{ gap: 16 }}>
            {[
              { title: 'DPDPA Compliant', text: 'Access, erasure, and export requests built into the platform', svg: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></> },
              { title: 'PHI Protection',  text: 'Patient data scanning and consent management before any AI processing', svg: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></> },
              { title: 'Full Audit Trail', text: 'Every action logged with PII-safe hashing for accreditation review', svg: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></> },
              { title: 'India-First',     text: 'Indian cloud region, Indic captions, NMC-aligned competency framework', svg: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></> },
            ].map((t, i) => (
              <div key={i} className={`${styles.cardDark} ${styles.reveal}`} style={{ padding: 24, transitionDelay: `${i * 0.1}s` }}>
                <div className={styles.iconWrap} style={{ marginBottom: 16, background: 'rgba(45,179,170,.12)' }}>
                  <svg className={styles.ico} viewBox="0 0 24 24" stroke="#5dd4ca">{t.svg}</svg>
                </div>
                <div style={{ fontWeight: 900, color: '#fff', marginBottom: 8 }}>{t.title}</div>
                <p style={{ fontSize: 12, color: '#6b7494' }}>{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════ FAQ ══════════════════════════ */}
      <section id="faq" className={styles.sectionWhite} style={{ padding: '7rem 1.5rem' }}>
        <div style={{ maxWidth: '48rem', margin: '0 auto' }}>
          <div className={styles.reveal} style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className={styles.pill} style={{ marginBottom: 20 }}>Common Questions</div>
            <h2 style={{ fontSize: 'clamp(40px, 5vw, 52px)', fontWeight: 900, color: '#0d1224', lineHeight: 1.1, marginBottom: 16 }}>
              Questions <span className={`${dmSerif.className} ${styles.gTeal}`} style={{ fontStyle: 'italic', fontWeight: 400 }}>Worth Asking</span>
            </h2>
            <p style={{ color: '#343c57' }}>Direct answers to what Program Directors actually want to know.</p>
          </div>

          <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 16 }}>
            {[
              ['How long does implementation take?', 'Typical rollout is 2–4 weeks for a single residency programme. Week 1 covers setup, programme structure import, and faculty onboarding. Week 2 handles resident provisioning and your first live sessions. Weeks 3–4 enable assessment workflows and AI features at your pace.'],
              ['Is patient data safe? What about PHI?', 'Yes. Vaidix is DPDPA-compliant with PHI scanning at upload, tiered classification, and consent management before any AI processing. All data resides in an Indian cloud region. Every action is logged with PII-safe hashing for accreditation audits.'],
              ['Can it integrate with our existing systems (HMS / LMS / SSO)?', 'Yes — Vaidix supports SSO via institutional identity providers, calendar sync via iCal, and structured export for legacy LMS or HMS integration. Custom integrations are available for enterprise tiers.'],
              ['Which specialties is Vaidix built for?', 'Ophthalmology is the deepest specialty today, with curriculum, case templates, and AI tuning purpose-built for it. The platform architecture is specialty-agnostic — additional specialties (paediatrics, internal medicine, surgery) are progressively onboarded with their respective faculty partners.'],
              ['Will it work in low-bandwidth hospitals?', 'Yes. Live video adapts to available bandwidth, recordings are available for low-latency offline playback, and WhatsApp microlearning works on any phone signal. Mobile-first design throughout — residents can complete assessments from their phones in clinic.'],
              ['How does pricing work?', 'Per-programme annual licensing, scaled by resident count, with no per-feature gates — every institution gets the full platform. Pilot pricing is available for first-year partners. Request a demo for a tailored quote.'],
            ].map(([q, a], i) => (
              <details key={i} className={styles.faqItem} style={{ paddingLeft: 20, paddingRight: 20 }}>
                <summary>{q}</summary>
                <div className={styles.faqBody}>{a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════ DEMO CTA ══════════════════════════ */}
      <section id="demo" className={styles.ctaBg} style={{ padding: '7rem 1.5rem' }}>
        <div style={{ maxWidth: '48rem', margin: '0 auto' }}>
          <div className={styles.reveal} style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ fontSize: 'clamp(42px, 5vw, 54px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 16 }}>
              Ready to Transform<br />Your <span className={`${dmSerif.className} ${styles.gDark}`} style={{ fontStyle: 'italic', fontWeight: 400 }}>Residency Program</span>?
            </h2>
            <p style={{ color: '#5dd4ca', fontSize: 18 }}>
              Request a personalised demo and see how Vaidix fits your specialty.
            </p>
          </div>

          <div className={styles.reveal} style={{ background: '#fff', borderRadius: 24, padding: 40, boxShadow: '0 25px 50px -12px rgba(0,0,0,.4)' }}>
            {!demoSent ? (
              <form onSubmit={handleDemo} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div><label className={styles.flabel}>Your Name</label><input type="text" className={styles.finput} placeholder="Dr. Ramesh Kumar" required /></div>
                  <div>
                    <label className={styles.flabel}>Role</label>
                    <select className={styles.finput} required defaultValue="" style={{ appearance: 'none' }}>
                      <option value="" disabled>Select role</option>
                      <option>Program Director</option>
                      <option>Faculty / Senior Resident</option>
                      <option>Hospital Administrator</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div><label className={styles.flabel}>Institution</label><input type="text" className={styles.finput} placeholder="AIIMS / Sankara Nethralaya / ..." required /></div>
                <div><label className={styles.flabel}>Work Email</label><input type="email" className={styles.finput} placeholder="you@hospital.org" required /></div>
                <div><label className={styles.flabel}>Specialty</label><input type="text" className={styles.finput} placeholder="Ophthalmology, Internal Medicine, ..." /></div>
                <button type="submit" className={styles.btnPrimary} style={{ width: '100%', padding: 16, borderRadius: 16, fontSize: 15, marginTop: 8 }}>Request My Demo →</button>
                <p style={{ fontSize: 12, color: '#9aa3bc', textAlign: 'center' }}>No commitment. Our team will be in touch within 48 hours.</p>
                <div style={{ paddingTop: 12, borderTop: '1px solid #e4e7ef', textAlign: 'center' }}>
                  <span style={{ fontSize: 13, color: '#4a5370' }}>Already have an account? </span>
                  <Link href="/login" style={{ fontSize: 13, fontWeight: 700, color: '#177d73' }}>Login →</Link>
                </div>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', background: 'rgba(74,176,116,.1)', border: '2px solid #4AB074' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4AB074" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#0d1224', marginBottom: 8 }}>Request submitted!</div>
                <div style={{ fontSize: 14, color: '#4a5370' }}>We&apos;ll be in touch within 48 hours.</div>
              </div>
            )}
          </div>
        </div>
      </section>


      {/* ══════════════════════════ FOOTER ══════════════════════════ */}
      <footer style={{ background: '#060913', padding: '4rem 1.5rem' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className="flex flex-col md:flex-row" style={{ justifyContent: 'space-between', gap: 48, marginBottom: 48 }}>
            <div style={{ maxWidth: '20rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ background: '#fff', borderRadius: 8, padding: 4, lineHeight: 0 }}>
                  <Image src="/vaidix-logo.png" alt="Vaidix" width={32} height={32} style={{ height: 32, width: 'auto' }} />
                </div>
                <span style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>Vaidix</span>
                <span className={styles.pillDark} style={{ fontSize: '0.6rem', padding: '3px 9px' }}>LXS</span>
              </div>
              <p style={{ fontSize: 13, color: '#6b7494', lineHeight: 1.6 }}>The Learning Xperience System for medical residency. Built by clinicians, for clinicians.</p>
            </div>
            <div className="grid grid-cols-3" style={{ gap: 40, fontSize: 13 }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, marginBottom: 12 }}>Platform</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 8 }}><a href="#features" style={{ color: '#6b7494' }}>Live Classroom</a></li>
                  <li style={{ marginBottom: 8 }}><a href="#features" style={{ color: '#6b7494' }}>Case Learning</a></li>
                  <li style={{ marginBottom: 8 }}><a href="#features" style={{ color: '#6b7494' }}>Deck Forge</a></li>
                  <li style={{ marginBottom: 8 }}><a href="#assessment" style={{ color: '#6b7494' }}>Assessment</a></li>
                </ul>
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, marginBottom: 12 }}>For Faculty</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 8 }}><a href="#faculty" style={{ color: '#6b7494' }}>Session Tools</a></li>
                  <li style={{ marginBottom: 8 }}><a href="#faculty" style={{ color: '#6b7494' }}>Blueprint AI</a></li>
                  <li style={{ marginBottom: 8 }}><a href="#faculty" style={{ color: '#6b7494' }}>Pearl Library</a></li>
                  <li style={{ marginBottom: 8 }}><a href="#faculty" style={{ color: '#6b7494' }}>Journal Coach</a></li>
                </ul>
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, marginBottom: 12 }}>Company</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 8 }}><a href="#demo" style={{ color: '#6b7494' }}>Request Demo</a></li>
                  <li style={{ marginBottom: 8 }}><Link href="/login" style={{ color: '#6b7494' }}>Login</Link></li>
                  <li style={{ marginBottom: 8 }}><a href="#faq" style={{ color: '#6b7494' }}>FAQ</a></li>
                  <li style={{ color: '#343c57' }}>contact@vaidix.ai</li>
                </ul>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 24, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 11, color: '#343c57', flexWrap: 'wrap' }}>
            <div>© 2026 Vaidix. All rights reserved. Built for clinical excellence.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2db3aa' }} />
              <span>Indian Cloud Region · DPDPA Compliant</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
