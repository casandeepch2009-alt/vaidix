'use client';

// ════════════════════════════════════════════════════════════════════════════
// HooksComposer — Host-only Stream D #4 control surface
// ════════════════════════════════════════════════════════════════════════════
// Lets the host create a quick hook (T/F, poll, free-form) and fire it
// instantly OR schedule it. Lists past hooks with response counts.

import { useCallback, useEffect, useState } from 'react';

type HookKind = 'TRUE_FALSE' | 'POLL' | 'ONE_WORD' | 'REPEAT_CONCEPT' | 'DILEMMA';

interface HookRow {
  id: string;
  kind: HookKind;
  prompt: string;
  options: string[] | null;
  scheduledAt: string | null;
  firedAt: string | null;
  closedAt: string | null;
}

export function HooksComposer({ sessionId }: { sessionId: string }) {
  const [hooks, setHooks] = useState<HookRow[]>([]);
  const [kind, setKind] = useState<HookKind>('TRUE_FALSE');
  const [prompt, setPrompt] = useState('');
  const [optionsRaw, setOptionsRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/classroom/sessions/${sessionId}/hooks`, { cache: 'no-store' });
      const json = (await res.json()) as { ok: boolean; data?: { hooks: HookRow[] } };
      if (json.ok && json.data) setHooks(json.data.hooks);
    } catch {
      /* ignore */
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
    const iv = setInterval(refresh, 5000);
    return () => clearInterval(iv);
  }, [refresh]);

  async function createAndFire() {
    setError(null);
    if (!prompt.trim()) {
      setError('Prompt is required');
      return;
    }
    setSubmitting(true);
    try {
      const options =
        kind === 'POLL' && optionsRaw.trim()
          ? optionsRaw
              .split(/\n|,/)
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 8)
          : undefined;
      const createRes = await fetch(`/api/classroom/sessions/${sessionId}/hooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, prompt: prompt.trim(), options }),
      });
      const createJson = (await createRes.json()) as {
        ok: boolean;
        data?: { hook: { id: string } };
        error?: { message: string };
      };
      if (!createJson.ok || !createJson.data) throw new Error(createJson.error?.message ?? 'Failed to create hook');
      const fireRes = await fetch(
        `/api/classroom/sessions/${sessionId}/hooks/${createJson.data.hook.id}/fire`,
        { method: 'POST' }
      );
      const fireJson = (await fireRes.json()) as { ok: boolean; error?: { message: string } };
      if (!fireJson.ok) throw new Error(fireJson.error?.message ?? 'Failed to fire hook');
      setPrompt('');
      setOptionsRaw('');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <p className="text-sm font-medium">Live hooks</p>
        <p className="text-xs text-muted-foreground">Drop a quick T/F or poll into the room.</p>
      </div>
      <div className="space-y-2 border-b p-3">
        <div className="flex gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as HookKind)}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="TRUE_FALSE">True / False</option>
            <option value="POLL">Poll</option>
            <option value="ONE_WORD">One-word</option>
            <option value="REPEAT_CONCEPT">Repeat concept</option>
            <option value="DILEMMA">Dilemma</option>
          </select>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Prompt (e.g. anti-VEGF safe in tractional PDR? T/F)"
          className="min-h-[60px] w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          maxLength={1000}
        />
        {kind === 'POLL' && (
          <textarea
            value={optionsRaw}
            onChange={(e) => setOptionsRaw(e.target.value)}
            placeholder="Options (comma or newline separated)"
            className="min-h-[40px] w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
        )}
        <button
          type="button"
          disabled={submitting}
          onClick={createAndFire}
          className="w-full rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Firing…' : 'Create + fire'}
        </button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex-1 overflow-y-auto">
        {hooks.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">No hooks yet.</p>
        ) : (
          <ul className="divide-y">
            {hooks.map((h) => (
              <li key={h.id} className="px-3 py-2 text-xs">
                <p className="font-medium">{h.kind.replace(/_/g, ' ')}</p>
                <p className="truncate text-muted-foreground">{h.prompt}</p>
                <p className="mt-1 text-muted-foreground">
                  {h.firedAt ? `fired ${new Date(h.firedAt).toLocaleTimeString()}` : 'queued'}
                  {h.closedAt ? ' · closed' : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
