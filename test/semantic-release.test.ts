import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('semantic-release continues existing tags, generates notes and uses the largest change', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'deskercise-semantic-'));
  const cwd = path.join(directory, 'source');
  const remote = path.join(directory, 'remote.git');
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    execFileSync('git', ['init', '--bare', '-b', 'main', remote], { stdio: 'ignore' });
    execFileSync('git', ['init', '-b', 'main', cwd], { stdio: 'ignore' });
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.com');
    git('config', 'core.hooksPath', '/dev/null');
    git('commit', '--allow-empty', '-m', 'chore: initialize');
    git('tag', 'v0.1.4');
    git('remote', 'add', 'origin', remote);
    const plugin = path.join(directory, 'publisher.mjs');
    writeFileSync(plugin, `import { writeFileSync } from 'node:fs';
export function publish(_, {cwd, nextRelease}) { writeFileSync(cwd + '/published.json', JSON.stringify(nextRelease)); }
`);
    // semantic-release hooks stdout; isolate it from node:test's event stream.
    const program = `
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Writable } from 'node:stream';
import semanticRelease from ${JSON.stringify(import.meta.resolve('semantic-release'))};
import config, { commitOptions } from ${JSON.stringify(new URL('../release.config.mjs', import.meta.url).href)};
const cwd = ${JSON.stringify(cwd)};
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const output = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
const options = { ...config, repositoryUrl: ${JSON.stringify(`file://${remote}`)}, ci: false, dryRun: false,
      plugins: [
        [${JSON.stringify(fileURLToPath(import.meta.resolve('@semantic-release/commit-analyzer')))}, commitOptions],
        [${JSON.stringify(fileURLToPath(import.meta.resolve('@semantic-release/release-notes-generator')))}, commitOptions],
        ${JSON.stringify(plugin)},
      ] };
    for (const [messages, version] of [
      [['fix(cli): cancel pending timers'], '0.1.5'],
      [['docs(readme): explain intervals'], null],
      [['fix(cli): handle input', 'feat(cli): add snooze'], '0.2.0'],
      [['feat(cli)!: change interval units'], '1.0.0'],
      [['refactor(core): simplify ports\\n\\nBREAKING CHANGE: remove the old timer port'], '2.0.0'],
    ]) {
      for (const message of messages) git('commit', '--allow-empty', '-m', message);
      const sha = git('rev-parse', 'HEAD');
      git('push', 'origin', 'main', '--tags');
      const result = await semanticRelease(options, { cwd, stdout: output, stderr: output,
        env: { PATH: process.env.PATH, HOME: process.env.HOME } });
      if (!version) {
        assert.equal(result, false);
        continue;
      }
      assert(result);
      assert.equal(result.nextRelease.version, version);
      assert.equal(git('rev-list', '-n', '1', 'v' + version), sha);
      assert.equal(git('rev-parse', 'HEAD'), sha, 'No version-bump commit is created');
      const published = JSON.parse(readFileSync(cwd + '/published.json', 'utf8'));
      assert.equal(published.version, version);
      assert(published.notes.includes(version));
      assert.match(published.notes, /cancel pending timers|add snooze|BREAKING CHANGES/);
    }
console.log('Semantic release scenarios passed.');
`;
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', program], {
      cwd, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME },
    });
    assert.match(result, /Semantic release scenarios passed/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
