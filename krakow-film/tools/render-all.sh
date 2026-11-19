#!/usr/bin/env bash
# Full render: N parallel workers over time ranges, then concat + mux soundtrack.
# Usage: tools/render-all.sh [W] [H] [FPS] [WORKERS]
set -euo pipefail
cd "$(dirname "$0")/.."
W=${1:-1920}; H=${2:-1080}; FPS=${3:-60}; N=${4:-4}; DUR=75
mkdir -p out
node -e "import('./src/timeline.js').then(m=>console.log(JSON.stringify(m)))" > out/timeline.json
python3 tools/music.py out/timeline.json out/soundtrack.wav
ffmpeg -y -loglevel error -i out/soundtrack.wav -c:a aac -b:a 256k data/soundtrack.m4a
pids=(); : > out/list.txt
for i in $(seq 0 $((N-1))); do
  FROM=$(python3 -c "print(round($DUR*$i/$N*$FPS)/$FPS)"); TO=$(python3 -c "print(round($DUR*($i+1)/$N*$FPS)/$FPS)")
  node tools/render.mjs --w $W --h $H --fps $FPS --from $FROM --to $TO --out out/part$i.mp4 > out/part$i.log 2>&1 &
  pids+=($!); echo "file 'part$i.mp4'" >> out/list.txt
done
for p in "${pids[@]}"; do wait $p; done
ffmpeg -y -loglevel error -f concat -safe 0 -i out/list.txt -i out/soundtrack.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart out/cracovie-7jours-${H}p${FPS}.mp4
echo "DONE out/cracovie-7jours-${H}p${FPS}.mp4"
