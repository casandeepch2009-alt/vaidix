'use client';

// ════════════════════════════════════════════════════════════════════════════
// LiveCaptionsOverlay — Stream B9
// ════════════════════════════════════════════════════════════════════════════
// Subscribes to /api/classroom/sessions/[id]/live-captions SSE. Renders the
// most recent partial + final lines as a captioned overlay at the bottom of
// the video frame. Toggleable on/off; learner preference persists in
// localStorage.

import { useEffect, useRef, useState } from 'react';

interface CaptionEvent {
  sessionId: string;
  startMs: number;
  endMs: number;
  text: string;
  lang: string;
  speaker?: string;
  partial?: boolean;
}

const STORAGE_KEY = 'vaidix.liveCaptionsOn';
const MAX_LINES = 2;

export function LiveCaptionsOverlay({ sessionId }: { sessionId: string }) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === 'true';
  });
  const [finals, setFinals] = useState<CaptionEvent[]>([]);
  const [partial, setPartial] = useState<CaptionEvent | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      esRef.current?.close();
      esRef.current = null;
      return;
    }
    const es = new EventSource(`/api/classroom/sessions/${sessionId}/live-captions`, {
      withCredentials: true,
    });
    esRef.current = es;
    es.addEventListener('caption', (ev) => {
      try {
        const c = JSON.parse((ev as MessageEvent).data) as CaptionEvent;
        if (c.partial) {
          setPartial(c);
        } else {
          setPartial(null);
          setFinals((prev) => [...prev, c].slice(-MAX_LINES));
        }
      } catch {
        /* ignore malformed events */
      }
    });
    es.addEventListener('error', () => {
      // Browser auto-reconnects; nothing to do here.
    });
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [enabled, sessionId]);

  return (
    <>
      <button
        type="button"
        onClick={() => setEnabled((v) => !v)}
        className="absolute top-3 left-3 z-30 rounded-md border bg-black/50 px-2 py-1 text-xs text-white backdrop-blur hover:bg-black/70"
        aria-label={enabled ? 'Hide captions' : 'Show captions'}
      >
        {enabled ? 'CC: ON' : 'CC: OFF'}
      </button>
      {enabled && (finals.length > 0 || partial) && (
        <div className="pointer-events-none absolute bottom-20 left-0 right-0 z-20 flex justify-center px-6">
          <div className="max-w-3xl space-y-1 rounded-md bg-black/70 px-4 py-2 text-center text-base text-white backdrop-blur">
            {finals.map((c, idx) => (
              <p key={`${c.startMs}-${idx}`} className="leading-snug">
                {c.speaker ? <span className="opacity-70">{c.speaker}: </span> : null}
                {c.text}
              </p>
            ))}
            {partial && (
              <p className="leading-snug opacity-80 italic">
                {partial.speaker ? <span className="opacity-70">{partial.speaker}: </span> : null}
                {partial.text}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
