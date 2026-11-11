#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

electron="$(node -p 'require("electron")')"
electron_app="${electron%/Contents/MacOS/Electron}"
version="$(node -p 'require("./package.json").version')"
output="../output/desktop"
destination="$output/Hamster.app"
releases="$output/updates"
release="$releases/$version"
bootstrap="${1:-}"
if [[ "$#" -gt 1 || ( -n "$bootstrap" && "$bootstrap" != --bootstrap ) ]]; then
  printf 'Usage: %s [--bootstrap]\n' "$0" >&2
  exit 1
fi
mkdir -p "$releases"
if [[ -e "$release" ]]; then
  printf 'Hamster %s has already been built. Increment the patch version before publishing another build.\n' "$version" >&2
  exit 1
fi
stage="$(mktemp -d "$output/.hamster-build.XXXXXX")"
trap 'rm -rf "$stage"' EXIT

bundle="$stage/Hamster.app"
ditto "$electron_app" "$bundle"
contents="$bundle/Contents"
resources="$contents/Resources"
app="$resources/app"
mkdir -p "$app"
cp package.json main.cjs motion-state.cjs progress.cjs localization.cjs placement.cjs codex-install.cjs codex-usage.cjs tool-usage.cjs codex-lifecycle.cjs menu-template.cjs connection-status.cjs updater.cjs distribution.cjs update-manifest.cjs remote-update.cjs diagnostics.cjs preload.cjs overlay.{html,css,js} interaction.{html,js} wardrobe.cjs wardrobe.css wardrobe-ui.js "$app"
ditto assets "$app/assets"
rm -f "$resources/default_app.asar"

architecture="$(lipo -archs "$electron")"
xcrun swiftc -O -module-cache-path "$stage/swift-cache" -target "${architecture}-apple-macosx13.0" \
  codex-hook.swift -o "$app/codex-hook-v2"
codesign --force --sign - "$app/codex-hook-v2"
xcrun swiftc -O -module-cache-path "$stage/swift-cache" -target "${architecture}-apple-macosx13.0" \
  update-mac.swift -o "$app/update-mac"
codesign --force --sign - "$app/update-mac"

plist="$contents/Info.plist"
plutil -remove ElectronAsarIntegrity "$plist"
plutil -remove NSAppTransportSecurity "$plist"
plutil -replace CFBundleIdentifier -string 'local.codex.hamster' "$plist"
plutil -replace CFBundleName -string 'Hamster' "$plist"
plutil -replace CFBundleDisplayName -string 'Hamster' "$plist"
plutil -replace CFBundleShortVersionString -string "$version" "$plist"
plutil -replace CFBundleVersion -string "$version" "$plist"
plutil -replace CFBundleIconFile -string 'Hamster.icns' "$plist"
plutil -insert LSUIElement -bool YES "$plist"

source_icon="build/icon-source.png"
iconset="$stage/Hamster.iconset"
mkdir "$iconset"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$source_icon" --out "$iconset/icon_${size}x${size}.png" >/dev/null
  sips -z "$((size*2))" "$((size*2))" "$source_icon" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$iconset" -o "$resources/Hamster.icns"

for code in "$contents/Frameworks/"*.framework "$contents/Frameworks/"*.app; do
  codesign --force --sign - "$code"
done
codesign --force --sign - "$bundle"
codesign --verify --deep --strict "$bundle"

mkdir "$stage/$version"
mv "$bundle" "$stage/$version/Hamster.app"
mv -n "$stage/$version" "$releases/"
if [[ -e "$stage/$version" ]]; then exit 1; fi

if [[ "$bootstrap" == --bootstrap ]]; then
  ditto "$release/Hamster.app" "$bundle"
  if [[ -e "$destination" ]]; then
    mv "$destination" "$stage/previous.app"
  fi
  if ! mv "$bundle" "$destination"; then
    if [[ -e "$stage/previous.app" ]]; then mv "$stage/previous.app" "$destination"; fi
    exit 1
  fi
fi
printf '%s\n' "$release/Hamster.app"
