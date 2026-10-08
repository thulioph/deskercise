import type { Analytics } from './ports.js';
import type { Report, DailyStats } from './model.js';
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
  for (const event of events) {
    const day = days.find(d => d.date === dateKey(new Date(event.promptedAt)));
    if (day) day.prompted++;
    if (event.status === 'COMPLETED') {
      if (day) { day.completed++; day.seconds += event.actualSeconds; }
      parts.set(event.bodyPart, (parts.get(event.bodyPart) ?? 0) + 1);
    }
  }
  const completed = counts('COMPLETED');
  return { from: start.toISOString(), to: end.toISOString(), totalPrompted: events.length, completed,
    skipped: counts('SKIPPED'), expired: counts('EXPIRED'), interrupted: counts('INTERRUPTED'),
    cancelled: counts('CANCELLED'), unconfirmed: counts('UNCONFIRMED'),
    pending: counts('PROMPTED') + counts('SNOOZED') + counts('STARTED'),
    snoozes: events.reduce((s, e) => s + e.snoozeCount, 0),
    activeSeconds: events.filter(e => e.status === 'COMPLETED').reduce((s, e) => s + e.actualSeconds, 0),
    completionRate: events.length ? completed / events.length * 100 : 0, days,
    bodyParts: [...parts].map(([name, count]) => ({ name, completed: count })) };
}
