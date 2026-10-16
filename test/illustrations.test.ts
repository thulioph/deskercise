import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { createElement, type ReactNode } from 'react';
import { Box, Text, render } from 'ink';
import { ExerciseIllustration, supportsUnicode } from '../src/presentation/ExerciseIllustration.js';
import { Screen, Terminal } from '../src/presentation/Terminal.js';
import { JsonCatalog } from '../src/infrastructure/Catalog.js';
import type { Exercise } from '../src/core/model.js';

const catalog = new JsonCatalog();
const exercise = (id: string): Exercise => catalog.exercises.find(item => item.id === id)!;
const settle = () => new Promise(resolve => setTimeout(resolve, 60));
async function output(node: ReactNode, columns = 80, rows = 40) {
  const stdout = Object.assign(new PassThrough(), { columns, rows });
  const stdin = Object.assign(new PassThrough(), { isTTY: true, setRawMode() {}, ref() {}, unref() {} });
  const stderr = new PassThrough();
  let text = '';
  stdout.on('data', chunk => { text = chunk.toString(); });
  const app = render(createElement(Box, { flexDirection: 'column' }, node,
    createElement(Text, null, 'FRAME-END')), { stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream, stderr: stderr as unknown as NodeJS.WriteStream,
    debug: true, patchConsole: false, exitOnCtrlC: false });
  await settle();
  const current = () => text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/FRAME-END\s*$/, '');
  return { stdout, current, reset: () => { text = ''; }, close: async () => {
    const exited = app.waitUntilExit(); app.unmount(); await exited; app.cleanup();
  } };
}

for (const [id, labels] of [
  ['neck-turn', ['Look left', 'Centre', 'Look right']],
  ['shoulder-rolls', ['Relax shoulders', 'Forward x3', 'Backward x3']],
  ['cross-body', ['Support above elbow', 'Across chest', 'Hold 5s; switch arms']],
] as const) {
  test(`offline illustration for ${id} follows the catalogue movement`, async () => {
    const ui = await output(createElement(ExerciseIllustration, { exerciseId: id, unicode: true }));
    try {
      assert.match(ui.current(), /Movement sketch/);
      for (const label of labels) assert.ok(ui.current().includes(label), label);
      assert.match(ui.current(), /[←→↻↺]/);
      assert.match(ui.current(), /O/);
    } finally { await ui.close(); }
  });
  test(`ASCII illustration for ${id} uses no Unicode characters`, async () => {
    const ui = await output(createElement(ExerciseIllustration, { exerciseId: id, unicode: false }));
    try {
      assert.match(ui.current(), /Movement sketch/);
      assert.match(ui.current(), /^[\x20-\x7e\n\r]*$/);
    } finally { await ui.close(); }
  });
}

test('unillustrated exercises fall back to text without an unrelated sketch', async () => {
  const ui = await output(createElement(ExerciseIllustration, { exerciseId: 'wrist-side' }));
  try { assert.equal(ui.current().trim(), ''); } finally { await ui.close(); }
});

for (const [columns, rows] of [[59, 40], [80, 29]]) {
  test(`small terminal ${columns}x${rows} omits the optional sketch`, async () => {
    const ui = await output(createElement(ExerciseIllustration, { exerciseId: 'neck-turn' }), columns, rows);
    try { assert.equal(ui.current().trim(), ''); } finally { await ui.close(); }
  });
}

test('resizing hides and restores the sketch and removes its listener on unmount', async () => {
  const ui = await output(createElement(ExerciseIllustration, { exerciseId: 'neck-turn', unicode: false }), 60, 30);
  const listeners = ui.stdout.listenerCount('resize');
  try {
    assert.match(ui.current(), /Movement sketch/);
    ui.reset(); ui.stdout.columns = 40; ui.stdout.emit('resize'); await settle();
    assert.doesNotMatch(ui.current(), /Movement sketch/);
    ui.reset(); ui.stdout.columns = 80; ui.stdout.emit('resize'); await settle();
    assert.match(ui.current(), /Movement sketch/);
  } finally { await ui.close(); }
  assert.ok(ui.stdout.listenerCount('resize') < listeners);
});

test('terminal encoding chooses ASCII for dumb or explicitly non-UTF locales', () => {
  assert.equal(supportsUnicode({ TERM: 'dumb', LANG: 'en_US.UTF-8' }), false);
  assert.equal(supportsUnicode({ LANG: 'C' }), false);
  assert.equal(supportsUnicode({ LANG: 'POSIX' }), false);
  assert.equal(supportsUnicode({ LANG: 'en_US.ISO8859-1' }), false);
  assert.equal(supportsUnicode({ LC_ALL: 'C', LANG: 'en_US.UTF-8' }), false);
  assert.equal(supportsUnicode({ LC_CTYPE: 'C', LANG: 'en_US.UTF-8' }), false);
  assert.equal(supportsUnicode({ LANG: 'C.UTF-8' }), true);
  assert.equal(supportsUnicode({ LANG: 'en_US.utf8' }), true);
  assert.equal(supportsUnicode({}), true);
});

for (const phase of ['prompt', 'exercise'] as const) {
  for (const id of ['neck-turn', 'shoulder-rolls', 'cross-body', 'wrist-side']) {
    test(`${phase} keeps all catalogue instructions, caution and source for ${id}`, async () => {
      const terminal = new Terminal();
      const selected = exercise(id);
      terminal.show({ phase, exercise: selected, demo: false });
      const ui = await output(createElement(Screen, { terminal, onExit() {} }), 120, 40);
      try {
        for (const step of selected.instructions) assert.ok(ui.current().includes(step), step);
        assert.ok(ui.current().includes(selected.caution));
        assert.ok(ui.current().includes(`Source: ${selected.source.title}`));
        assert.ok(ui.current().includes('Do not hold a stretch for the whole timer.'));
        assert.equal(ui.current().includes('Movement sketch'), id !== 'wrist-side');
      } finally { await ui.close(); }
    });
  }
}

test('small terminal keeps movement instructions and precautions as its fallback', async () => {
  const terminal = new Terminal();
  const selected = exercise('neck-turn');
  terminal.show({ phase: 'exercise', exercise: selected, demo: false });
  const ui = await output(createElement(Screen, { terminal, onExit() {} }), 120, 24);
  try {
    assert.doesNotMatch(ui.current(), /Movement sketch/);
    for (const step of selected.instructions) assert.ok(ui.current().includes(step));
    assert.ok(ui.current().includes(selected.caution));
    assert.ok(ui.current().includes(selected.source.title));
  } finally { await ui.close(); }
});

test('confirmation does not continue displaying movement cues', async () => {
  const terminal = new Terminal();
  terminal.show({ phase: 'confirm', exercise: exercise('neck-turn'), demo: false });
  const ui = await output(createElement(Screen, { terminal, onExit() {} }));
  try { assert.doesNotMatch(ui.current(), /Movement sketch/); } finally { await ui.close(); }
});
