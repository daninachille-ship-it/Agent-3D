# KRAKOW – 7 DAYS. 2 TRAVELERS. 1 EPIC CITY.

A 75-second promotional film made entirely with code: a procedural 3D isometric miniature of Kraków
(Three.js), rendered frame by frame with headless Chromium, plus an original electro-cinematic score
synthesised in Python and synced to the same timeline.

## Structure of the film

| Time | Sequence | What happens |
|---|---|---|
| 0–8 s | **The visual shock** | Earth from space, Europe, Poland lights up, dive onto Kraków (southern Poland). Flash, the streets draw themselves like a living map on a navy void, the city erupts from the ground, monuments appear as glowing blueprints. Title **KRAKOW / 7 DAYS – 2 TRAVELERS**. |
| 8–20 s | **Old Town** (Days 1–2) | Swoop into Rynek Główny (pigeons take off). St. Mary's Basilica materialises (vertigo zoom up the tower), Cloth Hall, Town Hall Tower, St. Adalbert's, slalom between the monuments, then a climb along Grodzka to **Wawel**, which rises on its hill above the Vistula. |
| 20–30 s | **The living city** (Day 3) | Swirl-morph transition to Kazimierz. Sunset turns to blue hour: street lamps ignite in a wave, string lights over Szeroka, trams, café terraces, murals, Plac Nowy and its round market hall. Then the Vistula boulevards and a floodlit Wawel. |
| 30–43 s | **Experiences** (Day 4) | Six floating diorama tableaux with whip-pan transitions: pierogi, cafés with an obwarzanek cart, amber stalls in the Sukiennice, museum treasures, a vaulted cellar bar, an urban walk. |
| 43–55 s | **Excursions** (Days 5–6) | A light line on a 3D map of Lesser Poland leads to **Wieliczka** (descent through the strata into St. Kinga's Chapel, carved in salt 101 m underground; the chandeliers light up). Then a sober white line to **Auschwitz-Birkenau**: desaturated, silent, a slow dolly towards the gate, candles. No effects, no beat. |
| 55–65 s | **March** (Day 7) | A 360° orbit around the square as the city goes from snow (roofs, falling flakes, −2 °C) to spring: the thaw, trees budding, terraces opening (12 °C). |
| 65–75 s | **Finale** | Time-lapse to night. Every monument lights up at once with volumetric beams, fireworks over Wawel, the camera climbs and circles. **KRAKOW – POLAND / 7 DAYS. 2 TRAVELERS. COUNTLESS EXPERIENCES. / LET'S EXPLORE!** |

Geography follows the real city (1 unit = 10 m): Rynek with the Cloth Hall in the middle, St. Mary's at the
north-east corner with its two unequal towers, the Town Hall Tower to the south-west, Floriańska → Florian Gate
→ Barbican to the north, the Planty ring, Grodzka down to Wawel on the Vistula bend, Kazimierz to the
south-east, and the real map positions of Wieliczka and Oświęcim.

## Files

```
index.html            player (real-time playback with the soundtrack) and render entry point (?render)
src/timeline.js       single source of truth for timing: segments, impacts, whooshes, sections
src/main.js           director: shots, camera paths, lighting presets, transitions, post-processing, typography
src/earth.js          Earth from space (country data: Natural Earth via world-atlas)
src/city.js           the miniature Kraków: houses, monuments, Wawel, Kazimierz, river, trams, people, lamps, snow, fireworks
src/dioramas.js       experience tableaux, excursion map, Wieliczka salt mine, Auschwitz-Birkenau memorial
src/util.js           easing, keyframes, shader patches (snow, living-map reveal), build-up animation
tools/music.py        the soundtrack synthesiser (numpy only)
tools/render.mjs      deterministic frame renderer (Playwright + ffmpeg)
tools/render-all.sh   parallel full render + audio mux
```

## Rendering

Requirements: Node 20+, Playwright with Chromium, ffmpeg, Python 3 with numpy.

```bash
# full film: width height fps workers
tools/render-all.sh 1920 1080 60 4       # -> out/cracovie-7jours-1080p60.mp4
tools/render-all.sh 3840 2160 60 4       # 4K (about 4× longer)

# preview stills
node tools/render.mjs --stills 6.5,10.3,23.4,48.5,69.8 --out out/stills
```

Real-time preview: serve the folder (`npx http-server krakow-film`) and open `index.html` in a browser with a GPU.
Each frame is a pure function of time, so renders are reproducible and can be split across machines.

## Styles

`index.html?style=...` (and the render scripts, via the page default):

- `mix` (default): architect blueprint 3D + real photos (portrait cards that draw themselves in lines, then fill in).
  Photos are extracted from a personal reference video with `tools/frames_from_video.py` into `data/photos/`
  (not committed: personal reference material only).
- `blueprint`: everything as an architect's line drawing, monuments traced in gold.
- `3d`: the original coloured isometric miniature.
