import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export function prepare(_config, context) {
  const { cwd, nextRelease } = context;
  // Build and package installation do not need publication credentials. This
  // limits accidental inheritance; it does not isolate them from the job.
  const buildEnv = { ...process.env };
  for (const name of ['GH_TOKEN', 'GITHUB_TOKEN', 'NODE_AUTH_TOKEN', 'NPM_TOKEN',
    'ACTIONS_ID_TOKEN_REQUEST_URL', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN']) delete buildEnv[name];
  const run = (command, args, env = {}) => execFileSync(command, args, {
    cwd, stdio: 'inherit', env: { ...buildEnv, ...env },
  });
  run('npm', ['version', nextRelease.version, '--no-git-tag-version', '--allow-same-version', '--ignore-scripts']);
  run('npm', ['run', 'build']);
  run('npm', ['shrinkwrap']);
  run('npm', ['run', 'test:package'], { PACKAGE_DIRECTORY: 'release' });
  const filename = `deskercise-${nextRelease.version}.tgz`;
  const digest = createHash('sha256').update(readFileSync(`${cwd}/release/${filename}`)).digest('hex');
  mkdirSync(`${cwd}/release`, { recursive: true });
  writeFileSync(`${cwd}/release/SHA256SUMS`, `${digest}  ${filename}\n`);
  writeFileSync(`${cwd}/release/CHANGELOG.md`, nextRelease.notes);
}

export function publish(config, { cwd, nextRelease }) {
  const env = { ...process.env, RELEASE_VERSION: nextRelease.version, RELEASE_COMMIT: nextRelease.gitHead };
  execFileSync('bash', ['scripts/publish-release.sh'], { cwd, env, stdio: 'inherit' });
  if (config.npmPublish) execFileSync(process.execPath, ['scripts/publish-npm.mjs'], { cwd, env, stdio: 'inherit' });
  return { name: `Deskercise ${nextRelease.gitTag}` };
}
