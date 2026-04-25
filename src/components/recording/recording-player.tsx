'use client';

// ════════════════════════════════════════════════════════════════════════════
// RecordingPlayer — HLS player with caption track toggle
// ════════════════════════════════════════════════════════════════════════════
// Native <video> + hls.js. Native HLS on Safari/iOS, hls.js polyfill elsewhere.
// Captions: WebVTT tracks fed from /api/classroom/sessions/[id]/transcripts.

import { useEffect, useRef, useState } from 'react';

interface CaptionTrack {
  language: string;
  source: string;
  vttUrl: string | null;
}

interface RecordingPlayerProps {
  hlsUrl: string;
  posterUrl?: string | null;
  tracks?: CaptionTrack[];
}

const LANGUAGE_LABEL: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  te: 'Telugu',
  ta: 'Tamil',
  kn: 'Kannada',
  ml: 'Malayalam',
  mr: 'Marathi',
  bn: 'Bengali',
  ur: 'Urdu',
};

export function RecordingPlayer({ hlsUrl, posterUrl, tracks = [] }: RecordingPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<unknown>(null);
  const [activeLang, setActiveLang] = useState<string>(() => {
    const fromStorage = typeof window !== 'undefined' ? window.localStorage.getItem('vaidix.captionLang') : null;
    if (fromStorage && tracks.some((t) => t.language === fromStorage)) return fromStorage;
    return tracks.find((t) => t.language === 'en')?.language ?? tracks[0]?.language ?? 'off';
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    setError(null);

    async function attach() {
      if (!video) return;
      // Safari + iOS play HLS natively.
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
        return;
      }
      // Other browsers: dynamic import hls.js.
      try {
        const mod = await import('hls.js');
        const Hls = (mod as { default: unknown }).default as unknown as {
          isSupported: () => boolean;
          new (cfg: unknown): { loadSource: (u: string) => void; attachMedia: (v: HTMLVideoElement) => void; destroy: () => void };
        };
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setError('HLS playback not supported in this browser.');
          return;
        }
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }
    void attach();

    return () => {
      cancelled = true;
      const hls = hlsRef.current as { destroy?: () => void } | null;
      hls?.destroy?.();
      hlsRef.current = null;
      if (video) {
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [hlsUrl]);

  // Switch caption track when activeLang changes.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    Array.from(video.textTracks).forEach((tt) => {
      tt.mode = tt.language === activeLang ? 'showing' : 'hidden';
    });
    if (typeof window !== 'undefined') {
      if (activeLang === 'off') window.localStorage.removeItem('vaidix.captionLang');
      else window.localStorage.setItem('vaidix.captionLang', activeLang);
    }
  }, [activeLang, tracks]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          controls
          poster={posterUrl ?? undefined}
          className="h-full w-full"
          crossOrigin="anonymous"
          preload="metadata"
          playsInline
        >
          {tracks
            .filter((t) => !!t.vttUrl)
            .map((t) => (
              <track
                key={t.language}
                kind="captions"
                src={t.vttUrl ?? undefined}
                srcLang={t.language}
                label={LANGUAGE_LABEL[t.language] ?? t.language.toUpperCase()}
                default={t.language === activeLang}
              />
            ))}
        </video>
      </div>
      {error && <p className="text-sm text-destructive">Playback error: {error}</p>}
      {tracks.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Captions:</span>
          <button
            type="button"
            className={`rounded-full border px-3 py-1 ${
              activeLang === 'off' ? 'bg-foreground text-background' : 'bg-background hover:bg-muted'
            }`}
            onClick={() => setActiveLang('off')}
          >
            Off
          </button>
          {tracks.map((t) => (
            <button
              key={t.language}
              type="button"
              disabled={!t.vttUrl}
              className={`rounded-full border px-3 py-1 disabled:opacity-50 ${
                activeLang === t.language ? 'bg-foreground text-background' : 'bg-background hover:bg-muted'
              }`}
              onClick={() => setActiveLang(t.language)}
              title={`source: ${t.source}`}
            >
              {LANGUAGE_LABEL[t.language] ?? t.language.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
