import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function lintCommits({ from, to = 'HEAD', cwd = process.cwd() } = {}) {
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  // CI passes event SHAs through environment variables, never shell expressions.
  for (const sha of [from, to]) {
    if (sha && sha !== 'HEAD' && !/^[a-f0-9]{40,64}$/.test(sha)) throw new Error('Expected a full Git commit SHA.');
  }
  const zero = from && /^0+$/.test(from);
  if (from && !zero) git(['cat-file', '-e', `${from}^{commit}`]);
  const commits = from
    ? git(['rev-list', '--reverse', zero ? to : `${from}..${to}`]).split('\n').filter(Boolean)
    : [git(['rev-parse', to])];
  if (!commits.length) throw new Error('No commits found in the requested validation range.');
  const cli = fileURLToPath(new URL('../node_modules/@commitlint/cli/cli.js', import.meta.url));
  const config = fileURLToPath(new URL('../commitlint.config.mjs', import.meta.url));
  let failed = false;
  for (const sha of commits) {
    console.log(`Checking commit ${sha}`);
    const result = spawnSync(process.execPath, [cli, '--config', config, '--strict', '--verbose'], {
      cwd, input: git(['show', '-s', '--format=%B', sha]) + '\n', encoding: 'utf8',
    });
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    if (result.error) throw result.error;
    if (result.status !== 0) failed = true;
  }
  if (failed) throw new Error('Invalid commit messages found. Amend or rebase them before merging.');
  return commits.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  lintCommits({ from: process.env.FROM_SHA, to: process.env.TO_SHA || 'HEAD' });
}
