#!/bin/bash
# Usage: release-mac.sh ["release notes"]. Zips the packaged build and writes a signed latest.json. Uploads nothing.
set -euo pipefail
cd "$(dirname "$0")"

version="$(node -p 'require("./package.json").version')"
bundle="../output/desktop/updates/$version/Hamster.app"
release="../output/desktop/releases/$version"
if [[ "$#" -gt 1 ]]; then
  printf 'Usage: %s ["release notes"]\n' "$0" >&2
  exit 1
fi
if [[ ! -d "$bundle" ]]; then
  printf 'Run package-mac.sh first: %s is missing.\n' "$bundle" >&2
  exit 1
fi
if [[ -e "$release" ]]; then
  printf 'Hamster %s already has a release folder.\n' "$version" >&2
  exit 1
fi
# Abort on any mismatch before anything is zipped or signed.
node release-mac.cjs --verify "$bundle"
mkdir -p "$release"
if ! { ditto -c -k --keepParent "$bundle" "$release/Hamster-$version.zip" && node release-mac.cjs "$release" "${1:-}"; }; then
  rm -rf "$release"
  exit 1
fi
printf '%s\n' "$release"
