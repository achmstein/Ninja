#!/usr/bin/env bash
# The website plays its clips live (src/web-clips.tsx, in src/site_web), so nothing is
# rendered to video. This makes the still each clip shows before its scene has loaded:
# one frame of it, in English and Arabic, into out/web; `npm run stills` in src/site_web
# then turns them into the WebP files the page serves.
#   bash scripts/render-web.sh            every clip
#   bash scripts/render-web.sh Pay Till   only these
set -e
cd "$(dirname "$0")/.."
mkdir -p out/web
CLIPS=("$@")
[ ${#CLIPS[@]} -eq 0 ] && CLIPS=(Journey Brand Pay Book Loyalty Till Kitchen Delivery Branches Menu Stock Profit Ask)
for clip in "${CLIPS[@]}"; do
  name=$(echo "$clip" | tr '[:upper:]' '[:lower:]')
  # The whole stage at 960 wide; the cut ones at 696 by 648
  scale=0.6; [ "$clip" = "Journey" ] && scale=0.5
  for lang in en ar; do
    id="Web$clip"; [ "$lang" = "ar" ] && id="Web${clip}Ar"
    npx remotion still "$id" "out/web/$name-$lang.png" --frame=90 --scale=$scale --log=error
    echo "still $name-$lang"
  done
done
