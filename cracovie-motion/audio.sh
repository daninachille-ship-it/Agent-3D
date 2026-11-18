#!/usr/bin/env bash
# Nappe ambiante 45 s, 48 kHz : accord respirant + clochettes aux frontières de scène + « ding » aux changements de jour.
# Usage : ./audio.sh [gain_dB]   (le gain est ajusté pour viser ~ -20 dB moyen / -6 dB crête)
set -euo pipefail
cd "$(dirname "$0")"
GAIN="${1:--5.5}"
mkdir -p out

CHORD="0.16*sin(2*PI*110*t)+0.16*sin(2*PI*110.4*t)+0.11*sin(2*PI*164.81*t)+0.08*sin(2*PI*220*t)+0.055*sin(2*PI*261.63*t)+0.04*sin(2*PI*329.63*t)"
BREATH="(0.75+0.25*sin(2*PI*0.08*t))"
BELLS=""
for b in 6.4 12.4 29.2 34.5 39.5; do
  BELLS+="+gte(t,$b)*exp(-2.5*(t-$b))*(0.33*sin(2*PI*880*(t-$b))+0.19*sin(2*PI*1318.5*(t-$b)))"
done
DINGS=""
for b in 14.8 17.2 19.6 22.0 24.4 26.8; do
  DINGS+="+gte(t,$b)*exp(-4*(t-$b))*0.12*sin(2*PI*659.25*(t-$b))"
done
EXPR="${CHORD}*${BREATH}${BELLS}${DINGS}"

ffmpeg -y -loglevel error -f lavfi -i "aevalsrc=exprs='${EXPR}':s=48000:d=45" \
  -af "lowpass=f=2500,afade=t=in:st=0:d=2.5,afade=t=out:st=42:d=3,volume=${GAIN}dB,pan=stereo|c0=c0|c1=c0" \
  -c:a pcm_s16le out/ambiance.wav
ffmpeg -hide_banner -nostats -i out/ambiance.wav -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume"
