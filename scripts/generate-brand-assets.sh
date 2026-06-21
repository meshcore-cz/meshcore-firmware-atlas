#!/usr/bin/env bash
# Regenerate site logo, favicons, and og.png from ninja-logo.png (project root).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/ninja-logo.png"
out="$root/static"
bg='#000000'

if [[ ! -f "$src" ]]; then
  echo "Missing $src" >&2
  exit 1
fi

command -v magick >/dev/null || { echo 'ImageMagick (magick) required' >&2; exit 1; }

cp "$src" "$out/logo.png"

for spec in "16:12" "32:26" "180:150" "192:160" "512:430"; do
  size="${spec%%:*}"
  inner="${spec##*:}"
  magick -size "${size}x${size}" xc:"$bg" \
    \( "$src" -resize "${inner}x${inner}" \) -gravity center -composite \
    "$out/favicon-${size}x${size}.png"
done

magick "$out/favicon-16x16.png" "$out/favicon-32x32.png" "$out/favicon.ico"
cp "$out/favicon-180x180.png" "$out/apple-touch-icon.png"

magick -size 1200x630 xc:"$bg" \
  \( "$src" -resize 420x420 \) -gravity center -composite \
  "$out/og.png"

echo "✓ Wrote logo, favicons, apple-touch-icon, and og.png under static/"
