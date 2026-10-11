import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const registry = 'https://registry.npmjs.org/';
function compareVersions(left, right) {
  const parse = version => {
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Expected a stable npm version, received ${version}`);
    return version.split('.').map(Number);
  };
  const a = parse(left), b = parse(right);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  return 0;
}

export async function publishPackage({ manifest, tarball, integrity, fetchMetadata = fetch, publish = execFileSync }) {
  if (manifest.private || manifest.publishConfig?.access !== 'public' || manifest.publishConfig?.registry !== registry) {
    throw new Error('Expected a publishable public package targeting registry.npmjs.org.');
  }
  const packageUrl = `${registry}${encodeURIComponent(manifest.name)}`;
  const getMetadata = async url => {
    const response = await fetchMetadata(url, { signal: AbortSignal.timeout(30_000) });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`npm registry request failed (${response.status}); publication aborted.`);
    return response.json();
  };
  const existing = await getMetadata(`${packageUrl}/${encodeURIComponent(manifest.version)}`);
  if (existing) {
    if (existing.dist?.integrity !== integrity) throw new Error('This npm version already exists with different package contents.');
    console.log(`${manifest.name}@${manifest.version} is already published with the same integrity.`);
    return 'existing';
  }
  const metadata = await getMetadata(packageUrl);
  const latest = metadata?.['dist-tags']?.latest;
  // Serialized release jobs may reach the queue out of commit order.
  const tag = latest && compareVersions(manifest.version, latest) < 0 ? 'previous' : 'latest';
  publish('npm', ['publish', tarball, '--access', 'public', '--registry', registry, '--provenance=false', '--tag', tag], { stdio: 'inherit' });
  return 'published';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const version = process.env.RELEASE_VERSION;
  if (!version || version !== manifest.version) throw new Error('Release version must match the verified package version.');
  const tarball = `./release/deskercise-${version}.tgz`;
  const integrity = `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`;
  await publishPackage({ manifest, tarball, integrity });
}
