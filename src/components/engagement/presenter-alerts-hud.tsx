'use client';

// ════════════════════════════════════════════════════════════════════════════
// PresenterAlertsHud — Stream D #5
// ════════════════════════════════════════════════════════════════════════════
// Host-only HUD that subscribes to /api/classroom/sessions/[id]/presenter-alerts
// SSE stream. Shows incoming alerts in a stack; clicking ack POSTs to /ack.
// Hidden from learners.

import { useEffect, useRef, useState } from 'react';

interface AlertItem {
  id: string;
  kind: 'ENGAGEMENT_LOW' | 'ATTENTION_DROPPING' | 'ASK_QUESTION' | 'TOO_MUCH_LECTURE' | 'TIME_REMAINING';
  severity: 'INFO' | 'WARN' | 'HIGH';
  message: string;
  createdAt: string;
}

const TONE_BY_SEVERITY: Record<AlertItem['severity'], string> = {
  INFO: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  WARN: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  HIGH: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
};

export function PresenterAlertsHud({
  sessionId,
  isHost,
}: {
  sessionId: string;
  isHost: boolean;
}) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isHost) return;
    const url = `/api/classroom/sessions/${sessionId}/presenter-alerts`;
    const es = new EventSource(url, { withCredentials: true });
    es.addEventListener('alert', (ev) => {
      try {
        const alert = JSON.parse((ev as MessageEvent).data) as AlertItem;
        if (seenIds.current.has(alert.id)) return;
        seenIds.current.add(alert.id);
        setAlerts((prev) => [alert, ...prev].slice(0, 5));
      } catch {
        /* ignore malformed events */
      }
    });
    es.addEventListener('error', () => {
      // Browser auto-reconnects on connection drops; nothing to do here.
    });
    return () => es.close();
  }, [sessionId, isHost]);

  async function ack(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    try {
      await fetch(
        `/api/classroom/sessions/${sessionId}/presenter-alerts/${id}/ack`,
        { method: 'POST', credentials: 'include' }
      );
    } catch {
      // If ack fails the next SSE tick re-delivers — UI removed it optimistically.
    }
  }

  if (!isHost || alerts.length === 0) return null;

  return (
    <div className="pointer-events-auto fixed top-20 right-4 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className={`rounded-lg border px-3 py-2 text-sm shadow-md ${TONE_BY_SEVERITY[a.severity]}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">{a.kind.replace(/_/g, ' ')}</p>
              <p className="text-xs opacity-90">{a.message}</p>
            </div>
            <button
              type="button"
              className="rounded-md border px-2 py-0.5 text-xs hover:bg-background/50"
              onClick={() => ack(a.id)}
            >
              Got it
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
