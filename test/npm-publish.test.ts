import assert from 'node:assert/strict';
import { test } from 'node:test';
// @ts-expect-error The publisher is a JavaScript CI script.
import { publishPackage } from '../scripts/publish-npm.mjs';

const manifest = { name: '@thulioph/deskercise', version: '0.1.7',
  publishConfig: { access: 'public', registry: 'https://registry.npmjs.org/' } };
function fixture(responses: Array<{ status: number; data?: unknown }>) {
  const calls: Array<{ command: string; args: string[] }> = [];
  return { calls, options: { manifest, tarball: './release/deskercise-0.1.7.tgz', integrity: 'sha512-verified',
    fetchMetadata: async () => {
      const response = responses.shift();
      assert(response, 'Unexpected registry request');
      return { status: response.status, ok: response.status === 200, json: async () => response.data };
    },
    publish: (command: string, args: string[]) => calls.push({ command, args }) } };
}

test('npm publishes the verified tarball publicly and uses latest for a newer version', async () => {
  const f = fixture([{ status: 404 }, { status: 200, data: { 'dist-tags': { latest: '0.1.6' } } }]);
  assert.equal(await publishPackage(f.options), 'published');
  assert.equal(f.calls[0]?.command, 'npm');
  assert.deepEqual(f.calls[0]?.args, ['publish', './release/deskercise-0.1.7.tgz', '--access', 'public',
    '--registry', 'https://registry.npmjs.org/', '--provenance=false', '--tag', 'latest']);
});

test('first publication handles an absent package', async () => {
  const f = fixture([{ status: 404 }, { status: 404 }]);
  assert.equal(await publishPackage(f.options), 'published');
  assert.equal(f.calls.length, 1);
});

test('retrying an identical published version skips npm publication', async () => {
  const f = fixture([{ status: 200, data: { dist: { integrity: 'sha512-verified' } } }]);
  assert.equal(await publishPackage(f.options), 'existing');
  assert.equal(f.calls.length, 0);
});

test('existing versions with different contents cannot be overwritten', async () => {
  const f = fixture([{ status: 200, data: { dist: { integrity: 'sha512-other' } } }]);
  await assert.rejects(publishPackage(f.options), /different package contents/);
  assert.equal(f.calls.length, 0);
});

test('registry failures abort instead of being treated as an absent version', async () => {
  for (const status of [401, 403, 429, 500]) {
    const f = fixture([{ status }]);
    await assert.rejects(publishPackage(f.options), /publication aborted/);
    assert.equal(f.calls.length, 0);
  }
});

test('an older merge completing later does not move latest backwards', async () => {
  const f = fixture([{ status: 404 }, { status: 200, data: { 'dist-tags': { latest: '0.1.10' } } }]);
  await publishPackage(f.options);
  assert.equal(f.calls[0]?.args.at(-1), 'previous');
});

test('private packages and alternate registries cannot be published by this job', async () => {
  for (const override of [{ private: true }, { publishConfig: { access: 'restricted', registry: 'https://registry.npmjs.org/' } },
    { publishConfig: { access: 'public', registry: 'https://example.com/' } }]) {
    const f = fixture([]);
    await assert.rejects(publishPackage({ ...f.options, manifest: { ...manifest, ...override } }), /publishable public package/);
    assert.equal(f.calls.length, 0);
  }
});
