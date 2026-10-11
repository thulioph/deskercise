import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export function prepare(_config, context) {
  const { cwd, nextRelease } = context;
  const run = (command, args, env = {}) => execFileSync(command, args, {
    cwd, stdio: 'inherit', env: { ...process.env, ...env },
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
