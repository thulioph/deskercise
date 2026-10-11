# npm publishing setup

This change prepares **public** npm distribution as `@thulioph/deskercise` while keeping `thulioph/deskercise` private on GitHub. Published JavaScript, the exercise catalog, and package documentation are downloadable by anyone. No npm publication occurs from a draft PR or PR check.

## Confirm the npm account and package name

`@thulioph/deskercise` is the proposed npm name, based on the GitHub username. Before activating publishing, confirm that you own the `thulioph` npm user or organization scope. GitHub and npm accounts are independent. If your npm scope differs, update `package.json`, the root name entries in `package-lock.json`, and the installation examples before merging.

Create an account on [npmjs.com](https://www.npmjs.com/) and enable two-factor authentication for manual publishing. In a local checkout of this PR, using Node.js 24:

```bash
npm login
npm whoami
npm ci
npm test
npm run build
PACKAGE_DIRECTORY=release npm run test:package
npm publish ./release/deskercise-0.1.0.tgz --dry-run --access public --provenance=false
```

Review the package contents, then make the first publication interactively, completing npm's 2FA prompt:

```bash
npm publish ./release/deskercise-0.1.0.tgz --access public --provenance=false
```

The bootstrap package creates the package settings needed to configure the trusted publisher. Use an unpublished version if `0.1.0` already exists; never replace an existing name/version. The CI release line must continue above any manually published bootstrap version.

## Configure Trusted Publishing before merging

Open the package's **Settings → Trusted publishing** on npmjs.com and add a **GitHub Actions** publisher with these exact values:

| Field | Value |
|---|---|
| GitHub user/organization | `thulioph` |
| Repository | `deskercise` |
| Workflow filename | `ci.yml` |
| Environment | Leave empty; the job has no GitHub environment |
| Allowed actions | Enable direct `npm publish` |

Recent publisher configurations default to staged publishing; explicitly allow direct publication for the merge-triggered workflow. Create the publisher shortly before merging: a new configuration must complete its first successful publication within two days, or it expires and must be recreated.

The workflow grants `id-token: write` only to the main-branch Release job, uses GitHub-hosted macOS runners and npm 11.21.0, and authenticates through OIDC. It does not require an npm token in GitHub secrets. The package's `repository.url` points to the exact GitHub repository. Provenance is explicitly disabled because npm provenance is unavailable for private source repositories.

## Verify the first automated publication

After setup, merge the PR and wait for **Tests**, **Build**, and **Release** to succeed. The GitHub release asset and npm package share the same version and tarball. Check both destinations, then install:

```bash
npm view @thulioph/deskercise version
npm install --global @thulioph/deskercise
deskercise --version
```

Versions come from Semantic Release and Conventional Commits, as described in the README: `fix`/`perf` produce a patch, `feat` a minor, and breaking changes a major. Bootstrap with a version below the next semantic release. PR checks and dry runs never publish. The `latest` npm tag stays on the newest stable version; an older merge finishing later is published under `previous` and remains installable by its exact version.

If publication fails, inspect the Release job. Check the scope owner, publisher repository/workflow fields, direct-publish permission, configuration expiry, and package access. Fix the npm configuration and rerun the failed job. An existing package version is skipped only when its SHA-512 integrity matches the local verified tarball; conflicting bytes stop the workflow.

## References

- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
- [Publishing scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
- [2FA for package publishing](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/)
- [GitHub release concurrency queues](https://github.blog/changelog/2026-05-07-github-actions-concurrency-groups-now-allow-larger-queues/)
