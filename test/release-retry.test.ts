import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
// @ts-expect-error The release wrapper is a JavaScript CI script.
import { release } from '../scripts/semantic-release.mjs';
// @ts-expect-error The configuration is a JavaScript build configuration.
import config from '../release.config.mjs';

async function retry(mode: string, npmPublish = false) {
  const cwd = mkdtempSync(path.join(tmpdir(), 'deskercise-retry-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const saved = { ...process.env };
  const pluginConfig = config.plugins.at(-1)[1];
  const previousOption = pluginConfig.npmPublish;
  try {
    git('init', '-b', 'main');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.com');
    git('config', 'core.hooksPath', '/dev/null');
    git('commit', '--allow-empty', '-m', 'chore: initialize');
    git('tag', 'v0.1.4');
    git('commit', '--allow-empty', '-m', 'fix(cli): cancel pending timers');
    git('tag', 'v0.1.5');
    mkdirSync(path.join(cwd, 'scripts'));
    mkdirSync(path.join(cwd, 'bin'));
    copyFileSync(new URL('../scripts/publish-release.sh', import.meta.url), path.join(cwd, 'scripts/publish-release.sh'));
    writeFileSync(path.join(cwd, 'bin/npm'), `#!/usr/bin/env node
const fs = require('node:fs'); const args = process.argv.slice(2);
fs.appendFileSync('calls.jsonl', JSON.stringify(['npm', ...args]) + '\\n');
const credentialNames = ['GH_TOKEN', 'GITHUB_TOKEN', 'NODE_AUTH_TOKEN', 'NPM_TOKEN', 'ACTIONS_ID_TOKEN_REQUEST_URL', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN'];
if (credentialNames.some(name => process.env[name])) { console.error('Build inherited publication credentials'); process.exit(1); }
if (args[0] === 'version') fs.writeFileSync('version.txt', args[1]);
if (args[1] === 'test:package') { fs.mkdirSync('release', {recursive:true}); fs.writeFileSync('release/deskercise-' + fs.readFileSync('version.txt', 'utf8') + '.tgz', 'verified package'); }
`, { mode: 0o755 });
    writeFileSync(path.join(cwd, 'bin/gh'), `#!/usr/bin/env node
const fs = require('node:fs'); const args = process.argv.slice(2);
fs.appendFileSync('calls.jsonl', JSON.stringify(['gh', ...args]) + '\\n');
if (args[1] === 'view') {
  if (process.env.RETRY_MODE === 'missing') { console.error('release not found'); process.exit(1); }
  if (process.env.RETRY_MODE === 'error') { console.error('HTTP 403: forbidden'); process.exit(1); }
  console.log(JSON.stringify({isDraft: process.env.RETRY_MODE === 'draft', targetCommitish: process.env.RELEASE_COMMIT}));
}
`, { mode: 0o755 });
    writeFileSync(path.join(cwd, 'scripts/publish-npm.mjs'), `import { appendFileSync } from 'node:fs'; appendFileSync('calls.jsonl', JSON.stringify(['publish-npm', process.env.RELEASE_VERSION, process.env.RELEASE_COMMIT]) + '\\n');`);
    Object.assign(process.env, { PATH: `${cwd}/bin:${saved.PATH}`, RETRY_MODE: mode,
      GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', RELEASE_COMMIT: git('rev-parse', 'HEAD'), GH_REPO: 'example/deskercise',
      GH_TOKEN: 'test-token', GITHUB_TOKEN: 'test-token', NODE_AUTH_TOKEN: 'test-token', NPM_TOKEN: 'test-token',
      ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.com', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'test-token' });
    pluginConfig.npmPublish = npmPublish;
    let error: unknown;
    try { await release({ cwd }); } catch (caught) { error = caught; }
    return { error, sha: git('rev-parse', 'HEAD'), calls: readFileSync(path.join(cwd, 'calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line) as string[]),
      notes: existsSync(path.join(cwd, 'release/CHANGELOG.md')) ? readFileSync(path.join(cwd, 'release/CHANGELOG.md'), 'utf8') : '' };
  } finally {
    pluginConfig.npmPublish = previousOption;
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('a pushed tag with an absent release or unfinished draft resumes the same semantic version', async () => {
  for (const mode of ['missing', 'draft']) {
    const result = await retry(mode);
    assert.ifError(result.error);
    assert(result.calls.some(call => call[0] === 'npm' && call[1] === 'version' && call[2] === '0.1.5'));
    assert(result.calls.some(call => call[0] === 'gh' && call[2] === 'upload'));
    assert(result.calls.some(call => call[0] === 'gh' && call[2] === 'edit'));
    assert.match(result.notes, /0\.1\.5/);
    assert.match(result.notes, /cancel pending timers/);
  }
});

test('a completed GitHub release is not repackaged or modified on retry', async () => {
  const result = await retry('published');
  assert.ifError(result.error);
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0][2], 'view');
});

test('release lookup failures stop recovery without packaging or publication', async () => {
  const result = await retry('error');
  assert.match(String(result.error), /Cannot inspect tagged release/);
  assert.equal(result.calls.length, 1);
});

test('npm integration resumes publication with the same version after GitHub is complete', async () => {
  const result = await retry('published', true);
  assert.ifError(result.error);
  assert.deepEqual(result.calls.at(-1), ['publish-npm', '0.1.5', result.sha]);
  assert(!result.calls.some(call => call[0] === 'gh' && call[2] === 'upload'));
});
