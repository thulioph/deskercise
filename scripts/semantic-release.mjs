import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import semanticRelease from 'semantic-release';
import { generateNotes } from '@semantic-release/release-notes-generator';
import semver from 'semver';
import config, { commitOptions } from '../release.config.mjs';
import { prepare, publish } from './semantic-release-plugin.mjs';

// semantic-release pushes a tag before publishing. Resume that exact version
// after a publication failure instead of treating it as an already finished run.
export async function release({ cwd = process.cwd(), dryRun = false } = {}) {
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const gitHead = git(['rev-parse', 'HEAD']);
  const branch = git(['branch', '--show-current']);
  if (!dryRun && (process.env.GITHUB_EVENT_NAME !== 'push' || process.env.GITHUB_REF !== 'refs/heads/main' || branch !== 'main')) {
    throw new Error('Publication is allowed only from a main-branch push. Use release:dry-run to preview.');
  }
  if (!dryRun && process.env.RELEASE_COMMIT !== gitHead) throw new Error('HEAD must match the validated release commit.');
  // Checkout fetches all tags; semantic-release authenticates its own Git fetch/push.
  const tags = git(['tag', '--merged', 'HEAD']).split('\n')
    .filter(tag => /^v\d+\.\d+\.\d+$/.test(tag) && semver.valid(tag.slice(1)))
    .sort((a, b) => semver.rcompare(a.slice(1), b.slice(1)));
  const tag = tags[0];
  if (!dryRun && tag && git(['rev-list', '-n', '1', tag]) === gitHead) {
    const metadata = spawnSync('gh', ['release', 'view', tag, '--json', 'isDraft,targetCommitish'], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (metadata.error) throw metadata.error;
    if (metadata.status !== 0 && !/release not found/i.test(metadata.stderr)) {
      throw new Error(`Cannot inspect tagged release: ${metadata.stderr}`);
    }
    const existing = metadata.status === 0 ? JSON.parse(metadata.stdout) : undefined;
    if (existing && existing.targetCommitish !== gitHead) throw new Error('Tagged release belongs to a different commit.');
    const pluginConfig = config.plugins.at(-1)[1];
    if (existing && !existing.isDraft && !pluginConfig.npmPublish) {
      console.log(`${tag} is already published.`);
      return false;
    }
    const previous = tags[1];
    const hashes = git(['rev-list', previous ? `${previous}..HEAD` : 'HEAD']).split('\n').filter(Boolean);
    const context = { cwd, options: config, logger: console,
      commits: hashes.map(hash => ({ hash, message: git(['show', '-s', '--format=%B', hash]) })),
      lastRelease: previous ? { gitTag: previous, version: previous.slice(1) } : {},
      nextRelease: { version: tag.slice(1), gitTag: tag, gitHead },
    };
    context.nextRelease.notes = await generateNotes(commitOptions, context);
    await prepare(pluginConfig, context);
    return publish(pluginConfig, context);
  }
  return semanticRelease({ ...config, dryRun }, { cwd });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await release({ dryRun: process.argv.includes('--dry-run') });
}
