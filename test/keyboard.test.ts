import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { Terminal } from '../src/presentation/Terminal.js';
import type { View } from '../src/core/model.js';

const up = '\u001b[A';
const down = '\u001b[B';
const enter = '\r';
const prompt = ['start', 'skip', 'snooze'];

function mount(t: TestContext) {
  const terminal = new Terminal();
  const input = Object.assign(new PassThrough(), {
    isTTY: true, setRawMode() {}, ref() {}, unref() {},
  });
  const frames: string[] = [];
  const output = Object.assign(new Writable({
    write(chunk, _encoding, done) { frames.push(String(chunk)); done(); },
  }), { isTTY: true, columns: 100, rows: 40 });
  let exits = 0;
  const instance = terminal.mount(() => { exits++; }, {
    stdin: input as unknown as NodeJS.ReadStream,
    stdout: output as unknown as NodeJS.WriteStream,
    stderr: output as unknown as NodeJS.WriteStream,
    debug: true, patchConsole: false, maxFps: 1000,
  });
  const controllers: AbortController[] = [];
  t.after(() => {
    controllers.forEach(controller => controller.abort());
    instance.unmount(); instance.cleanup(); input.destroy(); output.destroy();
  });
  const settle = () => delay(20);
  const press = async (keys: string) => { input.write(keys); await settle(); };
  const ask = async (phase: View['phase'], choices: string[]) => {
    terminal.show({ phase, demo: false });
    const controller = new AbortController(); controllers.push(controller);
    let result: string | undefined;
    const pending = terminal.ask(choices, controller.signal);
    // Attach handlers immediately so teardown cancellation cannot be unhandled.
    pending.then(value => { result = value; }, () => {});
    await settle();
    return { pending, controller, result: () => result };
  };
  const frame = () => frames.filter(value => value.includes('DESKERCISE')).at(-1) ?? '';
  return { terminal, press, ask, frame, settle, exits: () => exits };
}

test('arrow navigation highlights only valid actions and wraps at both ends', async t => {
  const h = mount(t); const ask = await h.ask('prompt', prompt);
  assert.match(h.frame(), /› \[1\] Start/);
  assert.match(h.frame(), /↑\/↓ select.*Enter choose/);
  await h.press(down); assert.match(h.frame(), /› \[2\] Skip/);
  await h.press(down); assert.match(h.frame(), /› \[3\] Snooze/);
  await h.press(down); assert.match(h.frame(), /› \[1\] Start/);
  await h.press(up); assert.match(h.frame(), /› \[3\] Snooze/);
  assert.equal(ask.result(), undefined);
  await h.press(enter); assert.equal(await ask.pending, 'snooze');
});

test('buffered arrow and Enter choose the updated selection before React redraws', async t => {
  const h = mount(t); const ask = await h.ask('prompt', prompt);
  await h.press(down + down + enter);
  assert.equal(ask.result(), 'snooze');
});

test('each prompt resets its selection, including consecutive prompts with the same choices', async t => {
  const h = mount(t); const first = await h.ask('prompt', prompt);
  await h.press(down + down); await h.press(enter);
  assert.equal(first.result(), 'snooze');
  const second = await h.ask('prompt', prompt);
  assert.match(h.frame(), /› \[1\] Start/);
  await h.press(enter); assert.equal(second.result(), 'start');
  const confirmation = await h.ask('confirm', ['completed', 'not-completed']);
  assert.match(h.frame(), /› \[y\] Completed/);
  await h.press(down + enter); assert.equal(confirmation.result(), 'not-completed');
  const exercise = await h.ask('exercise', ['stop']);
  await h.press(up + down + enter); assert.equal(exercise.result(), 'stop');
});

test('navigation and invalid shortcuts do nothing while waiting or after cancellation', async t => {
  const h = mount(t); await h.settle();
  await h.press(up + down + enter + '1');
  assert.doesNotMatch(h.frame(), /›|↑\/↓ select|Enter choose/);
  const cancelled = await h.ask('prompt', prompt); await h.press(down);
  cancelled.controller.abort(); await h.settle();
  await h.press(enter + '2'); assert.equal(cancelled.result(), undefined);
  assert.doesNotMatch(h.frame(), /›|↑\/↓ select|Enter choose/);
  const confirmation = await h.ask('confirm', ['completed', 'not-completed']);
  await h.press('1'); assert.equal(confirmation.result(), undefined);
  await h.press(enter); assert.equal(confirmation.result(), 'completed');
});

test('an older cancellation cannot erase a newer prompt or its selection', async t => {
  const h = mount(t); const old = await h.ask('prompt', prompt);
  const current = await h.ask('confirm', ['completed', 'not-completed']);
  old.controller.abort(); await h.settle();
  assert.match(h.frame(), /› \[y\] Completed/);
  await h.press(down + enter); assert.equal(current.result(), 'not-completed');
});

test('stale prompt actions cannot submit a later prompt with identical choices', async t => {
  const h = mount(t); const old = await h.ask('prompt', prompt);
  const oldRequest = h.terminal.snapshot.requestId;
  old.controller.abort(); await h.settle();
  const current = await h.ask('prompt', prompt);
  h.terminal.answer('skip', oldRequest);
  await h.settle(); assert.equal(current.result(), undefined);
  await h.press(enter); assert.equal(current.result(), 'start');
});

test('changing the visible phase immediately disables previous actions', async t => {
  const h = mount(t); const ask = await h.ask('prompt', prompt);
  h.terminal.show({ phase: 'waiting', demo: false });
  h.terminal.answer('start');
  await h.settle(); assert.equal(ask.result(), undefined);
  assert.doesNotMatch(h.frame(), /›|↑\/↓ select|Enter choose/);
});

test('numeric, stop and confirmation shortcuts still answer directly', async t => {
  const h = mount(t);
  for (const [phase, choices, key, expected] of [
    ['prompt', prompt, '1', 'start'], ['prompt', prompt, '2', 'skip'],
    ['prompt', prompt, '3', 'snooze'], ['exercise', ['stop'], 's', 'stop'],
    ['confirm', ['completed', 'not-completed'], 'y', 'completed'],
    ['confirm', ['completed', 'not-completed'], 'N', 'not-completed'],
  ] as const) {
    const ask = await h.ask(phase, [...choices]); await h.press(key);
    assert.equal(ask.result(), expected);
  }
});

test('q and Ctrl+C request graceful exit with and without an active prompt', async t => {
  const h = mount(t); await h.settle();
  await h.press('q'); assert.equal(h.exits(), 1);
  await h.ask('prompt', prompt);
  await h.press('\u0003'); assert.equal(h.exits(), 2);
});
