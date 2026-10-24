import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MacNotifier } from '../src/infrastructure/Notifier.js';
import type { Exercise } from '../src/core/model.js';

const exercise: Exercise = {
  id: 'stretch', name: 'Neck stretch', bodyPart: 'neck', durationSeconds: 20,
  position: 'seated', instructions: [], caution: '', source: { title: '', url: '', adaptation: '' },
};

test('MacNotifier shows an osascript notification with the exercise and duration', async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const notifier = new MacNotifier((command, args, callback) => {
    calls.push({ command, args });
    callback(null);
  });
  await notifier.notify(exercise, 20);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'osascript');
  assert.equal(calls[0].args[0], '-e');
  assert.match(calls[0].args[1], /display notification/);
  assert.equal(calls[0].args[2], 'Deskercise · time to move');
  assert.equal(calls[0].args[3], 'Neck stretch · 20s. Return to your terminal to Start, Skip or Snooze.');
});

test('MacNotifier rejects when osascript fails', async () => {
  const notifier = new MacNotifier((_command, _args, callback) => callback(new Error('osascript unavailable')));
  await assert.rejects(() => notifier.notify(exercise, 20), /osascript unavailable/);
});
