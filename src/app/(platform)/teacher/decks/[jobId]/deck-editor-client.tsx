'use client';

// ════════════════════════════════════════════════════════════════════════════
// Deck editor — left rail (thumbnails + reorder), center preview, right edit
// panel. Slides are persisted via PATCH /api/decks/[jobId]/slides/[slideId];
// reorder via POST /api/decks/[jobId]/reorder.
// ════════════════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Pencil } from 'lucide-react';
import { SlideCanvas, type SlideViewModel } from '@/components/decks/slide-canvas';
import { DeckAiCoach } from '@/components/decks/deck-ai-coach';
import { ThemePicker } from '@/components/decks/theme-picker';
import type { DeckAnalysisResult } from '@/server/services/decks/deck-analyze-service';
import type { DeckForgeStatus, SlideLayout } from '@prisma/client';
import { csrfHeaders } from '@/lib/csrf-client';

const LAYOUT_OPTIONS: SlideLayout[] = [
  'TITLE_ONLY',
  'TITLE_BULLETS',
  'TWO_COLUMN',
  'IMAGE_FOCUS',
  'QUOTE',
  'INTERACTION',
  'CLOSING',
];

interface Props {
  jobId: string;
  deckTitle: string;
  status: DeckForgeStatus;
  sourceLabel: string;
  initialSlides: SlideViewModel[];
  initialAnalysis: DeckAnalysisResult | null;
  initialTheme?: string | null;
}

type RightTab = 'edit' | 'coach';

