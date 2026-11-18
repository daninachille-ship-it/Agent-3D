# Cracovie en 7 jours — motion design (45 s)

Vidéo 1920×1080, 30 i/s, H.264 yuv420p + AAC 48 kHz : `out/Cracovie_7_jours_motion.mp4`.
Tout est dessiné en code (SVG, CSS, Canvas) ; aucune image externe.

| Fichier | Rôle |
| --- | --- |
| `index.html` | Scène 1920×1080, styles, calques des 6 scènes |
| `anim.js` | Illustrations SVG générées (graine fixe) + `render(t)` déterministe |
| `render.mjs` | Capture Playwright image par image + encodage ffmpeg par scène |
| `audio.sh` | Nappe ambiante `aevalsrc` (accord, clochettes, « ding ») |
| `finish.sh` | Concat `-c copy`, ajout du son, contrôles ffprobe, planche contact |
| `fonts/` | Lora 700 (latin + latin-ext, licence OFL) ; Inter est la police système |

```bash
node render.mjs stills 4.5,6.4,10.5   # images clés -> out/checks/
node render.mjs scenes                # 6 scènes -> out/scenes/X.mp4
node render.mjs scenes C              # ré-encoder une seule scène
./audio.sh                            # out/ambiance.wav (≈ -20 dB moy., -6 dB crête)
./finish.sh                           # assemblage final + contrôles
```
