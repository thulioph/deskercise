import { readFileSync } from 'node:fs';

export function releaseVersion(base, runNumber) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(base);
  if (!match || !/^[1-9]\d*$/.test(String(runNumber))) throw new Error('Expected a stable base version and positive CI run number.');
  const patch = Number(match[3]) + Number(runNumber);
  if (!Number.isSafeInteger(patch)) throw new Error('Release patch exceeds the safe integer range.');
  return `${match[1]}.${match[2]}.${patch}`;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  console.log(releaseVersion(version, process.env.CI_RUN_NUMBER));
}
