import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

function publish(metadata?: { isDraft: boolean; targetCommitish: string }, uploadFails = false) {
  const directory = mkdtempSync(path.join(tmpdir(), 'deskercise-publish-'));
  const log = path.join(directory, 'calls.jsonl');
  mkdirSync(path.join(directory, 'release'));
  writeFileSync(path.join(directory, 'release/CHANGELOG.md'), '### Bug Fixes\n\n* fix timer\n');
  const fakeGh = path.join(directory, 'gh');
  writeFileSync(fakeGh, `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(process.env.CALL_LOG, JSON.stringify(args) + '\\n');
if (args[1] === 'view') {
  if (!process.env.RELEASE_METADATA) { console.error('release not found'); process.exit(1); }
  console.log(process.env.RELEASE_METADATA);
}
if (args[1] === 'upload' && process.env.UPLOAD_FAILS === 'true') process.exit(1);
`, { mode: 0o755 });
  chmodSync(fakeGh, 0o755);
  try {
    const result = spawnSync('bash', [fileURLToPath(new URL('../scripts/publish-release.sh', import.meta.url))], {
      cwd: directory,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, GH_REPO: 'example/deskercise',
        RELEASE_VERSION: '0.1.7', RELEASE_COMMIT: 'validated-sha', CALL_LOG: log,
        RELEASE_METADATA: metadata ? JSON.stringify(metadata) : '', UPLOAD_FAILS: String(uploadFails) },
    });
    return { ...result, calls: readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line) as string[]) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('published versions are left intact on retry', () => {
  const result = publish({ isDraft: false, targetCommitish: 'validated-sha' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls.map(call => call[1]), ['view']);
});

test('new releases target the validated commit and remain drafts until assets are uploaded', () => {
  const result = publish();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls.map(call => call[1]), ['view', 'create', 'upload', 'edit']);
  assert(result.calls[1].includes('--draft'));
  assert(result.calls[1].includes('--verify-tag'));
  assert(!result.calls[1].includes('--generate-notes'));
  assert.equal(result.calls[1][result.calls[1].indexOf('--target') + 1], 'validated-sha');
});

test('incomplete drafts upload assets before publication and do not recreate the release', () => {
  const result = publish({ isDraft: true, targetCommitish: 'validated-sha' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls.map(call => call[1]), ['view', 'upload', 'edit']);
  assert(result.calls[1].includes('release/SHA256SUMS'));
  assert(result.calls[1].includes('release/CHANGELOG.md'));
  assert(result.calls[2].includes('--draft=false'));
});

test('an upload failure keeps the release unpublished', () => {
  const result = publish({ isDraft: true, targetCommitish: 'validated-sha' }, true);
  assert.notEqual(result.status, 0);
  assert(!result.calls.some(call => call[1] === 'edit'));
});

test('a version associated with another commit cannot be overwritten', () => {
  const result = publish({ isDraft: true, targetCommitish: 'other-sha' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /different commit/);
  assert.deepEqual(result.calls.map(call => call[1]), ['view']);
});

