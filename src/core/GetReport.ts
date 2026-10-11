import type { Analytics } from './ports.js';
import type { Report, DailyStats, ExerciseStats } from './model.js';
export function getReport(db: Analytics, now: Date = new Date()): Report {
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6);
  const end = new Date(now); end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + 1);
  const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const days: DailyStats[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i);
    return { date: dateKey(d), prompted: 0, completed: 0, seconds: 0 };
  });
  const events = db.events(start.toISOString(), end.toISOString());
  const counts = (status: string) => events.filter(e => e.status === status).length;
  const parts = new Map<string, number>();
  const exerciseMap = new Map<string, { id: string; name: string; bodyPart: string; completions: number; totalSeconds: number }>();
  const responseLatencies: number[] = [];
  for (const event of events) {
    const day = days.find(d => d.date === dateKey(new Date(event.promptedAt)));
    if (day) day.prompted++;
    if (event.startedAt) {
      const lag = (Date.parse(event.startedAt) - Date.parse(event.promptedAt)) / 1000;
      if (Number.isFinite(lag) && lag >= 0) responseLatencies.push(lag);
    }
    if (event.status === 'COMPLETED') {
      if (day) { day.completed++; day.seconds += event.actualSeconds; }
      parts.set(event.bodyPart, (parts.get(event.bodyPart) ?? 0) + 1);
      const row = exerciseMap.get(event.exerciseId) ?? {
        id: event.exerciseId, name: event.exerciseName, bodyPart: event.bodyPart, completions: 0, totalSeconds: 0,
      };
      row.completions++;
      row.totalSeconds += event.actualSeconds;
      exerciseMap.set(event.exerciseId, row);
    }
  }
  const completed = counts('COMPLETED');
  const sessionIds = [...new Set(events.map(e => e.sessionId))];
  const sessions = db.sessionsByIds(sessionIds);
  const exercises: ExerciseStats[] = [...exerciseMap.values()]
    .map(e => ({ id: e.id, name: e.name, bodyPart: e.bodyPart, completions: e.completions,
      avgActualSeconds: e.completions ? e.totalSeconds / e.completions : 0 }))
    .sort((a, b) => b.completions - a.completions || a.name.localeCompare(b.name));
  return {
    from: start.toISOString(), to: end.toISOString(), totalPrompted: events.length, completed,
    skipped: counts('SKIPPED'), expired: counts('EXPIRED'), interrupted: counts('INTERRUPTED'),
    cancelled: counts('CANCELLED'), unconfirmed: counts('UNCONFIRMED'),
    pending: counts('PROMPTED') + counts('SNOOZED') + counts('STARTED'),
    snoozes: events.reduce((s, e) => s + e.snoozeCount, 0),
    activeSeconds: events.filter(e => e.status === 'COMPLETED').reduce((s, e) => s + e.actualSeconds, 0),
    completionRate: events.length ? completed / events.length * 100 : 0, days,
    bodyParts: [...parts].map(([name, count]) => ({ name, completed: count })),
    exercises, sessionCount: sessions.length,
    demoSessions: sessions.filter(s => s.demo).length,
    avgIntervalMinutes: sessions.length
      ? sessions.reduce((s, session) => s + session.intervalMinutes, 0) / sessions.length
      : null,
    avgResponseSeconds: responseLatencies.length
      ? responseLatencies.reduce((s, n) => s + n, 0) / responseLatencies.length
      : null,
  };
}
