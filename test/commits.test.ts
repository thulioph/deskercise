import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
function fixture() {
  const cwd = mkdtempSync(path.join(tmpdir(), 'deskercise-commits-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  git('config', 'core.hooksPath', '/dev/null');
  git('commit', '--allow-empty', '-m', 'legacy message before this policy');
  const base = git('rev-parse', 'HEAD');
  return { cwd, git, base, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

test('CI rejects an intermediate invalid message even when the final commit is valid', () => {
  const f = fixture();
  try {
    f.git('commit', '--allow-empty', '-m', 'fix bugs');
    f.git('commit', '--allow-empty', '-m', 'test(cli): cover the timer');
    // Run with fixture history and the repository configuration explicitly.
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/lint-commits.mjs')], {
      cwd: f.cwd, encoding: 'utf8', env: { ...process.env, FROM_SHA: f.base, TO_SHA: f.git('rev-parse', 'HEAD') },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /fix bugs/);
    assert.match(result.stdout, /test\(cli\): cover the timer/);
  } finally { f.cleanup(); }
});

test('CI validates the full multi-commit range and excludes legacy base history', () => {
  const f = fixture();
  try {
    f.git('commit', '--allow-empty', '-m', 'fix(cli): cancel pending timers');
    f.git('commit', '--allow-empty', '-m', 'feat(cli)!: change interval units');
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/lint-commits.mjs')], {
      cwd: f.cwd, encoding: 'utf8', env: { ...process.env, FROM_SHA: f.base, TO_SHA: f.git('rev-parse', 'HEAD') },
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.equal((result.stdout.match(/Checking commit/g) || []).length, 2);
    assert(!result.stdout.includes('legacy message'));
  } finally { f.cleanup(); }
});

test('merge and version messages are not exempt from validation', () => {
  for (const message of ["Merge branch 'feature'", 'v0.2.0', 'fixup! fix(cli): cancel timers']) {
    const result = spawnSync(process.execPath, [path.join(root, 'node_modules/@commitlint/cli/cli.js'), '--strict'], {
      cwd: root, input: message, encoding: 'utf8',
    });
    assert.notEqual(result.status, 0, message);
  }
});
