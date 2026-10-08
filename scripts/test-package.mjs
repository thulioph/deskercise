import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const temporary = mkdtempSync(path.join(tmpdir(), 'deskercise-package-'));
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', ...options });
try {
  const packageInfo = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const packageDirectory = process.env.PACKAGE_DIRECTORY ? path.resolve(process.env.PACKAGE_DIRECTORY) : temporary;
  mkdirSync(packageDirectory, { recursive: true });
  const [packed] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', packageDirectory]));
  const files = packed.files.map(file => file.path);
  for (const required of ['dist/index.js', 'dist/infrastructure/exercises.json', 'docs/Chart.js-LICENSE.md', 'README.md']) {
    assert(files.includes(required), `Missing ${required} in the installable package`);
  }
  if (existsSync('npm-shrinkwrap.json')) assert(files.includes('npm-shrinkwrap.json'), 'Release package is missing its dependency lock');
  assert(!files.some(file => /^(src|test|node_modules)\//.test(file)), 'Package includes development files or native dependencies');
  const prefix = path.join(temporary, 'install');
  run('npm', ['install', '--global', '--prefix', prefix, '--no-audit', '--no-fund', path.join(packageDirectory, packed.filename)], { stdio: 'inherit' });
  const cli = path.join(prefix, 'bin', 'deskercise');
  assert.equal(run(cli, ['--version']).trim(), packageInfo.version);
  assert.match(run(cli, ['--help']), /start/);
  // Loads native SQLite and renders the embedded Chart.js report from the installed package.
  const data = path.join(temporary, 'data');
  run(cli, ['report', '--no-open'], { env: { ...process.env, DESKERCISE_HOME: data } });
  const report = readFileSync(path.join(data, 'report.html'), 'utf8');
  assert.match(report, /Chart/);
  console.log(`Installed package ${packageInfo.version}: version, commands, SQLite and offline report passed.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
