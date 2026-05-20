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
 * Structure: Hero → LVPEI strip → Big claim → 3H framework → Stats →
 * Lifecycle overview (Plan / Teach / Master) → Pre-Conference module →
 * Live-Conference module → Post-Conference module → AI Core → Testimonial →
 * Trust strip → FAQ → Demo CTA → Footer.
 *
 * Heads-up: the .mediaFrame blocks are placeholders for real product
 * GIFs/MP4s. Swap the inner placeholder div for a <video> tag once
 * footage is captured.
 */
export function Landing() {
  const [demoSent, setDemoSent] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

    const navSections = ['lifecycle', 'pre', 'live', 'post', 'ai', 'faq'];
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
            <div className={styles.navLogoWrap}>
              <span aria-hidden className={styles.navLogoHalo} />
              <Image
                src="/logo.png"
                alt="Vaidix"
                width={44}
                height={44}
                priority
                className={styles.navLogoImg}
              />
            </div>
            <span style={{ fontSize: 17, fontWeight: 900, color: '#0d1224', letterSpacing: '-0.01em' }}>Vaidix</span>
            <span className={styles.pill} style={{ fontSize: '0.62rem', padding: '3px 10px' }}>LXS</span>
          </div>

          <div className="hidden md:flex" style={{ alignItems: 'center', gap: 28, fontSize: 13, fontWeight: 600, color: '#4a5370' }}>
            <a href="#lifecycle">The Lifecycle</a>
            <a href="#pre">Pre</a>
            <a href="#live">Live</a>
            <a href="#post">Post</a>
            <a href="#ai">AI Core</a>
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
              A Cognitive Gymnasium for Medical Training
            </div>
          </div>

          <h1 style={{ fontSize: 'clamp(54px, 6.6vw, 80px)', fontWeight: 900, color: '#0d1224', letterSpacing: '-0.025em', lineHeight: 1.02, marginBottom: 28 }}>
            We don&apos;t build video conferencing.<br />
            <span className={`${dmSerif.className} ${styles.gTeal}`} style={{ fontStyle: 'italic', fontWeight: 400 }}>We build cognitive gymnasiums.</span>
          </h1>

          <p style={{ fontSize: 20, color: '#343c57', maxWidth: '44rem', margin: '0 auto 40px', lineHeight: 1.6 }}>
            Compassionate, AI-powered training grounds where students become <strong>3H doctors</strong> — Head, Heart, Hands. End-to-end, from morning rounds to mastery.
          </p>

          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 56, flexWrap: 'wrap' }}>
            <a href="#demo" className={styles.btnPrimary} style={{ padding: '16px 36px', borderRadius: 16, fontSize: 15, textDecoration: 'none' }}>Request a Demo →</a>
            <a href="#lifecycle" className={styles.btnGhost} style={{ padding: '16px 36px', borderRadius: 16, fontSize: 15, textDecoration: 'none' }}>See the Lifecycle</a>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '12px 24px', fontSize: 13, color: '#4a5370' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg className={styles.icoSm} viewBox="0 0 24 24" stroke="#1e9b8e"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></svg>
              AI trained for ophthalmology
            </div>
            <div style={{ width: 1, height: 16, background: '#c9cedc' }} className="hidden sm:block" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg className={styles.icoSm} viewBox="0 0 24 24" stroke="#1e9b8e"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>
              English + Indic captions
            </div>
            <div style={{ width: 1, height: 16, background: '#c9cedc' }} className="hidden sm:block" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg className={styles.icoSm} viewBox="0 0 24 24" stroke="#1e9b8e"><path d="M12 2 4 7v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V7l-8-5z"/></svg>
              Built by clinicians, for clinicians
            </div>
          </div>
        </div>

        {/* Hero product preview — SWAP with real GIF */}
        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '72rem', marginTop: 64, padding: '0 1rem' }} className={styles.float}>
          <div className={styles.mediaFrame}>
            <span className={styles.cornerTag}>PRODUCT PREVIEW</span>
            <div className={styles.mediaBar}>
              <div className={styles.dotR} /><div className={styles.dotY} /><div className={styles.dotG} />
              <span className={styles.mediaBarLabel}>Vaidix · Live Session</span>
              <div className={styles.mediaBarLive}><div className={styles.liveDot} />LIVE</div>
            </div>
            <div className={styles.liveMockBody}>
              {/* Speaker tile (presenter) */}
              <div className={`${styles.mockTile} ${styles.mockTilePresenter} ${styles.tileBreathe}`} style={{ position: 'absolute', top: '5%', left: '3%', width: '58%', height: '62%' }}>
                <div style={{ position: 'absolute', top: 10, left: 12, fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,.9)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Presenter</div>
                <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.25)', border: '1.5px solid rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff' }}>PS</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>Dr. Priya Sharma</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.7)', marginTop: 2 }}>Glaucoma · LVPEI</div>
                  </div>
                </div>
              </div>

              {/* Participant tiles (right grid) */}
              <div style={{ position: 'absolute', top: '5%', right: '3%', width: '34%', height: '62%', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 6 }}>
                {[
                  { c: styles.mockTileA, initials: 'AR', label: 'Arjun' },
                  { c: styles.mockTileB, initials: 'NK', label: 'Neha' },
                  { c: styles.mockTileC, initials: 'SK', label: 'Sahil' },
                  { c: styles.mockTileD, initials: '+12', label: '12 more' },
                ].map((t) => (
                  <div key={t.initials} className={`${styles.mockTile} ${t.c}`}>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: 'rgba(255,255,255,.9)' }}>{t.initials}</div>
                    <div style={{ position: 'absolute', bottom: 4, left: 6, fontSize: 8, color: 'rgba(255,255,255,.75)', fontWeight: 600 }}>{t.label}</div>
                  </div>
                ))}
              </div>

              {/* Live caption */}
              <div style={{ position: 'absolute', bottom: '20%', left: '3%', right: '38%', padding: '8px 12px', background: 'rgba(13,18,36,0.92)', borderRadius: 10, color: '#fff', boxShadow: '0 4px 16px rgba(13,18,36,.18)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#5dd4ca" strokeWidth={2.4} strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#5dd4ca', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live caption · EN</span>
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.4, color: '#e4e7ef' }}>
                  &ldquo;Slit-lamp shows posterior subcapsular opacity — how does this shift your differential?&rdquo;
                </div>
              </div>

              {/* Engagement KPI */}
              <div style={{ position: 'absolute', bottom: '6%', right: '3%', width: '34%', padding: 12, background: '#fff', borderRadius: 12, border: '1px solid rgba(74,176,116,.28)', boxShadow: '0 4px 14px rgba(30,155,142,.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#177d73', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Engagement</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#177d73' }}>87%</span>
                </div>
                <div style={{ height: 5, borderRadius: 999, background: 'rgba(30,155,142,.12)' }}>
                  <div className={styles.growBar} style={{ '--w': '87%', height: 5, borderRadius: 999, background: 'linear-gradient(90deg,#1e9b8e,#4AB074)' } as React.CSSProperties} />
                </div>
                <div style={{ fontSize: 9, color: '#4a5370', marginTop: 6 }}>↑ Trending up · 5 min</div>
              </div>

              {/* Presenter alert */}
              <div className={styles.alertPop} style={{ position: 'absolute', bottom: '3%', left: '3%', right: '38%', padding: '7px 11px', background: 'linear-gradient(135deg, rgba(30,155,142,.95), rgba(45,179,170,.95))', borderRadius: 10, color: '#fff', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 6px 20px rgba(30,155,142,.35)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m13 2-3 7h7l-9 13 3-9H4l9-11z"/></svg>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.03em' }}>Presenter alert: 3 silent for 8 min — try a poll</span>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════ LVPEI COLLABORATION STRIP ══════════════════════════ */}
      <section style={{ background: '#ffffff', padding: '2.25rem 1.5rem', borderTop: '1px solid #e4e7ef', borderBottom: '1px solid #e4e7ef' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '16px 28px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={styles.pill} style={{ background: 'rgba(91,111,219,.08)', color: '#5B6FDB', borderColor: 'rgba(91,111,219,.22)' }}>Collaboration</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0d1224' }}>In partnership with LV Prasad Eye Institute</span>
          </div>
          <div style={{ width: 1, height: 18, background: '#c9cedc' }} className="hidden sm:block" />
          <span style={{ fontSize: 13, color: '#4a5370' }}>Ophthalmology curriculum co-designed with LVPEI teachers.</span>
        </div>
      </section>


      {/* ══════════════════════════ THE BIG CLAIM ══════════════════════════ */}
      <section className={styles.sectionLight} style={{ padding: '6rem 1.5rem' }}>
        <div className={styles.reveal} style={{ maxWidth: '60rem', margin: '0 auto', textAlign: 'center' }}>
          <div className={styles.pill} style={{ marginBottom: 24 }}>The Distinction</div>
          <h2 style={{ fontSize: 'clamp(36px, 4.6vw, 52px)', fontWeight: 900, color: '#0d1224', lineHeight: 1.15, marginBottom: 20, letterSpacing: '-0.02em' }}>
            Generic video conferencing delivers a session.<br />
            <span className={`${dmSerif.className} ${styles.gTeal}`} style={{ fontStyle: 'italic', fontWeight: 400 }}>Vaidix trains a doctor.</span>
          </h2>
          <p style={{ color: '#343c57', fontSize: 18, maxWidth: '38rem', margin: '0 auto', lineHeight: 1.6 }}>
            We turn every clinical session into a <strong>cognitive experience</strong> — designed with intent, taught with engagement, mastered through reflection and assessment.
          </p>
        </div>
      </section>


      {/* ══════════════════════════ 3H FRAMEWORK ══════════════════════════ */}
      <section className={styles.sectionWhite} style={{ padding: '5rem 1.5rem 6rem' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className={styles.reveal} style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className={styles.pill} style={{ marginBottom: 16 }}>The 3H Framework</div>
            <h2 style={{ fontSize: 'clamp(30px, 3.6vw, 40px)', fontWeight: 900, color: '#0d1224', marginBottom: 12 }}>Three dimensions of clinical mastery</h2>
            <p style={{ color: '#343c57', fontSize: 16, maxWidth: '36rem', margin: '0 auto' }}>What it means to train a 3H doctor.</p>
          </div>
          <div className="grid md:grid-cols-3" style={{ gap: 20 }}>
            {[
              { label: 'HEAD', color: '#5B6FDB', text: 'Knowledge depth — pathophysiology, diagnosis, evidence-based protocols.', svg: <><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></> },
              { label: 'HEART', color: '#D85D4F', text: 'Clinical empathy — patient communication, ethics, professional behaviour.', svg: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/> },
              { label: 'HANDS', color: '#4AB074', text: 'Procedural skill — DOPS-assessed technique and surgical readiness.', svg: <><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></> },
            ].map((h, i) => (
              <div key={i} className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 32, textAlign: 'center', background: `${h.color}0d`, borderColor: `${h.color}26`, transitionDelay: `${i * 0.08}s` }}>
                <div className={styles.iconWrapLg} style={{ margin: '0 auto 16px', background: `${h.color}1a` }}>
                  <svg className={styles.icoLg} viewBox="0 0 24 24" stroke={h.color}>{h.svg}</svg>
                </div>
                <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 8, color: h.color }}>{h.label}</div>
                <div style={{ fontSize: 14, color: '#343c57', lineHeight: 1.6 }}>{h.text}</div>
              </div>
            ))}
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


      {/* ══════════════════════════ LIFECYCLE OVERVIEW ══════════════════════════ */}
      <section id="lifecycle" className={styles.sectionLight} style={{ padding: '7rem 1.5rem' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className={styles.reveal} style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className={styles.pill} style={{ marginBottom: 20 }}>One Platform · Three Modules</div>
            <h2 style={{ fontSize: 'clamp(40px, 5vw, 56px)', fontWeight: 900, color: '#0d1224', lineHeight: 1.1, marginBottom: 20 }}>
              The Cognitive Session,<br />
              <span className={`${dmSerif.className} ${styles.gTeal}`} style={{ fontStyle: 'italic', fontWeight: 400 }}>end to end.</span>
            </h2>
            <p style={{ color: '#343c57', fontSize: 18, maxWidth: '38rem', margin: '0 auto', lineHeight: 1.6 }}>
              Every clinical teaching session has three phases. We built a dedicated module — and dedicated AI — for each.
            </p>
          </div>

          <div className="grid md:grid-cols-3" style={{ gap: 20 }}>
            {[
              {
                phase: '01',
                tag: 'PLAN',
                title: 'Pre-Conference',
                text: 'Generate the deck, blueprint the objectives, forge the cases, illustrate the slides — in minutes.',
                features: ['Blueprint Generator', 'Deck Forge', 'Case Forge', 'AI Illustrations'],
                href: '#pre',
                color: '#5B6FDB',
                bg: 'rgba(91,111,219,.07)',
              },
              {
                phase: '02',
                tag: 'TEACH',
                title: 'Live Conference',
                text: 'Hospital-grade video with AI engagement scoring, Indic captions, and presenter alerts when students drift.',
                features: ['Low-latency Video', 'Engagement Intelligence', 'Polls · Q&A', 'AI Captions'],
                href: '#live',
                color: '#1e9b8e',
                bg: 'rgba(30,155,142,.07)',
              },
              {
                phase: '03',
                tag: 'MASTER',
                title: 'Post-Conference',
                text: 'Recordings, reflective journaling, Socratic case dialogue, DOPS / Mini-CEX / EPA assessment, Kirkpatrick L1–L4.',
                features: ['AI Transcripts', 'Journal + Coach', 'DOPS · Mini-CEX · EPA', 'WhatsApp Pearls'],
                href: '#post',
                color: '#4AB074',
                bg: 'rgba(74,176,116,.07)',
              },
            ].map((p, i) => (
              <a key={p.tag} href={p.href} className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 32, transitionDelay: `${i * 0.1}s`, background: p.bg, borderColor: `${p.color}26`, textDecoration: 'none', display: 'block', color: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: p.color, letterSpacing: '0.18em' }}>{p.phase}</span>
                  <span style={{ width: 24, height: 1, background: `${p.color}66` }} />
                  <span style={{ fontSize: 11, fontWeight: 900, color: p.color, letterSpacing: '0.18em' }}>{p.tag}</span>
                </div>
                <h3 style={{ fontSize: 24, fontWeight: 900, color: '#0d1224', marginBottom: 12, letterSpacing: '-0.01em' }}>{p.title}</h3>
                <p style={{ fontSize: 14, color: '#343c57', lineHeight: 1.65, marginBottom: 20 }}>{p.text}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {p.features.map((f) => (
                    <span key={f} className={styles.chip} style={{ background: `${p.color}10`, borderColor: `${p.color}30`, color: p.color }}>{f}</span>
                  ))}
                </div>
                <div style={{ marginTop: 24, fontSize: 13, fontWeight: 700, color: p.color, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  Explore module →
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════ PRE-CONFERENCE ══════════════════════════ */}
      <section id="pre" className={styles.sectionWhite} style={{ padding: '7rem 1.5rem' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className={styles.reveal} style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className={styles.pill} style={{ marginBottom: 16, background: 'rgba(91,111,219,.08)', color: '#5B6FDB', borderColor: 'rgba(91,111,219,.22)' }}>
              <span style={{ fontWeight: 900 }}>01 · PLAN</span>
            </div>
            <h2 style={{ fontSize: 'clamp(40px, 5vw, 56px)', fontWeight: 900, color: '#0d1224', lineHeight: 1.1, marginBottom: 20 }}>
              Before the session.<br />
              <span className={dmSerif.className} style={{ fontStyle: 'italic', fontWeight: 400, color: '#5B6FDB' }}>Plan with AI.</span>
            </h2>
            <p style={{ color: '#343c57', fontSize: 18, maxWidth: '40rem', margin: '0 auto', lineHeight: 1.6 }}>
              Teacher walk in prepared. AI does the heavy lifting — turning documents into decks, transcripts into cases, and objectives into a teaching roadmap.
            </p>
          </div>

          {/* Deck Forge — featured */}
          <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 40, marginBottom: 24 }}>
            <div className="grid md:grid-cols-2" style={{ gap: 48, alignItems: 'center' }}>
              <div>
                <div className={styles.chip} style={{ marginBottom: 20, background: 'rgba(91,111,219,.08)', borderColor: 'rgba(91,111,219,.2)', color: '#5B6FDB' }}>Deck Forge</div>
                <h3 style={{ fontSize: 32, fontWeight: 900, color: '#0d1224', lineHeight: 1.15, marginBottom: 20 }}>Upload a PDF.<br />Get a teaching deck.</h3>
                <p style={{ color: '#343c57', lineHeight: 1.65, marginBottom: 24, fontSize: 15 }}>
                  Drop any clinical paper, textbook chapter, or protocol document. AI extracts teaching points, generates a clean slide structure, illustrates the visuals — and exports to fully editable PPTX.
                </p>
                <ul className={styles.checkList} style={{ padding: 0, margin: 0 }}>
                  <li>Saves teacher 4+ hours of prep per session</li>
                  <li>AI suggestions: add slides, reorder, cut</li>
                  <li>AI-generated clinical illustrations inline</li>
                  <li>One-click export to PPTX</li>
                </ul>
              </div>
              <div className={`${styles.mediaFrame} ${styles.floatD}`}>
                <div className={styles.mediaBar}>
                  <div className={styles.dotR} /><div className={styles.dotY} /><div className={styles.dotG} />
                  <span className={styles.mediaBarLabel}>Deck Forge</span>
                </div>
                <div className={styles.deckMockBody}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1.6fr', gap: 14, alignItems: 'center', height: '100%' }}>
                    {/* Source PDF */}
                    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #d0f3ef', padding: 12, boxShadow: '0 4px 14px rgba(30,155,142,.08)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D85D4F" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#D85D4F', letterSpacing: '0.08em' }}>PDF</span>
                      </div>
                      <div style={{ height: 4, background: '#e4e7ef', borderRadius: 2, marginBottom: 5 }} />
                      <div style={{ height: 4, background: '#e4e7ef', borderRadius: 2, marginBottom: 5, width: '85%' }} />
                      <div style={{ height: 4, background: '#e4e7ef', borderRadius: 2, marginBottom: 5, width: '70%' }} />
                      <div style={{ height: 4, background: '#e4e7ef', borderRadius: 2, marginBottom: 5 }} />
                      <div style={{ height: 4, background: '#e4e7ef', borderRadius: 2, marginBottom: 5, width: '60%' }} />
                      <div style={{ fontSize: 9, color: '#9aa3bc', marginTop: 10, textAlign: 'center' }}>Glaucoma_2024.pdf</div>
                    </div>

                    {/* Arrow */}
                    <div className={styles.arrowMove} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 8, fontWeight: 800, color: '#177d73', letterSpacing: '0.1em' }}>AI</span>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e9b8e" strokeWidth={2.5} strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                    </div>

                    {/* Output slides */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {[
                        { cls: styles.slideIn1, title: 'Objectives', bg: 'linear-gradient(135deg,#edfaf8,#d0f3ef)' },
                        { cls: styles.slideIn2, title: 'Pathophysiology', bg: 'linear-gradient(135deg,#fff,#edfaf8)' },
                        { cls: styles.slideIn3, title: 'Differentials', bg: 'linear-gradient(135deg,#fff,#edfaf8)' },
                        { cls: styles.slideIn4, title: 'Management', bg: 'linear-gradient(135deg,#edfaf8,#a4e8e0)' },
                      ].map((s) => (
                        <div key={s.title} className={s.cls} style={{ aspectRatio: '4/3', borderRadius: 6, background: s.bg, border: '1px solid rgba(30,155,142,.2)', padding: 6, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div style={{ fontSize: 7, fontWeight: 800, color: '#177d73', letterSpacing: '0.05em' }}>{s.title}</div>
                          <div>
                            <div style={{ height: 2, background: 'rgba(30,155,142,.3)', borderRadius: 1, marginBottom: 2 }} />
                            <div style={{ height: 2, background: 'rgba(30,155,142,.25)', borderRadius: 1, width: '70%' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Blueprint + Case Forge + Illustrations */}
          <div className="grid md:grid-cols-3" style={{ gap: 20 }}>
            <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 28 }}>
              <div className={styles.iconWrapLg} style={{ marginBottom: 20, background: 'rgba(91,111,219,.10)' }}>
                <svg className={styles.icoLg} viewBox="0 0 24 24" stroke="#5B6FDB"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/></svg>
              </div>
              <div style={{ fontWeight: 900, color: '#0d1224', fontSize: 18, marginBottom: 8 }}>Blueprint Generator</div>
              <p style={{ color: '#343c57', fontSize: 13, lineHeight: 1.65, marginBottom: 16 }}>AI generates a pre-session teaching roadmap — learning objectives, key questions, suggested interactive moments — for your topic and audience.</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className={styles.chip}>Objectives</span><span className={styles.chip}>Pre-session Q-bank</span>
              </div>
            </div>

            <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 28, transitionDelay: '0.08s' }}>
              <div className={styles.iconWrapLg} style={{ marginBottom: 20, background: 'rgba(30,155,142,.10)' }}>
                <svg className={styles.icoLg} viewBox="0 0 24 24" stroke="#1e9b8e"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/></svg>
              </div>
              <div style={{ fontWeight: 900, color: '#0d1224', fontSize: 18, marginBottom: 8 }}>Case Forge</div>
              <p style={{ color: '#343c57', fontSize: 13, lineHeight: 1.65, marginBottom: 16 }}>Generate structured Socratic cases from a session transcript, a paper, or a teacher note. Six clinical stages — Story to Reflection — wired in automatically.</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className={styles.chip}>6-stage case</span><span className={styles.chip}>From transcript</span>
              </div>
            </div>

            <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 28, transitionDelay: '0.16s' }}>
              <div className={styles.iconWrapLg} style={{ marginBottom: 20, background: 'rgba(74,176,116,.10)' }}>
                <svg className={styles.icoLg} viewBox="0 0 24 24" stroke="#4AB074"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
              </div>
              <div style={{ fontWeight: 900, color: '#0d1224', fontSize: 18, marginBottom: 8 }}>AI Illustrations</div>
              <p style={{ color: '#343c57', fontSize: 13, lineHeight: 1.65, marginBottom: 16 }}>Clinically accurate illustrations generated inline — anatomy, sign atlases, surgical sequences. Teacher stop hunting Google Images.</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className={styles.chip}>Inline image gen</span><span className={styles.chip}>Atlas-grade</span>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════ LIVE-CONFERENCE ══════════════════════════ */}
      <section id="live" className={styles.statsDark} style={{ padding: '7rem 1.5rem' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className={styles.reveal} style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className={styles.pillDark} style={{ marginBottom: 16 }}>
              <span style={{ fontWeight: 900 }}>02 · TEACH</span>
            </div>
            <h2 style={{ fontSize: 'clamp(40px, 5vw, 56px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 20 }}>
              During the session.<br />
              <span className={`${dmSerif.className} ${styles.gDark}`} style={{ fontStyle: 'italic', fontWeight: 400 }}>Teach with cognitive precision.</span>
            </h2>
            <p style={{ color: '#6b7494', fontSize: 18, maxWidth: '42rem', margin: '0 auto', lineHeight: 1.6 }}>
              This is not a video call with a chat bar. Vaidix actively watches the room — and tells the presenter when students drift.
            </p>
          </div>

          <div className="grid md:grid-cols-2" style={{ gap: 24, marginBottom: 24 }}>
            <div className={`${styles.cardDark} ${styles.reveal}`} style={{ padding: 36 }}>
              <div className={styles.chipDark} style={{ marginBottom: 16 }}>Grand Rounds, Reinvented</div>
              <h3 style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 14, lineHeight: 1.2 }}>Hospital-grade video. Built for teaching, not meetings.</h3>
              <p style={{ color: '#c9cedc', fontSize: 14, lineHeight: 1.65, marginBottom: 20 }}>Low-latency video, real-time captions in English and Indic languages, polls and interactive prompts, breakout rooms — every minute auto-recorded, transcribed, and AI-processed.</p>
              <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                {[
                  'Hospital-grade low-latency video',
                  'Live captions: English + Indic',
                  'Interactive hooks: polls, T/F, dilemmas',
                  'Pinned Q&A, hand-raise, threaded replies',
                  'Breakout rooms with sub-session recording',
                ].map((t, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#c9cedc', marginBottom: 10 }}>
                    <span style={{ color: '#2db3aa', fontWeight: 700, marginTop: 2 }}>→</span>{t}
                  </li>
                ))}
              </ul>
            </div>

            <div className={`${styles.cardDark} ${styles.reveal}`} style={{ padding: 36, transitionDelay: '0.12s' }}>
              <div className={styles.chipDark} style={{ marginBottom: 16 }}>Engagement Intelligence</div>
              <h3 style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 14, lineHeight: 1.2 }}>The room is being read. The presenter is being told.</h3>
              <p style={{ color: '#c9cedc', fontSize: 14, lineHeight: 1.65, marginBottom: 20 }}>Vaidix tracks attention, participation, and interaction in real time — and delivers private nudges to the presenter so no student is lost silently.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: 14, borderRadius: 14, background: 'rgba(74,176,116,.07)', border: '1px solid rgba(74,176,116,.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#6ee7b7' }}>Session Engagement</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#6ee7b7' }}>87%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,.1)' }}>
                    <div className={styles.growBar} style={{ '--w': '87%', height: 6, borderRadius: 999, background: 'linear-gradient(90deg,#1e9b8e,#4AB074)' } as React.CSSProperties} />
                  </div>
                </div>
                <div style={{ padding: 14, borderRadius: 14, background: 'rgba(30,155,142,.07)', border: '1px solid rgba(30,155,142,.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2db3aa' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#5dd4ca' }}>Presenter Alert</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#c9cedc' }}>3 participants silent for 8 min — consider launching a poll now</p>
                </div>
              </div>
            </div>
          </div>

          {/* Live preview frame — CSS mock of the classroom UI */}
          <div className={styles.reveal} style={{ marginTop: 8 }}>
            <div className={styles.mediaFrame}>
              <div className={styles.mediaBar}>
                <div className={styles.dotR} /><div className={styles.dotY} /><div className={styles.dotG} />
                <span className={styles.mediaBarLabel}>Live Classroom · Glaucoma Grand Round</span>
                <div className={styles.mediaBarLive}><div className={styles.liveDot} />LIVE</div>
              </div>
              <div className={styles.liveMockBody}>
                {/* Same live mock pattern, scaled up */}
                <div className={`${styles.mockTile} ${styles.mockTilePresenter} ${styles.tileBreathe}`} style={{ position: 'absolute', top: '5%', left: '3%', width: '58%', height: '62%' }}>
                  <div style={{ position: 'absolute', top: 14, left: 16, fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.9)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Presenter</div>
                  <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.25)', border: '1.5px solid rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff' }}>PS</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>Dr. Priya Sharma</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', marginTop: 3 }}>Glaucoma · LVPEI</div>
                    </div>
                  </div>
                </div>

                <div style={{ position: 'absolute', top: '5%', right: '3%', width: '34%', height: '62%', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 8 }}>
                  {[
                    { c: styles.mockTileA, initials: 'AR', label: 'Arjun' },
                    { c: styles.mockTileB, initials: 'NK', label: 'Neha' },
                    { c: styles.mockTileC, initials: 'SK', label: 'Sahil' },
                    { c: styles.mockTileD, initials: '+12', label: '12 more' },
                  ].map((t) => (
                    <div key={t.initials} className={`${styles.mockTile} ${t.c}`}>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: 'rgba(255,255,255,.9)' }}>{t.initials}</div>
                      <div style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 10, color: 'rgba(255,255,255,.75)', fontWeight: 600 }}>{t.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ position: 'absolute', bottom: '20%', left: '3%', right: '38%', padding: '10px 14px', background: 'rgba(13,18,36,0.92)', borderRadius: 12, color: '#fff', boxShadow: '0 4px 16px rgba(13,18,36,.18)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5dd4ca" strokeWidth={2.4} strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#5dd4ca', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live caption · EN</span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.4, color: '#e4e7ef' }}>
                    &ldquo;Slit-lamp shows posterior subcapsular opacity — how does this shift your differential?&rdquo;
                  </div>
                </div>

                <div style={{ position: 'absolute', bottom: '6%', right: '3%', width: '34%', padding: 14, background: '#fff', borderRadius: 12, border: '1px solid rgba(74,176,116,.28)', boxShadow: '0 4px 14px rgba(30,155,142,.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#177d73', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Engagement</span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: '#177d73' }}>87%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: 'rgba(30,155,142,.12)' }}>
                    <div className={styles.growBar} style={{ '--w': '87%', height: 6, borderRadius: 999, background: 'linear-gradient(90deg,#1e9b8e,#4AB074)' } as React.CSSProperties} />
                  </div>
                  <div style={{ fontSize: 10, color: '#4a5370', marginTop: 7 }}>↑ Trending up · 5 min</div>
                </div>

                <div className={styles.alertPop} style={{ position: 'absolute', bottom: '3%', left: '3%', right: '38%', padding: '9px 13px', background: 'linear-gradient(135deg, rgba(30,155,142,.95), rgba(45,179,170,.95))', borderRadius: 12, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 6px 20px rgba(30,155,142,.35)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m13 2-3 7h7l-9 13 3-9H4l9-11z"/></svg>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.03em' }}>Presenter alert: 3 silent for 8 min — try a poll</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════ POST-CONFERENCE ══════════════════════════ */}
      <section id="post" className={styles.sectionLight} style={{ padding: '7rem 1.5rem' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className={styles.reveal} style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className={styles.pill} style={{ marginBottom: 16, background: 'rgba(74,176,116,.10)', color: '#177d73', borderColor: 'rgba(74,176,116,.25)' }}>
              <span style={{ fontWeight: 900 }}>03 · MASTER</span>
            </div>
            <h2 style={{ fontSize: 'clamp(40px, 5vw, 56px)', fontWeight: 900, color: '#0d1224', lineHeight: 1.1, marginBottom: 20 }}>
              After the session.<br />
              <span className={dmSerif.className} style={{ fontStyle: 'italic', fontWeight: 400, color: '#4AB074' }}>Master through reflection and assessment.</span>
            </h2>
            <p style={{ color: '#343c57', fontSize: 18, maxWidth: '42rem', margin: '0 auto', lineHeight: 1.6 }}>
              The session ends. Learning begins. Vaidix closes the loop — recordings, reflection, Socratic cases, competency assessment, all in one cognitive workflow.
            </p>
          </div>

          {/* Recordings + Journal coach */}
          <div className="grid md:grid-cols-2" style={{ gap: 24, marginBottom: 24 }}>
            <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 32 }}>
              <div className={styles.iconWrapLg} style={{ marginBottom: 20, background: 'rgba(30,155,142,.10)' }}>
                <svg className={styles.icoLg} viewBox="0 0 24 24" stroke="#1e9b8e"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
              </div>
              <div style={{ fontWeight: 900, color: '#0d1224', fontSize: 20, marginBottom: 8 }}>Recordings + AI Transcripts</div>
              <p style={{ color: '#343c57', fontSize: 14, lineHeight: 1.65, marginBottom: 16 }}>Every session auto-recorded, transcoded, transcribed in English + Indic, and streamed via CDN with expiry-controlled share links.</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className={styles.chip}>HLS streaming</span><span className={styles.chip}>Multi-language</span><span className={styles.chip}>Share tokens</span>
              </div>
            </div>

            <div className={`${styles.gradBorder} ${styles.reveal}`} style={{ background: '#fff', transitionDelay: '0.1s' }}>
              <div style={{ padding: 32 }}>
                <div style={{ fontSize: 10, color: '#177d73', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 10 }}>Reflective Learning</div>
                <div style={{ fontWeight: 900, color: '#0d1224', fontSize: 20, marginBottom: 8 }}>Journal + AI Coach</div>
                <p style={{ color: '#343c57', fontSize: 14, lineHeight: 1.65, marginBottom: 16 }}>Students log clinical reflections. The AI coach reads each entry, identifies gaps, and offers a Socratic prompt — not an answer.</p>
                <div style={{ padding: 14, borderRadius: 12, background: '#edfaf8', border: '1px solid rgba(30,155,142,.15)' }}>
                  <p style={{ fontSize: 12, color: '#252b43', fontStyle: 'italic', lineHeight: 1.6, marginBottom: 10 }}>&ldquo;I struggled to differentiate OCT patterns between NTG and POAG today...&rdquo;</p>
                  <div style={{ padding: 12, borderRadius: 10, background: '#fff', border: '1px solid rgba(30,155,142,.18)', fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: '#177d73' }}>Coach: </span>
                    <span style={{ color: '#343c57' }}>What structural differences were you expecting, and what did you observe?</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Case Bank + Pearls */}
          <div className="grid md:grid-cols-2" style={{ gap: 24, marginBottom: 24 }}>
            <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 32 }}>
              <div className={styles.chip} style={{ marginBottom: 16 }}>Case Bank</div>
              <h3 style={{ fontSize: 22, fontWeight: 900, color: '#0d1224', marginBottom: 12 }}>An AI tutor that thinks like a clinician</h3>
              <p style={{ color: '#343c57', fontSize: 13, lineHeight: 1.65, marginBottom: 16 }}>Our clinical AI guides students through structured cases across 6 stages — Socratic dialogue that prompts, probes, and adapts. A mentor that never gives up.</p>
              <div style={{ padding: 14, borderRadius: 14, background: '#f9f9fb', border: '1px solid #e4e7ef' }}>
                <div style={{ padding: '8px 12px', borderRadius: '14px 14px 14px 2px', background: '#edfaf8', border: '1px solid rgba(30,155,142,.2)', fontSize: 12, color: '#252b43', marginBottom: 8 }}>
                  68-year-old with 6 months progressive vision loss. What would you examine first?
                </div>
                <div style={{ padding: '8px 12px', borderRadius: '14px 14px 2px 14px', background: '#fff', border: '1px solid #e4e7ef', fontSize: 12, color: '#252b43', marginBottom: 8, marginLeft: 20 }}>
                  Start with VA — corrected and uncorrected — then slit-lamp...
                </div>
                <div style={{ padding: '8px 12px', borderRadius: '14px 14px 14px 2px', background: '#edfaf8', border: '1px solid rgba(30,155,142,.2)', fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: '#177d73' }}>Good reasoning. </span>
                  <span style={{ color: '#252b43' }}>Slit-lamp shows posterior subcapsular opacity. How does that shift your differential?</span>
                </div>
              </div>
            </div>

            <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 32, transitionDelay: '0.1s' }}>
              <div className={styles.iconWrapLg} style={{ marginBottom: 20, background: 'rgba(74,176,116,.10)' }}>
                <svg className={styles.icoLg} viewBox="0 0 24 24" stroke="#4AB074"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/></svg>
              </div>
              <div style={{ fontWeight: 900, color: '#0d1224', fontSize: 20, marginBottom: 8 }}>Pearl Library + WhatsApp</div>
              <p style={{ color: '#343c57', fontSize: 14, lineHeight: 1.65, marginBottom: 16 }}>Microlearning &ldquo;pearls&rdquo; — bite-sized clinical facts and tips — delivered straight to students&apos; WhatsApp. Learning that fits in the OT corridor.</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className={styles.chip}>WhatsApp delivery</span><span className={styles.chip}>Scheduled sends</span><span className={styles.chip}>Spaced repetition</span>
              </div>
            </div>
          </div>

          {/* Assessment block */}
          <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 40 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div className={styles.chip} style={{ marginBottom: 12 }}>Competency Assessment</div>
              <h3 style={{ fontSize: 'clamp(26px, 3vw, 32px)', fontWeight: 900, color: '#0d1224' }}>Assessment that proves competence</h3>
              <p style={{ color: '#343c57', fontSize: 14, maxWidth: '36rem', margin: '12px auto 0' }}>DOPS, Mini-CEX, and EPA tracking embedded in the clinical workflow — digitally, traceably, accreditation-ready.</p>
            </div>

            <div className="grid md:grid-cols-3" style={{ gap: 16, marginBottom: 32 }}>
              {[
                { title: 'DOPS', sub: 'Direct Observation of Procedural Skills', color: '#1e9b8e', bg: 'rgba(30,155,142,.10)', text: 'Teacher fill structured forms while observing procedures. AI pre-fills criteria based on case context.' },
                { title: 'Mini-CEX', sub: 'Mini Clinical Evaluation Exercise', color: '#5B6FDB', bg: 'rgba(91,111,219,.10)', text: 'History, examination, reasoning, communication — evaluated in real encounters. Mobile-first, under 5 minutes.' },
                { title: 'EPA Tracking', sub: 'Entrustable Professional Activities', color: '#4AB074', bg: 'rgba(74,176,116,.10)', text: '5 entrustment levels — from observation only to supervising others. Visual milestone dashboard.' },
              ].map((a) => (
                <div key={a.title} style={{ padding: 20, borderRadius: 16, background: a.bg, border: `1px solid ${a.color}30` }}>
                  <div style={{ fontWeight: 900, fontSize: 16, color: a.color, marginBottom: 4 }}>{a.title}</div>
                  <div style={{ fontSize: 10, color: '#9aa3bc', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 10 }}>{a.sub}</div>
                  <p style={{ fontSize: 12, color: '#343c57', lineHeight: 1.6 }}>{a.text}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2" style={{ gap: 32 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18, color: '#0d1224', marginBottom: 12 }}>Kirkpatrick 4-Level Evaluation</div>
                {[
                  { l: 'L1', label: 'Reaction',  desc: 'Did students find it valuable?',     bg: '#2db3aa' },
                  { l: 'L2', label: 'Learning',  desc: 'Did knowledge and skills improve?',  bg: '#1e9b8e' },
                  { l: 'L3', label: 'Behaviour', desc: 'Did clinical practice change?',      bg: '#177d73' },
                  { l: 'L4', label: 'Results',   desc: 'Did patient outcomes improve?',      bg: '#13635b' },
                ].map((k) => (
                  <div key={k.l} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff', flexShrink: 0, background: k.bg }}>{k.l}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f33' }}>{k.label}</div>
                      <div style={{ fontSize: 12, color: '#4a5370' }}>{k.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18, color: '#0d1224', marginBottom: 12 }}>Student Portfolio</div>
                {[
                  { k: 'DOPS Completed',    v: '12 / 20',     color: '#177d73' },
                  { k: 'Mini-CEX Logged',   v: '8 / 12',      color: '#177d73' },
                  { k: 'EPA Level (Phaco)', v: 'Level 3 → 4', color: '#5B6FDB' },
                  { k: 'Cases Completed',   v: '34',          color: '#177d73' },
                ].map((p) => (
                  <div key={p.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, background: '#f9f9fb', border: '1px solid #e4e7ef', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: '#252b43' }}>{p.k}</span>
                    <span style={{ fontWeight: 900, color: p.color }}>{p.v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 14, border: '2px solid rgba(45,179,170,.5)', background: '#edfaf8' }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#115450' }}>Overall 3H Score</span>
                  <span style={{ fontWeight: 900, color: '#0d1224', fontSize: 18 }}>82<span style={{ fontSize: 14, color: '#4a5370' }}>/100</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════ AI CORE ══════════════════════════ */}
      <section id="ai" className={styles.statsDark} style={{ padding: '7rem 1.5rem' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
          <div className={styles.reveal} style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className={styles.pillDark} style={{ marginBottom: 20 }}>Vaidix Intelligence</div>
            <h2 style={{ fontSize: 'clamp(40px, 5vw, 56px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 20 }}>
              Purpose-trained AI.<br /><span className={`${dmSerif.className} ${styles.gDark}`} style={{ fontStyle: 'italic', fontWeight: 400 }}>Not a bolted-on chatbot.</span>
            </h2>
            <p style={{ color: '#6b7494', fontSize: 18, maxWidth: '44rem', margin: '0 auto', lineHeight: 1.6 }}>
              Every capability — Forge tools, engagement scoring, journal coach, case dialogue — is powered by AI trained specifically for medical education, not adapted from a generic assistant.
            </p>
          </div>

          <div className="grid md:grid-cols-3" style={{ gap: 20 }}>
            {[
              { title: 'Clinical AI Tutor', sub: 'Vaidix Core', color: '#5dd4ca', bg: 'rgba(30,155,142,.15)', desc: 'Trained on medical literature. Guides students through case discussions with speciality-specific precision — ophthalmology first.', chips: ['Case dialogue', 'Gap detection'], svg: <><circle cx="12" cy="2.5" r="1.5"/><circle cx="19.5" cy="19.5" r="1.5"/><circle cx="4.5" cy="14.5" r="1.5"/><path d="M16 22s-1-1.5-2-2.5C13 18.5 11 17 9 17a4 4 0 0 1-4-4c0-2 2-4 4-4 1 0 3 .5 4 1.5l1 1"/></> },
              { title: 'Content Intelligence', sub: 'Reasoning Engine', color: '#93a3f8', bg: 'rgba(91,111,219,.15)', desc: 'Deep clinical reasoning for content quality — reviews case accuracy, structures decks, scores assessments, drives the Forge tools.', chips: ['Deck design', 'Case review'], svg: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/> },
              { title: 'Language Engine', sub: 'Multimodal & Multilingual', color: '#6ee7b7', bg: 'rgba(74,176,116,.12)', desc: 'Clinical illustration generation, English + Indic captioning, and intelligent document classification for content ingestion.', chips: ['Image gen', 'Indic captions'], svg: <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></> },
            ].map((p, i) => (
              <div key={i} className={`${styles.cardDark} ${styles.reveal}`} style={{ padding: 28, transitionDelay: `${i * 0.12}s` }}>
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
        </div>
      </section>


      {/* ══════════════════════════ TESTIMONIAL ══════════════════════════ */}
      <section className={styles.sectionWhite} style={{ padding: '6rem 1.5rem', borderTop: '1px solid #e4e7ef', borderBottom: '1px solid #e4e7ef' }}>
        <div className={styles.reveal} style={{ maxWidth: '48rem', margin: '0 auto' }}>
          <div className={styles.cardWhite} style={{ position: 'relative', padding: 'clamp(36px, 6vw, 56px)', borderRadius: 24 }}>
            <span className={styles.quoteMark}>&ldquo;</span>
            <p style={{ fontSize: 'clamp(22px, 2.8vw, 28px)', fontWeight: 500, color: '#1a1f33', lineHeight: 1.4, position: 'relative', zIndex: 1 }}>
              Vaidix consolidated four separate tools we used for our training programme. The teacher time saved is measurable. The student engagement is undeniable.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 32 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1e9b8e, #2db3aa)' }}>
                <svg className={styles.ico} viewBox="0 0 24 24" stroke="white"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#0d1224' }}>HOD</div>
                <div style={{ fontSize: 13, color: '#4a5370' }}>Tertiary eye care institute · South India</div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════ QUIET TRUST STRIP ══════════════════════════ */}
      <section style={{ background: '#f9f9fb', padding: '2rem 1.5rem', borderBottom: '1px solid #e4e7ef' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '12px 28px', fontSize: 12, color: '#4a5370' }}>
          {[
            { key: 'dpdpa', svg: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>, text: 'DPDPA aligned' },
            { key: 'phi',   svg: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>, text: 'PHI scanning' },
            { key: 'cloud', svg: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>, text: 'Indian cloud region' },
            { key: 'audit', svg: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></>, text: 'Full audit trail' },
            { key: 'indic', svg: <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></>, text: 'Indic language support' },
          ].map((t) => (
            <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg className={styles.icoSm} viewBox="0 0 24 24" stroke="#1e9b8e">{t.svg}</svg>
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      </section>


      {/* ══════════════════════════ FAQ ══════════════════════════ */}
      <section id="faq" className={styles.sectionWhite} style={{ padding: '7rem 1.5rem' }}>
        <div style={{ maxWidth: '48rem', margin: '0 auto' }}>
          <div className={styles.reveal} style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className={styles.pill} style={{ marginBottom: 20 }}>Common Questions</div>
            <h2 style={{ fontSize: 'clamp(36px, 4.6vw, 52px)', fontWeight: 900, color: '#0d1224', lineHeight: 1.1, marginBottom: 16 }}>
              Questions <span className={`${dmSerif.className} ${styles.gTeal}`} style={{ fontStyle: 'italic', fontWeight: 400 }}>worth asking</span>
            </h2>
            <p style={{ color: '#343c57' }}>Direct answers to what HODs actually ask.</p>
          </div>

          <div className={`${styles.cardWhite} ${styles.reveal}`} style={{ padding: 16 }}>
            {[
              ['How long does implementation take?', 'Typical rollout is 2–4 weeks for a single training programme. Week 1 covers setup, programme structure import, and teacher onboarding. Week 2 handles student provisioning and your first live sessions. Weeks 3–4 enable assessment workflows and AI features at your pace.'],
              ['What does the cognitive gymnasium look like in a real week?', 'Teacher uses Pre-Conference (Blueprint + Deck Forge + Case Forge) to prepare in under an hour. Live Conference runs the grand round with engagement scoring. Post-Conference closes the loop — students journal, complete cases, teacher record DOPS, and Pearls land on WhatsApp through the week.'],
              ['Can it integrate with existing systems (HMS / LMS / SSO)?', 'Yes — SSO via institutional identity providers, iCal calendar sync, and structured export for legacy LMS or HMS integration. Custom integrations are available for enterprise tiers.'],
              ['Which specialties is Vaidix built for?', 'Ophthalmology is the deepest specialty today, with curriculum, case templates, and AI tuning purpose-built for it — co-designed with LV Prasad Eye Institute teacher. The platform is specialty-agnostic; paediatrics, internal medicine, and surgery are progressively onboarded with their respective teacher partners.'],
              ['Will it work in low-bandwidth hospitals?', 'Yes. Live video adapts to available bandwidth, recordings support low-latency offline playback, and WhatsApp microlearning works on any phone signal. Mobile-first design throughout — students can complete assessments from their phones in clinic.'],
              ['How does pricing work?', 'Per-programme annual licensing, scaled by student count, with no per-feature gates — every institution gets the full platform. Pilot pricing is available for first-year partners. Request a demo for a tailored quote.'],
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
            <h2 style={{ fontSize: 'clamp(38px, 5vw, 54px)', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 16 }}>
              Ready to build your<br /><span className={`${dmSerif.className} ${styles.gDark}`} style={{ fontStyle: 'italic', fontWeight: 400 }}>cognitive gymnasium?</span>
            </h2>
            <p style={{ color: '#5dd4ca', fontSize: 18 }}>
              Request a personalised demo. We&apos;ll show how Vaidix fits your specialty.
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
                      <option>HOD</option>
                      <option>Teacher / Senior Student</option>
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
            <div style={{ maxWidth: '22rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.015em' }}>
                  Vai<span style={{ color: '#5dd4ca' }}>dix</span>
                </span>
                <span className={styles.pillDark} style={{ fontSize: '0.6rem', padding: '3px 9px' }}>LXS</span>
              </div>
              <p style={{ fontSize: 13, color: '#6b7494', lineHeight: 1.6, marginBottom: 10 }}>The cognitive gymnasium for medical training. Built by clinicians, for clinicians.</p>
              <p style={{ fontSize: 12, color: '#4a5370', lineHeight: 1.6 }}>In partnership with LV Prasad Eye Institute.</p>
            </div>
            <div className="grid grid-cols-3" style={{ gap: 40, fontSize: 13 }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, marginBottom: 12 }}>Lifecycle</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 8 }}><a href="#pre" style={{ color: '#6b7494' }}>Pre-Conference</a></li>
                  <li style={{ marginBottom: 8 }}><a href="#live" style={{ color: '#6b7494' }}>Live Conference</a></li>
                  <li style={{ marginBottom: 8 }}><a href="#post" style={{ color: '#6b7494' }}>Post-Conference</a></li>
                  <li style={{ marginBottom: 8 }}><a href="#ai" style={{ color: '#6b7494' }}>AI Core</a></li>
                </ul>
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, marginBottom: 12 }}>Modules</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  <li style={{ marginBottom: 8 }}><a href="#pre" style={{ color: '#6b7494' }}>Deck Forge</a></li>
                  <li style={{ marginBottom: 8 }}><a href="#pre" style={{ color: '#6b7494' }}>Case Forge</a></li>
                  <li style={{ marginBottom: 8 }}><a href="#post" style={{ color: '#6b7494' }}>Journal Coach</a></li>
                  <li style={{ marginBottom: 8 }}><a href="#post" style={{ color: '#6b7494' }}>Pearl Library</a></li>
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
              <span>Indian Cloud Region · DPDPA aligned</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
