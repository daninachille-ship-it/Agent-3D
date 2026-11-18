#!/usr/bin/env bash
# Assemblage des 6 scènes (concat demuxer, -c copy), ajout du son, contrôles ffprobe et planche contact.
set -euo pipefail
cd "$(dirname "$0")"
OUT=out
FINAL="$OUT/Cracovie_7_jours_motion.mp4"

for s in A B C D E F; do [ -f "$OUT/scenes/$s.mp4" ] || { echo "scène manquante : $s"; exit 1; }; done
[ -f "$OUT/ambiance.wav" ] || ./audio.sh

printf "file 'scenes/%s.mp4'\n" A B C D E F > "$OUT/concat.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$OUT/concat.txt" -c copy "$OUT/video_muette.mp4"
ffmpeg -y -loglevel error -i "$OUT/video_muette.mp4" -i "$OUT/ambiance.wav" \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$FINAL.tmp.mp4"
mv "$FINAL.tmp.mp4" "$FINAL"
rm -f "$OUT/video_muette.mp4"

echo "== ffprobe"
ffprobe -v error -select_streams v:0 -count_frames \
  -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,nb_read_frames -of default=nw=1 "$FINAL"
ffprobe -v error -select_streams a -show_entries stream=codec_name,sample_rate,channels -of default=nw=1 "$FINAL"
ffprobe -v error -show_entries format=duration -of default=nw=1 "$FINAL"
echo "pistes audio : $(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$FINAL" | wc -l)"

echo "== planche contact (t = 3, 9, 20, 28, 33, 44)"
mkdir -p "$OUT/checks"
i=0; ins=()
for t in 3 9 20 28 33 44; do
  ffmpeg -y -loglevel error -ss "$t" -i "$FINAL" -frames:v 1 -q:v 2 "$OUT/checks/cs_$i.jpg"; ins+=(-i "$OUT/checks/cs_$i.jpg"); i=$((i+1))
done
ffmpeg -y -loglevel error "${ins[@]}" -filter_complex \
  "[0]scale=960:540[a];[1]scale=960:540[b];[2]scale=960:540[c];[3]scale=960:540[d];[4]scale=960:540[e];[5]scale=960:540[f];[a][b][c][d][e][f]xstack=inputs=6:layout=0_0|w0_0|0_h0|w0_h0|0_h0+h1|w0_h0+h1" \
  -q:v 3 "$OUT/planche_contact.jpg"
rm -f "$OUT"/checks/cs_*.jpg
echo "-> $OUT/planche_contact.jpg"
