import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { stripVTControlCharacters } from 'node:util';
import { createElement } from 'react';
import { render } from 'ink';
import { TerminalLayout, type Snapshot } from '../src/presentation/TerminalLayout.js';

const snapshot: Snapshot = {
  view: {
    phase: 'exercise', demo: false, deadline: 30_000, durationSeconds: 60,
    exercise: {
      id: 'neck', name: 'Neck movement', bodyPart: 'neck', position: 'seated', durationSeconds: 60,
      instructions: ['Sit tall with both feet flat.', 'Move slowly and rest between repetitions.'],
      caution: 'Stop if this causes pain.',
      source: { title: 'Official movement guide', url: 'https://example.com', adaptation: 'Shortened' },
    },
  },
  choices: ['stop'], warning: 'Notification unavailable; return to this terminal.',
};

class Output extends Writable {
  columns?: number;
  isTTY = false;
  frame = '';
  constructor(columns?: number) { super(); this.columns = columns; }
  override _write(chunk: Buffer, _encoding: BufferEncoding, done: () => void) {
    this.frame = stripVTControlCharacters(chunk.toString()); done();
  }
}

async function screen(columns?: number, value: Snapshot = snapshot) {
  const stdout = new Output(columns);
  const instance = render(createElement(TerminalLayout, { snapshot: value, now: 0 }), {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: new PassThrough() as unknown as NodeJS.ReadStream,
    stderr: new PassThrough() as unknown as NodeJS.WriteStream,
    debug: true, patchConsole: false, exitOnCtrlC: false, isScreenReaderEnabled: false,
  });
  await new Promise(resolve => setTimeout(resolve, 50));
  return { stdout, instance };
}

function withinWidth(frame: string, columns: number) {
  for (const line of frame.trimEnd().split('\n')) {
    assert.ok([...line].length <= columns, `Line exceeds ${columns} columns: ${line}`);
  }
}

function completeContent(frame: string) {
  const content = frame.replace(/[│╭╮╰╯─━]/g, '').replace(/\s+/g, ' ');
  for (const text of ['Neck movement', 'Sit tall with both feet flat.', 'Move slowly and rest between repetitions.',
    'Stop if this causes pain.', 'Source: Official movement guide', '[s] Stop early',
    'Notification unavailable; return to this terminal.', 'q or Ctrl+C to end']) {
    assert.ok(content.includes(text), `Missing accessible content: ${text}`);
  }
  assert.match(frame, /00:30/);
}

test('wide terminals display exercise instructions alongside timer and actions', async () => {
  const { stdout, instance } = await screen(120);
  try {
    withinWidth(stdout.frame, 120); completeContent(stdout.frame);
    assert.ok(stdout.frame.split('\n').some(line => /1\. Sit tall.*00:30/.test(line)));
  } finally { instance.unmount(); }
});

test('compact terminals stack timer and actions before instructions without losing cautions', async () => {
  for (const columns of [20, 39, 40, 80, 99]) {
    const { stdout, instance } = await screen(columns);
    try {
      withinWidth(stdout.frame, columns); completeContent(stdout.frame);
      assert.ok(stdout.frame.indexOf('00:30') < stdout.frame.indexOf('1. Sit tall'));
      assert.ok(stdout.frame.indexOf('[s] Stop early') < stdout.frame.indexOf('1. Sit tall'));
    } finally { instance.unmount(); }
  }
});

test('layout responds to live resizing and releases its resize listener on unmount', async () => {
  const { stdout, instance } = await screen(120);
  const mountedListeners = stdout.listenerCount('resize');
  try {
    stdout.columns = 40; stdout.emit('resize');
    await new Promise(resolve => setTimeout(resolve, 50));
    withinWidth(stdout.frame, 40); completeContent(stdout.frame);
    assert.ok(stdout.frame.indexOf('00:30') < stdout.frame.indexOf('1. Sit tall'));
    stdout.columns = 120; stdout.emit('resize');
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.ok(stdout.frame.split('\n').some(line => /1\. Sit tall.*00:30/.test(line)));
  } finally { instance.unmount(); }
  assert.ok(mountedListeners >= 1);
  assert.equal(stdout.listenerCount('resize'), 0);
});

test('missing or invalid terminal widths use a readable 80-column fallback', async () => {
  for (const columns of [undefined, 0, -1, NaN]) {
    const { stdout, instance } = await screen(columns);
    try { withinWidth(stdout.frame, 80); completeContent(stdout.frame); }
    finally { instance.unmount(); }
  }
});

test('response phases preserve confirmation and available actions at compact widths', async () => {
  const { stdout, instance } = await screen(24, {
    view: { phase: 'confirm', demo: true, deadline: 30_000, message: 'Please confirm your movement.' },
    choices: ['completed', 'not-completed'],
  });
  try {
    withinWidth(stdout.frame, 24);
    const content = stdout.frame.replace(/[│╭╮╰╯─━]/g, '').replace(/\s+/g, ' ');
    for (const text of ['00:30 to respond', 'Did you perform the exercise?', '[y] Completed', '[n] Not completed', 'Please confirm your movement.']) {
      assert.ok(content.includes(text), `Missing confirmation content: ${text}`);
    }
  } finally { instance.unmount(); }
});
