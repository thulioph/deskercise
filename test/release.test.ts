import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error The release helper is a JavaScript build script.
import { releaseVersion } from '../scripts/release-version.mjs';

test('release versions preserve the base line and are stable when a CI run is retried', () => {
  assert.equal(releaseVersion('0.1.0', '7'), '0.1.7');
  assert.equal(releaseVersion('0.1.0', '7'), releaseVersion('0.1.0', '7'));
  assert.equal(releaseVersion('1.2.3', '8'), '1.2.11');
  assert.notEqual(releaseVersion('0.1.0', '7'), releaseVersion('0.1.0', '8'));
});

test('release versions reject invalid or unsafe input', () => {
  for (const [base, run] of [['0.1.0', undefined], ['0.1.0', '0'], ['0.1.0', '-1'], ['0.1.0', '1.5'], ['0.1.0-beta', '1'], ['0.1.0', '9007199254740992']]) {
    assert.throws(() => releaseVersion(base, run));
  }
});
