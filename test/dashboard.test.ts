import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StartTimer } from '../src/core/StartTimer.js';
import type { Analytics, Clock, Interaction } from '../src/core/ports.js';
import type { Exercise, View } from '../src/core/model.js';

class FakeClock implements Clock {
  value = Date.parse('2026-10-08T12:00:00Z');
  tasks = new Set<{ deadline: number; resolve: () => void }>();
  now() { return this.value; }
  monotonic() { return this.value; }
  wait(milliseconds: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(signal.reason); return; }
      const cleanup = () => { this.tasks.delete(task); signal.removeEventListener('abort', abort); };
      const task = { deadline: this.value + milliseconds, resolve: () => { cleanup(); resolve(); } };
      const abort = () => { cleanup(); reject(signal.reason); };
      this.tasks.add(task); signal.addEventListener('abort', abort, { once: true });
    });
  }
  advance(milliseconds: number) { this.value += milliseconds; for (const task of [...this.tasks]) if (task.deadline <= this.value) task.resolve(); }
}
const exercise: Exercise = { id: 'wrists', name: 'Wrist movement', bodyPart: 'wrists', position: 'seated',
  durationSeconds: 60, instructions: ['Move gently.'], caution: 'Stop if painful.',
  source: { title: 'Reference', url: 'https://example.com', adaptation: 'Shortened' } };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function setup(demo = false, once = false) {
  const clock = new FakeClock(); const signal = new AbortController(); const views: View[] = [];
  let reply: ((value: string) => void) | undefined;
  const ui: Interaction = {
    show: view => { views.push(view); }, warn() {},
    ask: (_choices, childSignal) => new Promise((resolve, reject) => {
      const cleanup = () => { reply = undefined; childSignal.removeEventListener('abort', abort); };
      const abort = () => { cleanup(); reject(childSignal.reason); };
      reply = value => { cleanup(); resolve(value); };
      childSignal.addEventListener('abort', abort, { once: true });
    }),
  };
  const db: Analytics = { startSession() {}, endSession() {}, saveEvent() {}, events: () => [], sessionsByIds: () => [] };
  let id = 0;
  const done = new StartTimer(db, { select: () => exercise }, clock, ui, { notify: async () => {} }, { next: () => String(++id) })
    .execute({ intervalMinutes: 1, snoozeSeconds: 10, promptTimeoutSeconds: 30,
      confirmationTimeoutSeconds: 30, demo, once, exerciseSeconds: demo ? 5 : 60 }, signal.signal);
  return { clock, signal, done, views, last: () => views.at(-1)!,
    answer: async (value: string) => { assert.ok(reply); reply(value); await flush(); } };
}

test('session dashboard starts empty and retains its start time through prompt and snooze', async () => {
  const h = setup(); const startedAt = h.clock.now();
  try {
    assert.deepEqual(h.last().session, { startedAt, completed: 0, activeSeconds: 0 });
    assert.equal(h.last().deadline, startedAt + 60_000);
    h.clock.advance(60_000); await flush(); await h.answer('snooze');
    assert.equal(h.last().phase, 'snoozing'); assert.equal(h.last().deadline, h.clock.now() + 10_000);
    assert.deepEqual(h.last().session, { startedAt, completed: 0, activeSeconds: 0 });
  } finally { h.signal.abort(); await h.done; }
});

test('session dashboard counts only confirmed breaks and accumulates across intervals', async () => {
  const h = setup(); const startedAt = h.clock.now();
  try {
    for (let count = 1; count <= 2; count++) {
      h.clock.advance(60_000); await flush(); await h.answer('start');
      h.clock.advance(60_000); await flush();
      assert.equal(h.last().phase, 'confirm');
      assert.deepEqual(h.last().session, { startedAt, completed: count - 1, activeSeconds: (count - 1) * 60 });
      await h.answer('completed');
      assert.equal(h.last().phase, 'waiting');
      assert.deepEqual(h.last().session, { startedAt, completed: count, activeSeconds: count * 60 });
    }
  } finally { h.signal.abort(); await h.done; }
});

for (const outcome of ['skip', 'expired', 'stop', 'not-completed', 'unconfirmed'] as const) {
  test(`session dashboard omits ${outcome} from confirmed totals`, async () => {
    const h = setup(false, true);
    try {
      h.clock.advance(60_000); await flush();
      if (outcome === 'skip') await h.answer('skip');
      else if (outcome === 'expired') { h.clock.advance(30_000); await flush(); }
      else {
        await h.answer('start');
        h.clock.advance(outcome === 'stop' ? 20_000 : 60_000); await flush();
        if (outcome === 'stop') await h.answer('stop');
        else if (outcome === 'not-completed') await h.answer('not-completed');
        else { h.clock.advance(30_000); await flush(); }
      }
      await h.done;
      assert.equal(h.last().phase, 'done');
      assert.equal(h.last().session?.completed, 0); assert.equal(h.last().session?.activeSeconds, 0);
    } finally { h.signal.abort(); await h.done; }
  });
}

test('demo dashboard starts a fresh session and uses the actual demo window', async () => {
  const h = setup(true, true);
  try {
    assert.equal(h.last().demo, true); assert.equal(h.last().session?.completed, 0);
    h.clock.advance(60_000); await flush(); await h.answer('start');
    h.clock.advance(5_000); await flush(); await h.answer('completed'); await h.done;
    assert.equal(h.last().session?.completed, 1); assert.equal(h.last().session?.activeSeconds, 5);
  } finally { h.signal.abort(); await h.done; }
});
