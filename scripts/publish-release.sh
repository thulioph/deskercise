#!/usr/bin/env bash
set -euo pipefail

: "${RELEASE_VERSION:?Missing release version}"
: "${RELEASE_COMMIT:?Missing validated commit}"
: "${GH_REPO:?Missing repository}"
tag="v$RELEASE_VERSION"
package="deskercise-$RELEASE_VERSION.tgz"

# Never replace a published version. Resume an incomplete draft on a rerun.
if metadata=$(gh release view "$tag" --json isDraft,targetCommitish 2>&1); then
  target=$(node -e 'console.log(JSON.parse(process.argv[1]).targetCommitish)' "$metadata")
  if [[ "$target" != "$RELEASE_COMMIT" ]]; then
    echo "Release $tag belongs to a different commit; refusing to overwrite it." >&2
    exit 1
  fi
  draft=$(node -e 'console.log(JSON.parse(process.argv[1]).isDraft)' "$metadata")
  if [[ "$draft" == "false" ]]; then
    echo "Release $tag is already published."
    exit 0
  fi
else
  if [[ "$metadata" != *"release not found"* ]]; then
    echo "$metadata" >&2
    exit 1
  fi
  cat > release/notes.md <<EOF
macOS CLI package. Requires Node.js 22.13+ (Node.js 24 recommended).

Download \`$package\` and \`SHA256SUMS\` from this release, then run:

\`\`\`bash
shasum -a 256 -c SHA256SUMS
npm install --global ./$package
deskercise --version
deskercise start
\`\`\`

Native dependencies are installed on your Mac. Installation requires internet access.
EOF
  cat release/CHANGELOG.md >> release/notes.md
  gh release create "$tag" --draft --verify-tag --target "$RELEASE_COMMIT" \
    --title "Deskercise $tag" --notes-file release/notes.md
fi

# Publish only after both assets are uploaded successfully.
gh release upload "$tag" "release/$package" release/SHA256SUMS release/CHANGELOG.md --clobber
gh release edit "$tag" --draft=false