export function DeckEditorClient({
  jobId,
  deckTitle,
  status,
  sourceLabel,
  initialSlides,
  initialAnalysis,
  initialTheme,
}: Props) {
  const router = useRouter();
  const [slides, setSlides] = useState<SlideViewModel[]>(initialSlides);
  const [activeId, setActiveId] = useState<string | null>(initialSlides[0]?.id ?? null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>('coach');
  const [themeId, setThemeId] = useState<string>(initialTheme ?? 'deep-space');

  const active = useMemo(
    () => slides.find((s) => s.id === activeId) ?? slides[0] ?? null,
    [slides, activeId],
  );

  const updateLocal = useCallback((id: string, patch: Partial<SlideViewModel>) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  async function persistSlide(id: string, body: Partial<SlideViewModel>) {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/decks/${jobId}/slides/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(j?.error?.message ?? `Save failed (${res.status})`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  async function persistTheme(id: string) {
    setThemeId(id);
    try {
      const res = await fetch(`/api/decks/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ template: id }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(j?.error?.message ?? `Theme save failed (${res.status})`);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function move(id: string, delta: -1 | 1) {
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const next = idx + delta;
      if (idx < 0 || next < 0 || next >= prev.length) return prev;
      const copy = prev.slice();
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy.map((s, i) => ({ ...s, order: i }));
    });
  }

  async function persistOrder() {
    setError(null);
    try {
      const res = await fetch(`/api/decks/${jobId}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ order: slides.map((s) => s.id) }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(j?.error?.message ?? 'Reorder failed');
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function exportPptx() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/decks/${jobId}/export-pptx`, {
        method: 'POST',
        headers: { ...csrfHeaders() },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deckTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div>
          <Link
            href="/teacher/documents"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to documents
          </Link>
          <h1 className="mt-1 text-lg font-semibold">{deckTitle}</h1>
          <p className="text-xs text-muted-foreground">
            {sourceLabel} · {slides.length} slides · {status}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ThemePicker value={themeId} onChange={persistTheme} />

          <span className="h-5 w-px bg-border" />

          {error && <span className="text-xs text-destructive">{error}</span>}
          <button
            type="button"
            onClick={persistOrder}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            Save order
          </button>
          <button
            type="button"
            onClick={exportPptx}
            disabled={exporting}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export .pptx'}
          </button>
          <Link
            href={`/teacher/decks/${jobId}/present`}
            className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
          >
            Present ▶
          </Link>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-12 overflow-hidden">
        {/* Thumbnail rail */}
        <aside className="col-span-3 overflow-y-auto border-r border-border bg-card/50 p-3">
          <ol className="space-y-2">
            <AnimatePresence initial={false}>
              {slides.map((s, i) => (
                <motion.li
                  key={s.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`group rounded-lg border p-2 transition ${
                    s.id === activeId
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-foreground/30'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(s.id)}
                    className="block w-full text-left"
                  >
                    <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>Slide {i + 1}</span>
                      <span>{s.layout}</span>
                    </div>
                    <div className="overflow-hidden rounded">
                      <SlideCanvas
                        slide={s}
                        index={i}
                        total={slides.length}
                        deckTitle={deckTitle}
                        themeId={themeId}
                      />
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs">{s.title}</p>
                  </button>
                  <div className="mt-1.5 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label="Move up"
                      onClick={() => move(s.id, -1)}
                      className="rounded border border-border px-1.5 text-[10px] hover:bg-muted"
                      disabled={i === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      onClick={() => move(s.id, 1)}
                      className="rounded border border-border px-1.5 text-[10px] hover:bg-muted"
                      disabled={i === slides.length - 1}
                    >
                      ↓
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </aside>

        {/* Preview center */}
        <main className="col-span-6 overflow-y-auto p-6">
          {active ? (
            <div className="mx-auto max-w-4xl">
              <SlideCanvas
                slide={active}
                index={slides.findIndex((s) => s.id === active.id)}
                total={slides.length}
                deckTitle={deckTitle}
                themeId={themeId}
              />
              {active.speakerNotes && (
                <section className="mt-4 rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Speaker notes
                  </h3>
                  <p className="text-sm">{active.speakerNotes}</p>
                </section>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No slides — try forging again.</p>
          )}
        </main>

        {/* Right panel — tabbed: Edit / AI Coach */}
        <aside className="col-span-3 flex flex-col overflow-hidden border-l border-border bg-card/50">
          {/* Tab strip */}
          <div role="tablist" className="flex border-b border-border bg-card">
            <button
              role="tab"
              type="button"
              aria-selected={rightTab === 'edit'}
              onClick={() => setRightTab('edit')}
              className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition ${
                rightTab === 'edit'
                  ? 'border-b-2 border-foreground text-foreground'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
              }`}
              data-testid="tab-edit"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={rightTab === 'coach'}
              onClick={() => setRightTab('coach')}
              className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition ${
                rightTab === 'coach'
                  ? 'border-b-2 border-amber-500 text-foreground'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'
              }`}
              data-testid="tab-coach"
            >
              <Sparkles className="h-3 w-3 text-amber-500" /> AI Coach
            </button>
          </div>

          {/* Tab body */}
          <div className="flex-1 overflow-hidden">
            {rightTab === 'edit' ? (
              <div className="h-full overflow-y-auto p-4">
                {active ? (
                  <SlideEditPanel
                    key={active.id}
                    slide={active}
                    saving={savingId === active.id}
                    onChange={(patch) => updateLocal(active.id, patch)}
                    onCommit={(patch) => persistSlide(active.id, patch)}
                  />
                ) : null}
              </div>
            ) : (
              <DeckAiCoach
                jobId={jobId}
                initialAnalysis={initialAnalysis}
                slides={slides.map((s) => ({ id: s.id, order: s.order }))}
                activeSlideId={active?.id ?? null}
                onFocusSlide={(slideId) => setActiveId(slideId)}
                onSlideCommitted={async (slideId, patch) => {
                  updateLocal(slideId, {
                    title: patch.title,
                    bullets: patch.bullets,
                    speakerNotes: patch.speakerNotes,
                    ...(patch.layout ? { layout: patch.layout as SlideLayout } : {}),
                  });
                  await persistSlide(slideId, {
                    title: patch.title,
                    bullets: patch.bullets,
                    speakerNotes: patch.speakerNotes,
                    ...(patch.layout ? { layout: patch.layout as SlideLayout } : {}),
                  });
                }}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function SlideEditPanel({
  slide,
  saving,
  onChange,
  onCommit,
}: {
  slide: SlideViewModel;
  saving: boolean;
  onChange: (patch: Partial<SlideViewModel>) => void;
  onCommit: (patch: Partial<SlideViewModel>) => void;
}) {
  return (
    <div className="space-y-4 text-sm">
      <header>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Edit slide {slide.order + 1}
        </h3>
        {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
      </header>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Layout</span>
        <select
          value={slide.layout}
          onChange={(e) => {
            const layout = e.target.value as SlideLayout;
            onChange({ layout });
            onCommit({ layout });
          }}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          {LAYOUT_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Title</span>
        <textarea
          value={slide.title}
          onChange={(e) => onChange({ title: e.target.value })}
          onBlur={() => onCommit({ title: slide.title })}
          className="min-h-15 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        />
      </label>

      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Bullets</span>
        <ul className="space-y-1.5">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex gap-1.5">
              <textarea
                value={b}
                onChange={(e) => {
                  const next = slide.bullets.slice();
                  next[i] = e.target.value;
                  onChange({ bullets: next });
                }}
                onBlur={() => onCommit({ bullets: slide.bullets })}
                className="min-h-10 flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  const next = slide.bullets.filter((_, idx) => idx !== i);
                  onChange({ bullets: next });
                  onCommit({ bullets: next });
                }}
                className="rounded border border-border px-1.5 text-[10px] hover:bg-muted"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            if (slide.bullets.length >= 8) return;
            const next = [...slide.bullets, 'New bullet'];
            onChange({ bullets: next });
            onCommit({ bullets: next });
          }}
          className="mt-1 rounded border border-dashed border-border px-2 py-1 text-xs hover:bg-muted"
        >
          + Add bullet
        </button>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Speaker notes</span>
        <textarea
          value={slide.speakerNotes ?? ''}
          onChange={(e) => onChange({ speakerNotes: e.target.value })}
          onBlur={() => onCommit({ speakerNotes: slide.speakerNotes ?? null })}
          className="min-h-25 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          placeholder="What you'll say while presenting…"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Accent (hex, no #)</span>
        <input
          type="text"
          value={slide.accentHex ?? ''}
          onChange={(e) => onChange({ accentHex: e.target.value || null })}
          onBlur={() => {
            const v = slide.accentHex;
            if (v && !/^[0-9a-fA-F]{6}$/.test(v)) return;
            onCommit({ accentHex: v ?? null });
          }}
          placeholder="e.g. 00d4f0 (default teal)"
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
        />
      </label>
    </div>
  );
}
