import { jsonOk, jsonError, requireAuth, parseQuery, handleUnexpected } from '@/server/services/api-helpers';
import { listCalendarEvents } from '@/server/services/calendar-service';
import { calendarQuerySchema } from '@/lib/validation/session';

export async function GET(req: Request) {
  try {
    const gate = await requireAuth();
    if (!gate.ok) return gate.response;

    const q = await parseQuery(req, calendarQuerySchema);
    if (!q.ok) return q.response;

    const from = new Date(q.data.from);
    const to = new Date(q.data.to);
    if (to <= from) return jsonError('INVALID_RANGE', '`to` must be after `from`', 400);
    // Cap window at 1 year to prevent expensive recurrence expansion
    if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
      return jsonError('RANGE_TOO_LARGE', 'Range cannot exceed 1 year', 400);
    }

    const events = await listCalendarEvents(gate.user.id, gate.user.role, from, to);
    return jsonOk({ events });
  } catch (err) {
    console.error('[GET /api/calendar/events] failed:', err);
    return handleUnexpected(err);
  }
}
