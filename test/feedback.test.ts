import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { act, createElement, type ReactElement } from 'react';
import { render, type Instance } from 'ink';
import type { View } from '../src/core/model.js';
import { TimerFeedback } from '../src/presentation/TimerFeedback.js';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function screen(node: ReactElement) {
  let output = '';
  const stdout = Object.assign(new Writable({ write(chunk, _encoding, callback) {
    output += chunk.toString(); callback();
  } }), { columns: 120, isTTY: false });
  const stdin = new PassThrough();
  let instance: Instance;
  await act(async () => {
    instance = render(node, { stdout: stdout as NodeJS.WriteStream, stdin: stdin as NodeJS.ReadStream,
      stderr: stdout as NodeJS.WriteStream, debug: true, patchConsole: false, exitOnCtrlC: false });
  });
  return {
    output: () => output,
    async update(next: ReactElement) { output = ''; await act(async () => { instance.rerender(next); }); },
    async close() { await act(async () => { instance.unmount(); }); instance.cleanup(); stdin.destroy(); stdout.destroy(); },
  };
}

const now = 10_000;
const feedback = (view: View, time = now) => createElement(TimerFeedback, { view, now: time });

test('exercise feedback renders remaining time and elapsed progress as time advances', async () => {
  const view: View = { phase: 'exercise', deadline: now + 60_000, durationSeconds: 60, demo: false };
  const ui = await screen(feedback(view));
  try {
    assert.match(ui.output(), /Movement break remaining: 01:00/);
    assert.match(ui.output(), /0% elapsed/);
    assert.match(ui.output(), /Follow the listed movements, then rest/);
    await ui.update(feedback(view, now + 30_000));
    assert.match(ui.output(), /Movement break remaining: 00:30/);
    assert.match(ui.output(), /50% elapsed/);
    assert.match(ui.output(), /━{12}─{12}/);
    await ui.update(feedback(view, now + 90_000));
    assert.match(ui.output(), /Movement break remaining: 00:00/);
    assert.match(ui.output(), /100% elapsed/);
    assert.doesNotMatch(ui.output(), /Completed and saved/);
  } finally { await ui.close(); }
});

test('remaining time rounds up and clamps to the planned duration after a clock change', async () => {
  const view: View = { phase: 'exercise', deadline: now + 60_000, durationSeconds: 60, demo: false };
  const ui = await screen(feedback(view, now + 1));
  try {
    assert.match(ui.output(), /01:00/);
    await ui.update(feedback(view, now - 120_000));
    assert.match(ui.output(), /01:00/);
    assert.match(ui.output(), /0% elapsed/);
  } finally { await ui.close(); }
});

test('waiting and snoozing label their own countdown without claiming completion', async () => {
  const ui = await screen(feedback({ phase: 'waiting', deadline: now + 120_000, durationSeconds: 120, demo: false }));
  try {
    assert.match(ui.output(), /Next movement break in: 02:00/);
    assert.match(ui.output(), /Focus time/);
    await ui.update(feedback({ phase: 'snoozing', deadline: now + 600_000, durationSeconds: 600, demo: false }));
    assert.match(ui.output(), /Same exercise returns in: 10:00/);
    assert.doesNotMatch(ui.output(), /Completed and saved/);
  } finally { await ui.close(); }
});

test('prompt and confirmation countdowns use response deadlines rather than exercise progress', async () => {
  const ui = await screen(feedback({ phase: 'prompt', deadline: now + 300_000, durationSeconds: 60, demo: false }));
  try {
    assert.match(ui.output(), /Time to respond: 05:00/);
    assert.doesNotMatch(ui.output(), /% elapsed/);
    await ui.update(feedback({ phase: 'confirm', deadline: now + 300_000, durationSeconds: 60, demo: false }));
    assert.match(ui.output(), /Time to confirm: 05:00/);
    assert.match(ui.output(), /Timer finished/);
    assert.match(ui.output(), /Completion still needs your confirmation/);
    assert.doesNotMatch(ui.output(), /% elapsed|Completed and saved/);
  } finally { await ui.close(); }
});

test('success feedback requires an explicit saved completion', async () => {
  const ui = await screen(feedback({ phase: 'done', message: 'Saved: COMPLETED. Run deskercise report to view it.', demo: false }));
  try { assert.match(ui.output(), /Completed and saved/); }
  finally { await ui.close(); }
});

for (const status of ['SKIPPED', 'EXPIRED', 'INTERRUPTED', 'CANCELLED', 'UNCONFIRMED']) {
  test(`saved ${status} feedback never celebrates completion`, async () => {
    const ui = await screen(feedback({ phase: 'done', message: `Saved: ${status}. Run deskercise report to view it.`, demo: false }));
    try {
      assert.match(ui.output(), /Session finished/);
      assert.doesNotMatch(ui.output(), /Completed and saved/);
    } finally { await ui.close(); }
  });
}

test('missing deadline and unknown result do not fabricate a timer or a success', async () => {
  const ui = await screen(feedback({ phase: 'done', demo: false }));
  try {
    assert.match(ui.output(), /Session finished/);
    assert.doesNotMatch(ui.output(), /\d\d:\d\d|Completed and saved/);
  } finally { await ui.close(); }
});
