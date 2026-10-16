import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { StartTimer, type TimerOptions } from '../src/core/StartTimer.js';
import { getReport } from '../src/core/GetReport.js';
import type { Clock, Interaction } from '../src/core/ports.js';
import type { View, Exercise } from '../src/core/model.js';
import { SQLiteAnalytics } from '../src/infrastructure/SQLiteAnalytics.js';
import { JsonCatalog } from '../src/infrastructure/Catalog.js';
import { validInterval, readConfig, writeConfig } from '../src/infrastructure/config.js';
class FakeClock implements Clock {
  value = new Date('2026-10-08T12:00:00Z').getTime();
  tasks = new Set<{ deadline: number; resolve: () => void }>();
  now() { return this.value; }
  monotonic() { return this.value; }
  wait(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(signal.reason); return; }
      const entry = { deadline: this.value + ms, resolve: () => { cleanup(); resolve(); } };
      const abort = () => { cleanup(); reject(signal.reason); };
      const cleanup = () => { this.tasks.delete(entry); signal.removeEventListener('abort', abort); };
      this.tasks.add(entry); signal.addEventListener('abort', abort, { once: true });
    });
  }
  advance(ms: number) { this.value += ms; for (const t of [...this.tasks]) if (t.deadline <= this.value) t.resolve(); }
}
class FakeUI implements Interaction {
  views: View[] = []; choices: readonly string[] = []; reply?: (value: string) => void; warnings: string[] = [];
  show(view: View) { this.views.push(view); }
  warn(message: string) { this.warnings.push(message); }
  ask(choices: readonly string[], signal: AbortSignal): Promise<string> {
    this.choices = choices;
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(signal.reason); return; }
      const cleanup = () => { signal.removeEventListener('abort', abort); this.reply = undefined; };
      const abort = () => { cleanup(); reject(signal.reason); };
      this.reply = value => { assert.ok(choices.includes(value)); cleanup(); resolve(value); };
      signal.addEventListener('abort', abort, { once: true });
    });
  }
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const exercise: Exercise = new JsonCatalog().exercises[0]!;
const defaults: TimerOptions = { intervalMinutes: 1, snoozeSeconds: 600, promptTimeoutSeconds: 300,
  confirmationTimeoutSeconds: 300, demo: false, once: true };
