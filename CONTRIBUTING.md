# Contributing

Use **Node.js 24** for development and CI. Install dependencies with `npm ci`;
this also installs the Husky `commit-msg` hook in a Git checkout.

## Commit messages

Every commit must follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```text
<type>(optional-scope): <short description>
```

Examples:

```text
feat(cli): add a snooze option
fix(timer): cancel pending timers on exit
docs(readme): explain local history
test(report): cover an empty week
feat(cli)!: change interval units to seconds
```

Allowed types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`,
`revert`, `style`, and `test`. Use a lowercase type and an imperative description.
Mark incompatible changes with `!` after the type/scope or a `BREAKING CHANGE:`
footer explaining the change and how to migrate.

The local hook validates the message before committing. GitHub CI checks **every
commit** in a PR (`base..head`) and every commit introduced by a push to `main`
(`before..after`), including intermediate commits. A manual CI run validates its
selected commit. Default Commitlint exemptions for merge/version messages are
disabled. A valid final commit or PR title does not hide an earlier invalid message.

Before opening a PR:

```bash
npm test
npm run check
npm run build
npm run test:package
git fetch origin
FROM_SHA=$(git rev-parse origin/main) TO_SHA=$(git rev-parse HEAD) npm run lint:commits
```

To correct your latest message, run `git commit --amend`. To correct earlier
messages or combine temporary commits:

```bash
git rebase -i origin/main
# Mark messages as reword, or combine temporary commits using fixup/squash.
git push --force-with-lease
```

Rewrite your own PR branch only; coordinate before changing a shared branch.
Re-run validation after rebasing. Keep feature commits separate when they describe
independent changes.

## Merging and repository setup

Use **Rebase and merge** so individual validated commits remain in a linear
history. After adopting this change, the maintainer should open **Settings →
General → Pull Requests**, enable **Allow rebase merging**, and disable **Allow
merge commits** and **Allow squash merging**. Repository settings cannot be
versioned by this PR.

Wait for **Commit messages**, **Tests**, and **Build** to pass before merging.
No branch protection or ruleset is introduced. Consequently, GitHub can still
allow merges with failing checks and direct pushes to `main`; local hooks can
also be bypassed. The Release job requires all three checks to succeed.

## Versioning and releases

[Semantic Release](https://semantic-release.org/) analyzes commits since the
latest reachable `v<version>` tag. Existing versions, including `v0.1.4`, remain
valid; there is no run-number version calculation or manual version bump.

| Commit change | Release |
|---|---|
| `fix`, `perf` | Patch, e.g. `0.1.4` → `0.1.5` |
| `feat` | Minor, e.g. `0.1.4` → `0.2.0` |
| Any type with `!` or `BREAKING CHANGE:` | Major, e.g. `0.1.4` → `1.0.0` |
| Only docs, tests, refactoring, CI, build or chores | No release by default |

The largest change since the previous release determines the version. These
rules also apply while the app is at `0.x`. Documentation and maintenance commits
are retained and analyzed with the next releasable change.

Only a successful push to `main` can publish. Release jobs are serialized;
Semantic Release skips an outdated main run when a newer main commit exists.
The later successful run includes all commits since the previous release.
PRs and manual workflow runs never publish.

The release plugin applies the selected version locally, rebuilds, creates an
npm shrinkwrap, and installs/tests the exact tarball. Semantic Release tags the
validated source commit, then the publisher uploads `deskercise-<version>.tgz`,
`SHA256SUMS`, and an automatically generated `CHANGELOG.md`. The same changelog
appears in the GitHub Release notes. Versions/changelogs are not committed back
to `main`, so no bot commit or extra CI run is needed.

To preview from a clean, up-to-date checkout on `main`, with GitHub access:

```bash
npm run release:dry-run
```

A dry run checks Git access and computes the version/notes but skips preparation,
tag creation, asset uploads, and npm publication. It may fetch Git refs.

If publication fails after the tag was pushed, rerun the failed Release job. The
wrapper resumes the tagged version at that exact commit, rebuilds its package,
and resumes its draft. A completed GitHub release is left intact. Errors while
looking up a release fail the run rather than being treated as an absent release.

## Integrating npm publishing (PR #3)

This PR publishes GitHub Releases only. PR #3 introduces the public scoped npm
package and Trusted Publishing. When combining them:

1. Keep this PR's commit validation and Semantic Release flow in `ci.yml`.
   Remove the old `Assign release version` step and any extra publication step
   outside Semantic Release, so a no-release result cannot publish a package.
2. Keep PR #3's scoped manifest, npm setup guide, `publish-npm.mjs`, tests, npm
   dry-run build check, Release-job `id-token: write`, and OIDC-capable npm setup.
   The trusted publisher must still target **ci.yml**.
3. Set the local plugin's `npmPublish` option to `true` in `release.config.mjs`.
   It passes the single semantic version and validated commit to both publishers;
   npm receives the same verified tarball as GitHub.
4. Complete npm's account-side setup before enabling publication. Bootstrap with
   a version below the next semantic release, and replace the run-number wording
   in `docs/npm-publishing.md` with the rules above.

The tarball helper already preserves `deskercise-<version>.tgz` when the package
name is scoped. PR #3's integrity checks and retry handling remain in its npm
publisher. With npm enabled, a rerun also resumes npm after a completed GitHub
release. Do not merge the two competing workflow versions without resolving them.
