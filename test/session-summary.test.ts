import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { createElement } from 'react';
import { render } from 'ink';
import type { View } from '../src/core/model.js';
import { SessionSummary } from '../src/presentation/SessionSummary.js';

async function output(view: View, now: number) {
  const stream = new PassThrough(); let text = '';
  Object.assign(stream, { columns: 100 });
  stream.on('data', chunk => { text += chunk.toString(); });
  const app = render(createElement(SessionSummary, { view, now }), {
    stdout: stream as unknown as NodeJS.WriteStream, debug: true, patchConsole: false, exitOnCtrlC: false,
  });
  await new Promise(resolve => setImmediate(resolve));
  app.unmount(); await app.waitUntilExit();
  return text;
}
const startedAt = Date.parse('2026-10-08T12:00:00Z');
const session = { startedAt, completed: 2, activeSeconds: 120 };

test('dashboard renders session elapsed time, confirmed activity and a live next-break countdown', async () => {
  const view: View = { phase: 'waiting', demo: false, session, deadline: startedAt + 180_000, durationSeconds: 120 };
  const text = await output(view, startedAt + 65_000);
  assert.match(text, /Session: 01:05/); assert.match(text, /Completed: 2/);
  assert.match(text, /Confirmed active: 2\.0 min/); assert.match(text, /Next break: 01:55/);
  assert.match(await output(view, startedAt + 66_000), /Next break: 01:54/);
});
test('dashboard clamps expired countdowns and backwards wall-clock elapsed time', async () => {
  const view: View = { phase: 'waiting', demo: false, session, deadline: startedAt + 60_000, durationSeconds: 60 };
  assert.match(await output(view, startedAt + 70_000), /Next break: 00:00/);
  const text = await output(view, startedAt - 5_000);
  assert.match(text, /Session: 00:00/); assert.match(text, /Next break: 01:00/);
});
test('dashboard gives next-break context for each phase without inventing a future deadline', async () => {
  assert.match(await output({ phase: 'prompt', demo: false, session }, startedAt), /Next break: ready/);
  assert.match(await output({ phase: 'snoozing', demo: false, session, deadline: startedAt + 10_000, durationSeconds: 10 }, startedAt), /Next break: 00:10/);
  for (const phase of ['exercise', 'confirm'] as const) {
    assert.match(await output({ phase, demo: false, session }, startedAt), /Next break: after this exercise/);
  }
  assert.doesNotMatch(await output({ phase: 'done', demo: false, session }, startedAt), /Next break:/);
});
test('dashboard marks demo totals and handles multi-hour sessions', async () => {
  const text = await output({ phase: 'done', demo: true, session: { ...session, activeSeconds: 5 } }, startedAt + 3_661_000);
  assert.match(text, /Demo session: 1:01:01/); assert.match(text, /Confirmed active: 0\.1 min/);
});
test('dashboard remains absent before a session begins', async () => {
  assert.doesNotMatch(await output({ phase: 'waiting', demo: false }, startedAt), /Session:|Completed:|Next break:/);
});