function setup(extra: Partial<TimerOptions> = {}, fails = false) {
  const db = new SQLiteAnalytics(':memory:'); const clock = new FakeClock(); const ui = new FakeUI(); const signal = new AbortController();
  let id = 0; const notifications: string[] = [];
  const run = new StartTimer(db, { select: () => exercise }, clock, ui,
    { notify: async e => { notifications.push(e.id); if (fails) throw Error('notification failure'); } }, { next: () => String(++id) });
  const done = run.execute({ ...defaults, ...extra }, signal.signal);
  const events = () => db.events('2000', '2100');
  return { db, clock, ui, signal, done, events, notifications };
}
async function prompt(h: ReturnType<typeof setup>) { h.clock.advance(60_000); await flush(); assert.equal(h.ui.views.at(-1)?.phase, 'prompt'); }
async function answer(h: ReturnType<typeof setup>, value: string) { assert.ok(h.ui.reply); h.ui.reply(value); await flush(); }
test('completed exercise is persisted only after explicit confirmation', async () => {
  const h = setup(); await prompt(h); await answer(h, 'start'); h.clock.advance(60_000); await flush();
  assert.equal(h.events()[0]?.status, 'STARTED'); await answer(h, 'completed'); await h.done;
  assert.equal(h.events()[0]?.status, 'COMPLETED'); assert.equal(h.events()[0]?.actualSeconds, 60);
  assert.equal(h.ui.views.at(-1)?.lastResult, 'COMPLETED');
  const r = getReport(h.db, new Date(h.clock.now())); assert.equal(r.activeSeconds, 60); assert.equal(r.completionRate, 100);
  assert.equal(h.clock.tasks.size, 0); h.db.close();
});
test('two snoozes retain the same exercise and count as one prompt', async () => {
  const h = setup(); await prompt(h);
  for (let i = 0; i < 2; i++) { await answer(h, 'snooze'); h.clock.advance(600_000); await flush(); }
  await answer(h, 'skip'); await h.done;
  assert.equal(h.events().length, 1); assert.equal(h.events()[0]?.snoozeCount, 2);
  assert.deepEqual(h.notifications, [exercise.id, exercise.id, exercise.id]);
  assert.equal(getReport(h.db, new Date(h.clock.now())).totalPrompted, 1); h.db.close();
});
test('unanswered exercise expires separately from an explicit skip', async () => {
  const h = setup(); await prompt(h); h.clock.advance(300_000); await h.done;
  assert.equal(h.events()[0]?.status, 'EXPIRED'); assert.equal(h.clock.tasks.size, 0); h.db.close();
});
test('finished timer without confirmation records no confirmed activity', async () => {
  const h = setup(); await prompt(h); await answer(h, 'start'); h.clock.advance(60_000); await flush();
  h.clock.advance(300_000); await h.done;
  assert.equal(h.events()[0]?.status, 'UNCONFIRMED'); assert.equal(getReport(h.db, new Date(h.clock.now())).activeSeconds, 0); h.db.close();
});
test('stopping early records elapsed timer seconds without inflating completed minutes', async () => {
  const h = setup(); await prompt(h); await answer(h, 'start'); h.clock.advance(20_000); await answer(h, 'stop'); await h.done;
  assert.equal(h.events()[0]?.status, 'INTERRUPTED'); assert.equal(h.events()[0]?.actualSeconds, 20);
  assert.equal(getReport(h.db, new Date(h.clock.now())).activeSeconds, 0); h.db.close();
});
test('next interval begins after the previous exercise is resolved', async () => {
  const h = setup({ once: false }); await prompt(h); h.clock.advance(120_000); await answer(h, 'skip');
  h.clock.advance(59_999); await flush(); assert.equal(h.events().length, 1);
  h.clock.advance(1); await flush(); assert.equal(h.events().length, 2);
  h.signal.abort(); await h.done; h.db.close();
});
test('next focus interval carries only the last explicitly resolved result', async () => {
  const h = setup({ once: false });
  assert.equal(h.ui.views.at(-1)?.lastResult, undefined);
  await prompt(h); await answer(h, 'start'); h.clock.advance(60_000); await flush();
  assert.equal(h.ui.views.at(-1)?.phase, 'confirm');
  assert.equal(h.ui.views.at(-1)?.lastResult, undefined);
  await answer(h, 'completed');
  assert.equal(h.ui.views.at(-1)?.phase, 'waiting');
  assert.equal(h.ui.views.at(-1)?.lastResult, 'COMPLETED');
  await prompt(h); await answer(h, 'skip');
  assert.equal(h.ui.views.at(-1)?.lastResult, 'SKIPPED');
  h.signal.abort(); await h.done; h.db.close();
});
for (const phase of ['waiting','prompt','snoozing','exercise','confirm'] as const) {
  test(`abort in ${phase} releases all timers and records a final state`, async () => {
    const h = setup();
    if (phase !== 'waiting') await prompt(h);
    if (phase === 'snoozing') await answer(h, 'snooze');
    if (phase === 'exercise' || phase === 'confirm') { await answer(h, 'start'); h.clock.advance(10_000); }
    if (phase === 'confirm') { h.clock.advance(50_000); await flush(); }
    h.signal.abort(); await h.done;
    assert.equal(h.clock.tasks.size, 0);
    if (phase === 'waiting') assert.equal(h.events().length, 0);
    else assert.equal(h.events()[0]?.status, ['exercise','confirm'].includes(phase) ? 'INTERRUPTED' : 'CANCELLED');
    h.db.close();
  });
}
test('notification failure leaves the terminal interaction usable', async () => {
  const h = setup({}, true); await prompt(h); await answer(h, 'skip'); await h.done;
  assert.equal(h.ui.warnings.length, 1); assert.equal(h.events()[0]?.status, 'SKIPPED'); h.db.close();
});
test('SQLite persists sessions and action history after reopening', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'deskercise-')); const filename = path.join(directory, 'data.db');
  const db = new SQLiteAnalytics(filename);
  db.startSession({ id: 'session', startedAt: '2026-10-08T10:00:00Z', intervalMinutes: 45, demo: false });
  const event = { id:'event', sessionId:'session', exerciseId:exercise.id, exerciseName:exercise.name, bodyPart:exercise.bodyPart,
    promptedAt:'2026-10-08T10:45:00Z', startedAt:null, resolvedAt:null, plannedSeconds:60, actualSeconds:0,
    status:'PROMPTED' as const, snoozeCount:0 };
  db.saveEvent(event, {eventId:event.id, at:event.promptedAt, status:'PROMPTED'});
  db.saveEvent({...event,status:'SKIPPED',resolvedAt:'2026-10-08T10:46:00Z'}, {eventId:event.id,at:'2026-10-08T10:46:00Z',status:'SKIPPED'});
  db.endSession('session','2026-10-08T10:46:00Z'); db.close();
  const reopened = new SQLiteAnalytics(filename); assert.equal(reopened.events('2000','2100')[0]?.status,'SKIPPED'); reopened.close();
  const raw = new Database(filename); assert.equal((raw.prepare('SELECT count(*) AS n FROM exercise_actions').get() as {n:number}).n,2);
  assert.equal((raw.prepare('SELECT ended_at FROM sessions').get() as {ended_at:string}).ended_at,'2026-10-08T10:46:00Z');
  raw.close(); rmSync(directory,{recursive:true});
});
test('catalog is sourced, includes 15 workplace exercises and avoids consecutive repeats', () => {
  const catalog = new JsonCatalog(); assert.equal(catalog.exercises.length,15);
  let previous = catalog.select(); for(let i=0;i<50;i++) { const next = catalog.select(previous.id); assert.notEqual(next.id,previous.id); previous = next; }
  for (const e of catalog.exercises) { assert.ok(e.source.url.startsWith('https://')); assert.equal(e.durationSeconds,60); }
});
test('config is persisted and invalid intervals are rejected', () => {
  const root = mkdtempSync(path.join(tmpdir(),'deskercise-'));
  assert.equal(readConfig(root),undefined); writeConfig(root,30); assert.equal(readConfig(root),30);
  for(const value of ['0','-1','NaN','Infinity','481','']) assert.throws(()=>validInterval(value));
  assert.equal(validInterval('0.05'),0.05); rmSync(root,{recursive:true});
});
