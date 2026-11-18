/* Cracovie en 7 jours — motion design piloté par render(t), entièrement déterministe. */
'use strict';
(function () {
  // ------------------------------------------------------------------ outils
  const W = 1920, H = 1080;
  const C = {
    ink: '#1E2433', night2: '#2B3245', hill: '#262D40', slate: '#3A4256', river: '#34405A',
    paper: '#F6F1E9', paper2: '#ECE4D6', brick: '#A63D2A', brick2: '#7E2D1F', brick3: '#8E3424',
    gold: '#D9A441', soft: '#C9CED8', softL: '#4A5260', stone: '#C9B79A', pale: '#F6E3B0'
  };
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const p = (t, a, b) => clamp((t - a) / (b - a));
  const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
  const easeInOutCubic = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOutBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const lerp = (a, b, x) => a + (b - a) * x;
  const f1 = v => Math.round(v * 10) / 10;
  function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; }
  const $ = id => document.getElementById(id);
  const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mixHex = (a, b, x) => { const A = hex2rgb(a), B = hex2rgb(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], x))).join(',')})`; };

  // Frontières de scènes et calendrier des jours
  const BOUND = [6.4, 12.4, 29.2, 34.5, 39.5];
  const SCENE_START = [0, 6.4, 12.4, 29.2, 34.5, 39.5];
  const DAY0 = 12.4, DAYLEN = 2.4, PUSH = 0.25, PUSH_DIST = 2400;
  const dayStart = k => DAY0 + DAYLEN * k;

  // Animation SMIL réutilisable
  const pulse = (lo, hi, dur, begin) => `<animate attributeName="opacity" values="${lo};${hi};${lo}" dur="${f1(dur)}s" begin="${f1(begin)}s" repeatCount="indefinite"/>`;
  const slide = (x0, y, period, dur) => `<animateTransform attributeName="transform" type="translate" from="${x0},${y}" to="${x0 - period},${y}" dur="${dur}s" repeatCount="indefinite"/>`;
  function wavePath(len, period, amp) {
    let d = `M0,0`; const n = Math.ceil(len / period) + 2;
    for (let i = 0; i < n; i++) d += ` q${period / 4},${-amp} ${period / 2},0 q${period / 4},${amp} ${period / 2},0`;
    return d;
  }
  function starDots(R, n, w, h, op = 0.7) {
    let s = '';
    for (let i = 0; i < n; i++) s += `<circle cx="${f1(R() * w)}" cy="${f1(R() * h)}" r="${f1(0.6 + R() * 1.1)}" fill="${C.soft}" opacity="${f1(0.3 + R() * op)}"/>`;
    return s;
  }

  // ------------------------------------------------------------------ panorama (1920×360)
  function panorama() {
    const R = rng(424242);
    const o = [`<svg viewBox="0 0 1920 360" width="1920" height="360" xmlns="http://www.w3.org/2000/svg">`];
    // collines lointaines
    o.push(`<path fill="${C.hill}" d="M0,175 C150,140 290,160 430,150 C600,138 720,112 900,126 C1080,140 1200,104 1380,112 C1560,120 1700,142 1920,118 L1920,360 L0,360Z"/>`);
    // rangée arrière (silhouettes)
    let x = 560;
    while (x < 1920) {
      const w = 40 + R() * 50, h = 112 + R() * 66, t = 300 - h, rh = 14 + R() * 16;
      o.push(`<path fill="${C.night2}" d="M${f1(x)},300V${f1(t)}L${f1(x + w / 2)},${f1(t - rh)}L${f1(x + w)},${f1(t)}V300Z"/>`);
      if (R() < 0.4) o.push(`<rect x="${f1(x + w / 2 - 4)}" y="${f1(t + 16)}" width="8" height="11" fill="${C.gold}" opacity=".35"/>`);
      x += w;
    }
    // colline du Wawel + château
    o.push(`<path fill="${C.night2}" d="M0,300 L0,206 C60,192 120,176 210,174 C300,172 380,178 450,196 C510,212 550,250 600,300Z"/>`);
    o.push(`<rect x="104" y="128" width="332" height="58" fill="${C.brick2}"/>`);
    for (let mx = 104; mx < 436; mx += 16) o.push(`<rect x="${mx}" y="118" width="9" height="11" fill="${C.brick2}"/>`);
    // tour gauche
    o.push(`<rect x="138" y="66" width="38" height="64" fill="${C.brick}"/><path d="M131,68 L157,16 L183,68Z" fill="${C.brick2}"/><circle cx="157" cy="14" r="3" fill="${C.gold}"/>`);
    // tour droite
    o.push(`<rect x="382" y="82" width="32" height="48" fill="${C.brick}"/><path d="M376,84 L398,38 L420,84Z" fill="${C.brick2}"/><circle cx="398" cy="36" r="3" fill="${C.gold}"/>`);
    // coupole dorée (chapelle)
    o.push(`<rect x="250" y="104" width="44" height="26" fill="${C.brick}"/><path d="M248,106 A24,24 0 0 1 296,106Z" fill="${C.gold}"/><rect x="269" y="72" width="6" height="12" fill="${C.gold}"/><circle cx="272" cy="70" r="3.5" fill="${C.gold}"/>`);
    // second clocher de la cathédrale
    o.push(`<rect x="318" y="96" width="26" height="34" fill="${C.brick3}"/><path d="M314,98 Q331,62 348,98Z" fill="${C.brick2}"/>`);
    // fenêtres du château
    for (let wx = 116; wx < 430; wx += 22) {
      if ((wx / 22 | 0) % 4 !== 1) o.push(`<rect x="${wx}" y="144" width="7" height="10" rx="1.5" fill="${C.gold}" opacity=".9"/>`);
      if ((wx / 22 | 0) % 3 !== 0) o.push(`<rect x="${wx}" y="164" width="7" height="10" rx="1.5" fill="${C.gold}" opacity=".75"/>`);
    }
    o.push(`<rect x="152" y="86" width="9" height="13" rx="2" fill="${C.gold}"/><rect x="393" y="100" width="7" height="11" rx="2" fill="${C.gold}"/>`);
    // maisons à pignon
    x = 560;
    const cols = [C.brick, C.brick2, C.brick3];
    while (x < 1920) {
      const w = 46 + R() * 40, h = 62 + R() * 72, t = 300 - h, rh = 16 + R() * 20, col = cols[Math.floor(R() * 3)];
      if (R() < 0.3) {
        const s = rh / 3;
        o.push(`<path fill="${col}" d="M${f1(x)},300V${f1(t)}H${f1(x + .12 * w)}V${f1(t - s)}H${f1(x + .25 * w)}V${f1(t - 2 * s)}H${f1(x + .38 * w)}V${f1(t - 3 * s)}H${f1(x + .62 * w)}V${f1(t - 2 * s)}H${f1(x + .75 * w)}V${f1(t - s)}H${f1(x + .88 * w)}V${f1(t)}H${f1(x + w)}V300Z"/>`);
      } else {
        o.push(`<path fill="${col}" d="M${f1(x)},300V${f1(t)}L${f1(x + w / 2)},${f1(t - rh)}L${f1(x + w)},${f1(t)}V300Z"/>`);
      }
      if (R() < 0.7) {
        const ww = Math.max(10, w * 0.24), wh = ww * 1.4;
        o.push(`<rect x="${f1(x + w / 2 - ww / 2)}" y="${f1(t + 14)}" width="${f1(ww)}" height="${f1(wh)}" rx="2" fill="${C.gold}">${pulse(0.45, 1, 4 + R() * 3, -R() * 6)}</rect>`);
      }
      if (h > 100 && R() < 0.6) o.push(`<rect x="${f1(x + w / 2 - 5)}" y="${f1(t + 14 + w * 0.4 + 16)}" width="10" height="13" rx="2" fill="${C.gold}" opacity=".5"/>`);
      x += w;
    }
    // Halle aux draps (Sukiennice)
    const hx0 = 880, hx1 = 1240;
    o.push(`<rect x="${hx0}" y="222" width="${hx1 - hx0}" height="78" fill="${C.stone}"/>`);
    o.push(`<rect x="${hx0 - 4}" y="210" width="${hx1 - hx0 + 8}" height="14" fill="#B9A685"/>`);
    for (let mx = hx0 - 4; mx < hx1; mx += 18) o.push(`<rect x="${mx}" y="198" width="10" height="13" fill="${C.stone}"/>`);
    o.push(`<path d="M1036,211 L1060,170 L1084,211Z" fill="${C.stone}"/><circle cx="1060" cy="196" r="7" fill="${C.gold}" opacity=".85"/>`);
    o.push(`<rect x="${hx0 - 10}" y="188" width="16" height="112" fill="${C.stone}"/><rect x="${hx1 - 6}" y="188" width="16" height="112" fill="${C.stone}"/>`);
    o.push(`<path d="M${hx0 - 10},188 L${hx0 - 2},172 L${hx0 + 6},188Z M${hx1 - 6},188 L${hx1 + 2},172 L${hx1 + 10},188Z" fill="#B9A685"/>`);
    const na = 13, sp = (hx1 - hx0 - 24) / na, aw = sp - 7;
    for (let i = 0; i < na; i++) {
      const ax = hx0 + 12 + i * sp + 3.5;
      o.push(`<path d="M${f1(ax)},300V${f1(266 + aw / 2)}A${f1(aw / 2)},${f1(aw / 2)} 0 0 1 ${f1(ax + aw)},${f1(266 + aw / 2)}V300Z" fill="${C.gold}" opacity=".92"/>`);
      if (i % 2 === 0) o.push(`<rect x="${f1(ax + aw / 2 - 3)}" y="232" width="6" height="14" rx="2" fill="${C.gold}" opacity=".6"/>`);
    }
    // Basilique Notre-Dame
    o.push(`<rect x="1360" y="176" width="134" height="124" fill="${C.brick3}"/><path d="M1356,178 L1427,140 L1498,178Z" fill="${C.brick2}"/>`);
    o.push(`<rect x="1384" y="140" width="38" height="160" fill="${C.brick}"/><path d="M1380,142 Q1403,96 1426,142Z" fill="${C.brick2}"/><circle cx="1403" cy="98" r="3.5" fill="${C.gold}"/>`);
    o.push(`<rect x="1314" y="86" width="48" height="214" fill="${C.brick}"/>`);
    o.push(`<path d="M1309,88 L1338,6 L1367,88Z" fill="${C.brick2}"/>`);
    o.push(`<path d="M1304,88 L1310,58 L1316,88Z M1360,88 L1366,58 L1372,88Z" fill="${C.brick2}"/>`);
    o.push(`<rect x="1325" y="62" width="26" height="5" fill="${C.gold}"/><circle cx="1338" cy="5" r="4.5" fill="${C.gold}"/>`);
    o.push(`<path d="M1332,124 V114 A6,6 0 0 1 1344,114 V124Z" fill="${C.gold}"/>`);
    for (const wy of [160, 214]) o.push(`<path d="M1333,${wy + 24} V${wy + 5} A5,5 0 0 1 1343,${wy + 5} V${wy + 24}Z" fill="${C.gold}" opacity=".85"/>`);
    for (const wy of [176, 228]) o.push(`<path d="M1398,${wy + 22} V${wy + 5} A5,5 0 0 1 1408,${wy + 5} V${wy + 22}Z" fill="${C.gold}" opacity=".8"/>`);
    for (let wx = 1440; wx < 1490; wx += 22) o.push(`<path d="M${wx},262 V${226} A5,5 0 0 1 ${wx + 10},226 V262Z" fill="${C.gold}" opacity=".7"/>`);
    // rivière
    o.push(`<rect x="0" y="296" width="1920" height="8" fill="${C.night2}"/><rect x="0" y="303" width="1920" height="57" fill="${C.river}"/>`);
    for (let i = 0; i < 16; i++) {
      const rx = 120 + R() * 1700, rw = 16 + R() * 26;
      o.push(`<rect x="${f1(rx)}" y="${f1(310 + R() * 12)}" width="${f1(rw)}" height="3" rx="1.5" fill="${C.gold}" opacity=".5">${pulse(0.15, 0.6, 3 + R() * 3, -R() * 5)}</rect>`);
    }
    o.push(`<g>${slide(0, 322, 60, 4)}<path d="${wavePath(1920 + 120, 60, 4)}" fill="none" stroke="#4E5C7C" stroke-width="2.5" stroke-linecap="round"/></g>`);
    o.push(`<g>${slide(-30, 344, 80, 6)}<path d="${wavePath(1920 + 160, 80, 5)}" fill="none" stroke="#46536F" stroke-width="2.5" stroke-linecap="round"/></g>`);
    o.push(`</svg>`);
    return o.join('');
  }

  // ------------------------------------------------------------------ vignettes (280×410)
  const svgV = body => `<svg viewBox="0 0 280 410" width="448" height="656" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  const arc = (cx, cy, r, a0, a1) => {
    const rad = a => a * Math.PI / 180;
    return `M${f1(cx + r * Math.cos(rad(a0)))},${f1(cy + r * Math.sin(rad(a0)))} A${r},${r} 0 0 1 ${f1(cx + r * Math.cos(rad(a1)))},${f1(cy + r * Math.sin(rad(a1)))}`;
  };
  const haloGrad = id => `<radialGradient id="${id}"><stop offset=".35" stop-color="${C.gold}" stop-opacity=".32"/><stop offset=".6" stop-color="${C.gold}" stop-opacity=".1"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></radialGradient>`;
  const archWin = (x, y, w, h, op = 1) => `<path d="M${x},${y + h} V${y + w / 2} A${w / 2},${w / 2} 0 0 1 ${x + w},${y + w / 2} V${y + h}Z" fill="${C.gold}" opacity="${op}"/>`;

  function v1() { // Notre-Dame + trompettiste
    const R = rng(101);
    let s = `<defs>${haloGrad('v1m')}</defs><rect width="280" height="410" fill="${C.ink}"/>${starDots(R, 22, 280, 230)}`;
    s += `<circle cx="210" cy="78" r="64" fill="url(#v1m)"/><circle cx="210" cy="78" r="27" fill="${C.gold}"/>`;
    s += `<rect x="118" y="236" width="42" height="174" fill="${C.brick2}"/><path d="M116,238 L138,212 L160,238Z" fill="${C.brick2}"/>`;
    s += `<rect x="158" y="196" width="40" height="214" fill="${C.brick3}"/><path d="M154,198 Q178,148 202,198Z" fill="${C.brick2}"/><circle cx="178" cy="150" r="3.5" fill="${C.gold}"/>`;
    s += `<rect x="70" y="128" width="50" height="282" fill="${C.brick}"/>`;
    s += `<path d="M66,130 L95,34 L124,130Z" fill="${C.brick2}"/><path d="M61,130 L67,96 L73,130Z M117,130 L123,96 L129,130Z" fill="${C.brick2}"/>`;
    s += `<rect x="82" y="102" width="26" height="5" fill="${C.gold}"/><circle cx="95" cy="30" r="4.5" fill="${C.gold}"/>`;
    s += archWin(89, 152, 12, 20);
    [9, 19, 29].forEach((r, i) => {
      s += `<path d="${arc(118, 162, r, -50, 50)}" fill="none" stroke="${C.gold}" stroke-width="3" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.3;.7;1" dur="2s" begin="${i * 0.3}s" repeatCount="indefinite"/></path>`;
    });
    s += archWin(88, 210, 14, 34, .85) + archWin(88, 290, 14, 34, .7) + archWin(171, 236, 14, 30, .85) + archWin(171, 306, 14, 30, .7);
    s += `<path d="M0,410 V352 L24,334 L48,352 V346 L72,326 L96,346 V410Z" fill="${C.night2}"/><path d="M200,410 V350 L224,330 L248,350 V340 L266,326 L284,340 V410Z" fill="${C.night2}"/>`;
    s += `<rect x="20" y="362" width="8" height="11" fill="${C.gold}" opacity=".8"/><rect x="66" y="356" width="8" height="11" fill="${C.gold}" opacity=".6"/><rect x="226" y="360" width="8" height="11" fill="${C.gold}" opacity=".8"/>`;
    return svgV(s);
  }
  function v2() { // Wawel
    const R = rng(202);
    let s = `<rect width="280" height="410" fill="${C.ink}"/>${starDots(R, 20, 280, 200)}`;
    s += `<circle cx="72" cy="78" r="25" fill="${C.gold}"/><circle cx="85" cy="70" r="23" fill="${C.ink}"/>`;
    s += `<path d="M0,292 C40,256 82,236 140,232 C200,228 250,246 280,266 V410 H0Z" fill="${C.night2}"/>`;
    s += `<rect x="48" y="184" width="186" height="60" fill="${C.brick2}"/>`;
    for (let mx = 48; mx < 234; mx += 12) s += `<rect x="${mx}" y="176" width="7" height="9" fill="${C.brick2}"/>`;
    s += `<rect x="60" y="124" width="30" height="62" fill="${C.brick}"/><path d="M54,126 L75,78 L96,126Z" fill="${C.brick2}"/><circle cx="75" cy="76" r="3" fill="${C.gold}"/>`;
    s += `<rect x="196" y="138" width="26" height="48" fill="${C.brick}"/><path d="M190,140 L209,98 L228,140Z" fill="${C.brick2}"/>`;
    s += `<rect x="130" y="156" width="30" height="30" fill="${C.brick}"/><path d="M128,158 A17,17 0 0 1 162,158Z" fill="${C.gold}"/><rect x="143" y="132" width="4" height="12" fill="${C.gold}"/><circle cx="145" cy="130" r="2.6" fill="${C.gold}"/>`;
    for (let wx = 58; wx < 226; wx += 15) {
      if ((wx / 15 | 0) % 4 !== 2) s += `<rect x="${wx}" y="198" width="6" height="9" rx="1.5" fill="${C.gold}" opacity=".9"/>`;
      if ((wx / 15 | 0) % 3 !== 1) s += `<rect x="${wx}" y="218" width="6" height="9" rx="1.5" fill="${C.gold}" opacity=".7"/>`;
    }
    s += `<rect x="70" y="142" width="8" height="12" rx="2" fill="${C.gold}"/>`;
    s += `<rect x="0" y="330" width="280" height="80" fill="${C.river}"/>`;
    for (let i = 0; i < 7; i++) s += `<rect x="${f1(20 + R() * 230)}" y="${f1(340 + R() * 50)}" width="${f1(10 + R() * 18)}" height="2.5" rx="1" fill="${C.gold}" opacity=".45">${pulse(0.15, 0.6, 2.5 + R() * 2, -R() * 3)}</rect>`;
    s += `<g>${slide(0, 350, 40, 3.5)}<path d="${wavePath(360, 40, 3)}" fill="none" stroke="#4E5C7C" stroke-width="2.2" stroke-linecap="round"/></g>`;
    s += `<g>${slide(-20, 374, 50, 5)}<path d="${wavePath(380, 50, 3.5)}" fill="none" stroke="#46536F" stroke-width="2.2" stroke-linecap="round"/></g>`;
    s += `<g>${slide(-10, 396, 40, 4.2)}<path d="${wavePath(360, 40, 3)}" fill="none" stroke="#4E5C7C" stroke-width="2.2" stroke-linecap="round"/></g>`;
    return svgV(s);
  }
  function v3() { // Kazimierz
    const R = rng(303);
    let s = `<defs><radialGradient id="v3h"><stop offset="0" stop-color="${C.gold}" stop-opacity=".85"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></radialGradient></defs>`;
    s += `<rect width="280" height="410" fill="${C.ink}"/>${starDots(R, 18, 280, 170)}`;
    // pont en arc à l'arrière-plan
    s += `<rect x="0" y="236" width="280" height="9" fill="${C.slate}"/><path d="M8,240 Q140,120 272,240" fill="none" stroke="${C.slate}" stroke-width="8"/>`;
    for (let hx = 40; hx < 250; hx += 26) { const yy = 240 - (1 - Math.pow((hx - 140) / 132, 2)) * 60; s += `<line x1="${hx}" y1="${f1(yy)}" x2="${hx}" y2="238" stroke="${C.slate}" stroke-width="2.5"/>`; }
    // maisons
    const cols = [C.brick, C.brick3, C.brick2, C.brick, C.brick3];
    const hs = [150, 128, 168, 136, 156];
    for (let i = 0; i < 5; i++) {
      const x = -4 + i * 58, w = 58, t = 360 - hs[i], rh = 24 + (i % 2) * 8;
      s += `<path d="M${x},360 V${t} L${x + w / 2},${t - rh} L${x + w},${t} V360Z" fill="${cols[i]}"/>`;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
        const wy = t + 16 + r * 34; if (wy > 322) continue;
        const lit = R() < 0.72;
        s += `<rect x="${x + 13 + c * 22}" y="${wy}" width="10" height="16" rx="2" fill="${lit ? C.gold : C.brick2}" opacity="${lit ? f1(0.6 + R() * 0.4) : 1}"/>`;
      }
      s += `<rect x="${x + w / 2 - 7}" y="336" width="14" height="24" rx="2" fill="${C.brick2}"/>`;
    }
    s += `<rect x="0" y="360" width="280" height="50" fill="${C.hill}"/>`;
    [44, 140, 236].forEach((lx, i) => {
      s += `<circle cx="${lx}" cy="296" r="30" fill="url(#v3h)">${pulse(0.4, 0.95, 3.2, -i * 1.1)}</circle>`;
      s += `<rect x="${lx - 2}" y="300" width="4" height="62" fill="${C.slate}"/><rect x="${lx - 9}" y="360" width="18" height="5" rx="2" fill="${C.slate}"/>`;
      s += `<path d="M${lx - 8},290 H${lx + 8} L${lx + 5},302 H${lx - 5}Z" fill="${C.gold}"/><rect x="${lx - 9}" y="286" width="18" height="4" rx="1.5" fill="${C.slate}"/>`;
    });
    return svgV(s);
  }
  function v4() { // Wieliczka
    let s = `<defs><radialGradient id="v4h"><stop offset="0" stop-color="${C.gold}" stop-opacity=".75"/><stop offset=".55" stop-color="${C.gold}" stop-opacity=".22"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></radialGradient></defs>`;
    s += `<rect width="280" height="410" fill="${C.hill}"/>`;
    s += `<path d="M0,410 V170 Q0,36 140,36 Q280,36 280,170 V410Z" fill="${C.slate}"/>`;
    s += `<path d="M28,410 V182 Q28,68 140,68 Q252,68 252,182 V410Z" fill="#4A5266"/>`;
    for (const nx of [50, 196]) s += `<path d="M${nx},330 V262 Q${nx},236 ${nx + 17},236 Q${nx + 34},236 ${nx + 34},262 V330Z" fill="${C.slate}"/>`;
    s += `<circle cx="140" cy="150" r="108" fill="url(#v4h)"><animate attributeName="r" values="96;120;96" dur="4.5s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;1;.7" dur="4.5s" repeatCount="indefinite"/></circle>`;
    s += `<rect x="0" y="348" width="280" height="62" fill="${C.night2}"/><rect x="104" y="316" width="72" height="34" rx="3" fill="#5A6274"/><rect x="128" y="290" width="24" height="26" rx="2" fill="#5A6274"/>`;
    s += `<path d="M0,348 H280" stroke="#5A6274" stroke-width="2"/>`;
    s += `<line x1="140" y1="36" x2="140" y2="92" stroke="${C.gold}" stroke-width="2"/><path d="M140,80 L88,96 M140,80 L192,96" stroke="${C.gold}" stroke-width="1.5"/>`;
    const rings = [[96, 52, 12, 6], [118, 36, 9, 4], [138, 20, 6, 2]];
    let k = 0;
    rings.forEach(([cy, rx, ry, n]) => {
      s += `<ellipse cx="140" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${C.gold}" stroke-width="3"/>`;
      for (let j = 0; j < n; j++) {
        const a = Math.PI * (0.15 + 0.7 * (n === 1 ? 0.5 : j / (n - 1)));
        const x = 140 - rx * Math.cos(a), y = cy + ry * Math.sin(a) + 7;
        s += `<path d="M${f1(x)},${f1(y - 5)} L${f1(x + 3.5)},${f1(y)} L${f1(x)},${f1(y + 8)} L${f1(x - 3.5)},${f1(y)}Z" fill="${C.pale}">${pulse(0.3, 1, 1.3 + (k % 5) * 0.27, -k * 0.23)}</path>`;
        k++;
      }
    });
    return svgV(s);
  }
  function v5() { // bougie — totalement immobile
    let s = `<defs><radialGradient id="v5g"><stop offset="0" stop-color="${C.gold}" stop-opacity=".38"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></radialGradient></defs>`;
    s += `<rect width="280" height="410" fill="${C.ink}"/>`;
    s += `<circle cx="140" cy="180" r="120" fill="url(#v5g)"/>`;
    s += `<rect x="0" y="352" width="280" height="58" fill="${C.night2}"/>`;
    s += `<rect x="96" y="214" width="88" height="140" rx="16" fill="${C.brick}"/>`;
    s += `<rect x="108" y="230" width="10" height="104" rx="5" fill="#BF5A43" opacity=".7"/>`;
    s += `<rect x="90" y="200" width="100" height="18" rx="6" fill="${C.brick2}"/>`;
    s += `<rect x="138.5" y="186" width="3" height="16" fill="#3A2A22"/>`;
    s += `<path d="M140,136 C154,158 158,174 140,192 C122,174 126,158 140,136Z" fill="${C.gold}"/>`;
    s += `<path d="M140,160 C147,171 148,180 140,189 C132,180 133,171 140,160Z" fill="${C.pale}"/>`;
    return svgV(s);
  }
  function v6() { // Tatras + téléphérique
    const R = rng(606);
    let s = `<rect width="280" height="410" fill="${C.ink}"/>${starDots(R, 16, 280, 140)}`;
    s += `<path d="M0,300 L70,150 L120,220 L190,96 L280,232 V410 H0Z" fill="${C.slate}"/>`;
    s += `<path d="M53,186 L70,150 L87,186 L78,180 L70,190 L62,180Z" fill="${C.paper}"/>`;
    s += `<path d="M168,134 L190,96 L214,132 L203,126 L194,138 L184,126 L176,136Z" fill="${C.paper}"/>`;
    s += `<path d="M0,330 C60,300 120,312 170,296 C220,282 250,300 280,292 V410 H0Z" fill="${C.night2}"/>`;
    s += `<path d="M0,346 C70,330 150,340 280,324 V410 H0Z" fill="${C.paper}" opacity=".9"/>`;
    // câble + pylônes
    s += `<line x1="150" y1="360" x2="262" y2="150" stroke="${C.soft}" stroke-width="1.6"/>`;
    s += `<path d="M146,364 L150,352 L154,364Z" fill="${C.soft}"/><rect x="258" y="146" width="8" height="40" fill="${C.slate}"/>`;
    s += `<g><animateMotion path="M152,356 L260,154" dur="16s" repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>`;
    s += `<line x1="0" y1="0" x2="0" y2="10" stroke="${C.soft}" stroke-width="1.6"/><rect x="-11" y="10" width="22" height="17" rx="4" fill="${C.gold}"/><rect x="-7" y="14" width="6" height="6" rx="1" fill="${C.ink}" opacity=".55"/><rect x="2" y="14" width="6" height="6" rx="1" fill="${C.ink}" opacity=".55"/></g>`;
    // chalet
    s += `<rect x="32" y="342" width="70" height="52" fill="${C.brick}"/><path d="M22,346 L67,306 L112,346Z" fill="${C.brick2}"/><path d="M28,341 L67,306 L106,341 L100,343 L67,314 L34,343Z" fill="${C.paper}"/>`;
    s += `<rect x="48" y="356" width="14" height="14" rx="2" fill="${C.gold}"/><rect x="72" y="360" width="12" height="34" rx="2" fill="${C.brick2}"/>`;
    s += `<rect x="0" y="392" width="280" height="18" fill="${C.paper}" opacity=".9"/>`;
    // neige
    for (let i = 0; i < 34; i++) {
      const x = R() * 280, dur = 6 + R() * 5, r = 1 + R() * 1.8, dx = (R() - 0.5) * 30;
      s += `<circle cx="${f1(x)}" cy="0" r="${f1(r)}" fill="${C.paper}" opacity="${f1(0.55 + R() * 0.45)}"><animateTransform attributeName="transform" type="translate" values="0,-12;${f1(dx)},200;0,422" dur="${f1(dur)}s" begin="${f1(-R() * dur)}s" repeatCount="indefinite"/></circle>`;
    }
    return svgV(s);
  }
  function v7() { // toits + jazz
    const R = rng(707);
    let s = `<defs>${haloGrad('v7m')}</defs><rect width="280" height="410" fill="${C.ink}"/>${starDots(R, 22, 280, 200)}`;
    s += `<circle cx="206" cy="84" r="68" fill="url(#v7m)"/><circle cx="206" cy="84" r="30" fill="${C.gold}"/>`;
    s += `<path d="M0,410 V250 L40,212 L80,250 V236 L130,196 L180,236 V228 L226,190 L280,236 V410Z" fill="${C.night2}"/>`;
    s += `<rect x="50" y="214" width="12" height="24" fill="${C.night2}"/><rect x="200" y="188" width="10" height="22" fill="${C.night2}"/>`;
    const hs = [[-6, 70, 280, C.brick3], [60, 80, 262, C.brick], [136, 70, 284, C.brick2], [202, 84, 268, C.brick3]];
    hs.forEach(([x, w, t, col]) => {
      s += `<path d="M${x},410 V${t} L${x + w / 2},${t - 34} L${x + w},${t} V410Z" fill="${col}"/>`;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
        if (R() < 0.75) s += `<rect x="${x + w / 2 - 20 + c * 28}" y="${t + 14 + r * 34}" width="12" height="17" rx="2" fill="${C.gold}" opacity="${f1(0.6 + R() * 0.4)}"/>`;
      }
    });
    s += `<rect x="0" y="372" width="280" height="38" fill="${C.hill}"/>`;
    s += `<rect x="112" y="380" width="56" height="20" rx="4" fill="${C.gold}"/><rect x="138" y="380" width="3" height="20" fill="${C.hill}"/>`;
    for (let i = 0; i < 3; i++) {
      const x0 = 120 + i * 18;
      s += `<g transform="translate(${x0},372)"><g opacity="0">`;
      s += `<animateTransform attributeName="transform" type="translate" values="0,0;${i % 2 ? -16 : 16},-110;0,-220" dur="3.6s" begin="${-i * 1.2}s" repeatCount="indefinite"/>`;
      s += `<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.15;.6;1" dur="3.6s" begin="${-i * 1.2}s" repeatCount="indefinite"/>`;
      s += `<ellipse cx="0" cy="0" rx="7" ry="5" transform="rotate(-22)" fill="${C.gold}"/><rect x="5" y="-30" width="2.8" height="30" fill="${C.gold}"/><path d="M7.8,-30 q11,6 8,18 q-2,-9 -8,-11Z" fill="${C.gold}"/></g></g>`;
    }
    return svgV(s);
  }

  // ------------------------------------------------------------------ carte (1000×700)
  const ROUTE_SEGS = ['M420,195 C410,270 378,330 385,400', ' C430,420 520,402 570,389', ' C600,430 640,490 650,549'];
  const ROUTE_PTS = [[420, 195], [385, 400], [570, 389], [650, 549]];
  const ARROWS = [ // [x0,y0,x1,y1]
    [282, 268, 66, 268],   // ouest  — Auschwitz
    [552, 108, 772, 44],   // nord-est — Nowa Huta
    [738, 592, 862, 630],  // sud-est — Wieliczka
    [530, 566, 530, 664]   // sud — Zakopane
  ];
  function mapSvg() {
    let s = `<svg viewBox="0 0 1000 700" width="1000" height="700" xmlns="http://www.w3.org/2000/svg">`;
    s += `<rect width="1000" height="700" rx="28" fill="${C.paper2}"/>`;
    // rues discrètes
    s += `<g stroke="#E2D7C4" stroke-width="7" fill="none" stroke-linecap="round"><path d="M0,120 C200,110 300,90 520,100 C700,108 820,150 1000,140"/><path d="M160,0 C190,200 210,420 180,700"/><path d="M760,0 C740,220 800,420 780,700"/><path d="M0,620 C300,640 600,600 1000,660"/></g>`;
    s += `<path d="M-20,378 C140,388 250,488 390,492 C530,496 592,450 692,460 C792,470 892,502 1020,494" fill="none" stroke="${C.river}" stroke-width="30" stroke-linecap="round"/>`;
    s += `<ellipse cx="420" cy="202" rx="120" ry="130" fill="#E6DCCB" stroke="#93A08E" stroke-width="22"/>`;
    s += `<rect x="390" y="165" width="60" height="60" rx="5" fill="${C.brick}"/>`;
    s += `<ellipse cx="385" cy="400" rx="58" ry="34" fill="${C.brick2}"/>`;
    s += `<rect x="510" y="358" width="120" height="62" rx="12" fill="${C.stone}"/>`;
    s += `<rect x="590" y="520" width="120" height="58" rx="12" fill="${C.slate}"/>`;
    ARROWS.forEach(([x0, y0, x1, y1], i) => {
      const a = Math.atan2(y1 - y0, x1 - x0), L = 16, Wd = 10;
      const bx = x1 - L * Math.cos(a), by = y1 - L * Math.sin(a);
      const nx = -Math.sin(a) * Wd, ny = Math.cos(a) * Wd;
      s += `<g id="arr${i}" opacity="0"><line x1="${x0}" y1="${y0}" x2="${f1(bx)}" y2="${f1(by)}" stroke="${C.softL}" stroke-width="4.5" stroke-dasharray="2 12" stroke-linecap="round"/>`;
      s += `<path d="M${x1},${y1} L${f1(bx + nx)},${f1(by + ny)} L${f1(bx - nx)},${f1(by - ny)}Z" fill="${C.softL}"/></g>`;
    });
    s += `<path id="route" d="${ROUTE_SEGS.join('')}" pathLength="720" fill="none" stroke="${C.gold}" stroke-width="9" stroke-linecap="round" stroke-dasharray="720" stroke-dashoffset="720"/>`;
    ROUTE_PTS.forEach(([x, y], i) => {
      s += `<circle id="rp${i}r" cx="${x}" cy="${y}" r="12" fill="none" stroke="${C.gold}" stroke-width="4" opacity="0"/>`;
      s += `<circle id="rp${i}" cx="${x}" cy="${y}" r="12" fill="${C.gold}" stroke="${C.paper}" stroke-width="4" opacity="0"/>`;
    });
    s += `</svg>`;
    return s;
  }
  const LABELS = [
    ['Vieille ville · Rynek', 560, 175], ['Wawel', 205, 382], ['Kazimierz', 645, 345], ['Podgórze', 725, 513],
    ['Vistule', 50, 418], ['Parc des Planty', 72, 116], ['Auschwitz · 70 km', 50, 288], ['Nowa Huta', 786, 22],
    ['Wieliczka · 14 km', 712, 646], ['Zakopane · 100 km', 250, 640]
  ];

  // ------------------------------------------------------------------ icônes (64×64)
  const icon = body => `<svg viewBox="0 0 64 64" width="170" height="170" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="${C.gold}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
  const steam = (x, y, i) => `<path d="M${x},${y} c-4,-4 4,-7 0,-11 c-4,-4 4,-7 0,-10" opacity="0"><animateTransform attributeName="transform" type="translate" values="0,4;0,-5" dur="2.4s" begin="${-i * 0.8}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="${-i * 0.8}s" repeatCount="indefinite"/></path>`;
  const ICONS = [
    icon(`<path d="M7,42 A25,25 0 0 1 57,42 Z"/><path d="M12.5,38.5 A19.5,19.5 0 0 1 51.5,38.5" stroke-dasharray="0.5 5.5" stroke-width="3.4"/>`),
    icon(`<path d="M8,32 H56 C56,46 46,54 32,54 C18,54 8,46 8,32Z"/><path d="M24,58 H40"/>${steam(22, 26, 0)}${steam(32, 25, 1)}${steam(42, 26, 2)}`),
    icon(`<path d="M13,32 H51 V48 C51,53 48,56 43,56 H21 C16,56 13,53 13,48Z"/><path d="M10,32 H54"/><path d="M17,32 C19,24 45,24 47,32"/><circle cx="32" cy="22.5" r="2.2"/><path d="M13,38 H7 M51,38 H57"/>${steam(22, 18, 0)}${steam(42, 18, 1.5)}`),
    (() => { let b = `<circle cx="32" cy="32" r="21"/><circle cx="32" cy="32" r="9"/>`;
      for (let i = 0; i < 9; i++) { const a = i * 40 * Math.PI / 180; const x0 = 32 + 10.5 * Math.cos(a), y0 = 32 + 10.5 * Math.sin(a), x1 = 32 + 19.5 * Math.cos(a + 0.5), y1 = 32 + 19.5 * Math.sin(a + 0.5); b += `<path d="M${f1(x0)},${f1(y0)} L${f1(x1)},${f1(y1)}" stroke-width="2"/>`; }
      for (let i = 0; i < 12; i++) { const a = (i * 30 + 15) * Math.PI / 180; b += `<ellipse cx="${f1(32 + 15 * Math.cos(a))}" cy="${f1(32 + 15 * Math.sin(a))}" rx="1.5" ry=".8" transform="rotate(${i * 30 + 105} ${f1(32 + 15 * Math.cos(a))} ${f1(32 + 15 * Math.sin(a))})" fill="${C.gold}" stroke="none"/>`; }
      return icon(b); })(),
    icon(`<path d="M5,32 C17,15 47,15 59,32 C47,49 17,49 5,32Z"/><path d="M18,25 L18,39 M25,22 L25,42 M32,21 L32,43 M39,22 L39,42 M46,25 L46,39" stroke-width="2.2"/><path d="M18,32 L25,29 L32,32 L39,29 L46,32" stroke-width="2"/>`),
    icon(`<circle cx="38" cy="34" r="20"/><circle cx="38" cy="34" r="12"/><path d="M10,12 V56"/><path d="M5,12 V22 Q10,29 15,22 V12"/>`)
  ];
  const FOODS = ['Pierogi', 'Żurek', 'Bigos', 'Obwarzanek', 'Oscypek', 'Bar mleczny'];

  // ------------------------------------------------------------------ données
  const DAYS = [
    ['La vieille ville', 'Rynek, Notre-Dame et le trompettiste de la tour', v1],
    ['La colline du Wawel', 'Château royal, cathédrale et Dame à l’hermine', v2],
    ['Kazimierz', 'Synagogues, Podgórze et zapiekanki place Nowy', v3],
    ['Wieliczka', '135&nbsp;m sous terre, une chapelle sculptée dans le sel', v4],
    ['Auschwitz-Birkenau', 'Une journée de mémoire, avec un guide', v5],
    ['Zakopane', 'Les Tatras sous la neige et les bains chauds', v6],
    ['Au choix', 'Nowa Huta, concert et jazz dans une cave', v7]
  ];
  const BUDGET = [['Hébergement', 360, C.brick], ['Repas', 350, C.brick2], ['Visites', 313, C.gold], ['Transports', 96, C.slate], ['Imprévus', 112, C.stone]];

  // ------------------------------------------------------------------ construction du DOM
  const E = {};
  function build() {
    const pano = panorama();
    $('aPano').innerHTML = pano; $('fPano').innerHTML = pano;
    $('aTitle').innerHTML = [...'Cracovie'].map(c => `<span>${c}</span>`).join('');
    $('fTitle').innerHTML = 'Do zobaczenia w Krakowie!'.split(' ').map(w => `<span>${w}</span>`).join(' ');

    // carte + étiquettes
    $('map').innerHTML = mapSvg() + LABELS.map(([txt, x, y]) => `<div class="pill" style="left:${x}px;top:${y}px">${txt}</div>`).join('');

    // jours
    $('days').innerHTML = DAYS.map(([ttl, lin, fn], k) => `
      <div class="day">
        <div class="digit wc">${k + 1}</div>
        <div class="vig wc">${fn()}</div>
        <div class="txt wc">
          <div class="kicker">Jour ${k + 1}</div>
          <div class="ttl"${k === 4 ? ' style="font-size:76px;white-space:nowrap"' : ''}>${ttl}</div>
          <div class="lin">${lin}</div>
        </div>
      </div>`).join('');
    $('dots').innerHTML = DAYS.map(() => '<i></i>').join('');

    // gastronomie : grille 3×2
    $('foods').innerHTML = FOODS.map((nm, i) => {
      const cx = [480, 960, 1440][i % 3], top = i < 3 ? 290 : 610;
      return `<div class="food wc" style="left:${cx - 210}px;top:${top}px">${ICONS[i]}<div class="nm">${nm}</div></div>`;
    }).join('');

    // budget : barre empilée
    const total = BUDGET.reduce((a, b) => a + b[1], 0);
    let acc = 0, bar = '', lab = '';
    BUDGET.forEach(([nm, v, col]) => {
      const h = 680 * v / total, bottom = acc; acc += h;
      bar += `<div class="seg" style="bottom:${f1(bottom)}px;height:${f1(h + 0.5)}px;background:${col}"></div>`;
      lab += `<div class="segl wc" style="top:${f1(200 + 680 - bottom - h / 2 - 17)}px">${nm} · <b>${v}&#8239;€</b></div>`;
    });
    $('bar').innerHTML = bar; $('segls').innerHTML = lab;

    // caches
    E.scenes = ['sA', 'sB', 'sC', 'sD', 'sE', 'sF'].map($);
    E.svgs = [...document.querySelectorAll('svg')].filter(s => !s.parentElement.closest('svg'));
    E.svgs.forEach(s => s.pauseAnimations());
    E.aLetters = [...$('aTitle').children];
    E.fWords = [...$('fTitle').children];
    E.bLines = [...document.querySelectorAll('#bLeft .ln')];
    E.pills = [...document.querySelectorAll('#map .pill')];
    E.days = [...document.querySelectorAll('.day')].map(d => ({
      el: d, digit: d.querySelector('.digit'), vig: d.querySelector('.vig'), txt: d.querySelector('.txt'),
      kick: d.querySelector('.kicker'), ttl: d.querySelector('.ttl'), lin: d.querySelector('.lin')
    }));
    E.dots = [...document.querySelectorAll('#dots i')];
    E.foods = [...document.querySelectorAll('.food')];
    E.ePills = [...document.querySelectorAll('#ePills .pill')];
    E.segs = [...document.querySelectorAll('.seg')];
    E.segls = [...document.querySelectorAll('.segl')];
    E.route = $('route');
    E.rp = ROUTE_PTS.map((_, i) => [$('rp' + i), $('rp' + i + 'r')]);
    E.arr = ARROWS.map((_, i) => $('arr' + i));
    // fractions du tracé où sont atteintes les étapes
    const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    E.route.ownerSVGElement.appendChild(tmp);
    const lens = []; let d = '';
    ROUTE_SEGS.forEach(sg => { d += sg; tmp.setAttribute('d', d); lens.push(tmp.getTotalLength()); });
    tmp.remove();
    E.rpFrac = [0, ...lens.map(l => l / lens[lens.length - 1])];

    // étoiles et neige (graine fixe)
    const Rs = rng(777);
    E.stars = Array.from({ length: 90 }, () => ({ x: Rs() * W, y: Rs() * 700, r: 0.8 + Rs() * 1.8, v: 0.8 + Rs() * 1.8, ph: Rs() * Math.PI * 2, b: 0.55 + Rs() * 0.45 }));
    const Rn = rng(2024);
    E.flakes = Array.from({ length: 140 }, () => ({ x: Rn() * W, y: Rn() * (H + 20), r: 1.5 + Rn() * 3.5, v: 40 + Rn() * 90, w: 0.4 + Rn() * 0.9, ph: Rn() * Math.PI * 2, a: 0 }));
    E.flakes.forEach(f => { f.a = 0.45 + 0.5 * (f.r - 1.5) / 3.5; });
    E.starCtx = $('stars').getContext('2d');
    E.snowCtx = $('snow').getContext('2d');
  }

  // ------------------------------------------------------------------ intensités globales
  function sceneIndex(t) { let i = 0; while (i < BOUND.length && t >= BOUND[i]) i++; return i; }
  const DAY_SNOW = [0.4, 0.4, 0.4, 0.4, 0, 1, 0.4];
  function snowLevel(t, sc) {
    if (sc === 0 || sc === 5) return 1;
    if (sc === 1 || sc === 4) return 0;
    if (sc === 3) return 0.25;
    const k = clamp(Math.floor((t - DAY0) / DAYLEN), 0, 6);
    let lv = DAY_SNOW[k];
    if (k < 6) { const b = dayStart(k + 1); if (t > b - PUSH) lv = lerp(DAY_SNOW[k], DAY_SNOW[k + 1], p(t, b - PUSH, b + PUSH)); }
    if (k > 0) { const b = dayStart(k); if (t < b + PUSH) lv = lerp(DAY_SNOW[k - 1], DAY_SNOW[k], p(t, b - PUSH, b + PUSH)); }
    return lv;
  }
  const STAR_LV = [1, 0, 0.55, 0.55, 0, 1];

  function drawStars(t, lv) {
    const ctx = E.starCtx; ctx.clearRect(0, 0, W, H);
    if (lv <= 0) return;
    for (const s of E.stars) {
      const a = lv * s.b * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(s.v * t + s.ph)));
      ctx.globalAlpha = a; ctx.fillStyle = s.r > 2 ? '#F6E8C8' : '#E8ECF4';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawSnow(t, lv) {
    const ctx = E.snowCtx; ctx.clearRect(0, 0, W, H);
    if (lv <= 0.001) return;
    ctx.fillStyle = '#F6F1E9';
    const span = H + 20;
    for (const f of E.flakes) {
      let y = (f.y + f.v * t) % span; y -= 10;
      const x = f.x + 26 * Math.sin(f.w * t + f.ph);
      ctx.globalAlpha = f.a * lv;
      ctx.beginPath(); ctx.arc(x, y, f.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const tf = (el, s) => { el.style.transform = s; };
  const op = (el, v) => { el.style.opacity = v; };

  // ------------------------------------------------------------------ scènes
  function sceneA(t) {
    tf($('aPano'), `translateY(${f1(400 * (1 - easeOutCubic(p(t, 0.2, 1.8))))}px)`);
    const m = p(t, 0.6, 1.5);
    tf($('aMoon'), `scale(${easeOutBack(m).toFixed(4)})`); op($('aMoon'), p(t, 0.6, 1.0));
    const k = easeOutCubic(p(t, 0.5, 1.2));
    op($('aKick'), k); tf($('aKick'), `translateX(${f1(-60 * (1 - k))}px)`);
    E.aLetters.forEach((el, i) => {
      const e = easeOutCubic(p(t, 1.0 + 0.07 * i, 1.65 + 0.07 * i));
      tf(el, `translateY(${f1(140 * (1 - e))}px) rotate(${(10 * (1 - e)).toFixed(3)}deg)`);
      op(el, clamp(p(t, 1.0 + 0.07 * i, 1.65 + 0.07 * i) * 1.6));
    });
    const en = easeOutCubic(p(t, 1.9, 2.8));
    op($('aEn'), en); $('aEn').style.letterSpacing = (0.7 - 0.55 * en).toFixed(4) + 'em';
    $('aLine').style.width = f1(320 * easeOutCubic(p(t, 2.3, 3.3))) + 'px';
    const sb = easeOutCubic(p(t, 2.8, 3.6));
    op($('aSub'), sb); tf($('aSub'), `translateY(${f1(40 * (1 - sb))}px)`);
    const ex = easeInOutCubic(p(t, 5.5, 6.3));
    tf($('aText'), `translateY(${f1(-90 * ex)}px)`); op($('aText'), 1 - ex);
  }

  function sceneB(u) {
    const m = easeOutCubic(p(u, 0, 1.2));
    op($('map'), m); tf($('map'), `scale(${(1.08 - 0.08 * m).toFixed(4)})`);
    const kk = easeOutCubic(p(u, 0.15, 0.7)); op($('bKick'), kk); tf($('bKick'), `translateX(${f1(-40 * (1 - kk))}px)`);
    E.bLines.forEach((el, i) => {
      const e = easeOutCubic(p(u, 0.4 + 0.3 * i, 1.0 + 0.3 * i));
      op(el, e); tf(el, `translateY(${f1(60 * (1 - e))}px)`);
    });
    const r = easeInOutCubic(p(u, 1.0, 4.0));
    E.route.setAttribute('stroke-dashoffset', f1(720 * (1 - r)));
    E.rp.forEach(([core, ring], i) => {
      const ta = 1.0 + 3.0 * invEase(E.rpFrac[i]);
      const e = p(u, ta, ta + 0.35);
      core.setAttribute('opacity', clamp(e * 2)); core.setAttribute('r', f1(12 * easeOutBack(e)));
      if (u >= ta) {
        const ph = ((u - ta) / 1.3) % 1;
        ring.setAttribute('opacity', (1 - ph) * 0.9); ring.setAttribute('r', f1(12 + 22 * easeOutCubic(ph)));
      } else ring.setAttribute('opacity', 0);
    });
    E.arr.forEach((g, i) => {
      const e = easeOutCubic(p(u, 2.5 + 0.2 * i, 3.1 + 0.2 * i));
      const [x0, y0, x1, y1] = ARROWS[i], L = Math.hypot(x1 - x0, y1 - y0);
      g.setAttribute('opacity', e);
      g.setAttribute('transform', `translate(${f1(-(x1 - x0) / L * 24 * (1 - e))},${f1(-(y1 - y0) / L * 24 * (1 - e))})`);
    });
    E.pills.forEach((el, j) => {
      const e = p(u, 1.6 + 0.2 * j, 2.1 + 0.2 * j);
      op(el, clamp(e * 3)); tf(el, `scale(${(0.55 + 0.45 * easeOutBack(e)).toFixed(4)})`);
    });
  }
  // inverse de easeInOutCubic (pour savoir quand le tracé atteint une étape)
  function invEase(y) { let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (easeInOutCubic(m) < y) lo = m; else hi = m; } return (lo + hi) / 2; }

  function sceneC(t) {
    E.days.forEach((d, k) => {
      const s = dayStart(k), e = s + DAYLEN;
      const vis = t >= (k === 0 ? DAY0 : s - PUSH) && t < (k === 6 ? 29.2 : e + PUSH);
      d.el.style.display = vis ? 'block' : 'none';
      if (!vis) return;
      const xin = k > 0 ? 1 - easeInOutCubic(p(t, s - PUSH, s + PUSH)) : 0;
      const xout = k < 6 ? -easeInOutCubic(p(t, e - PUSH, e + PUSH)) : 0;
      const x = (xin + xout) * PUSH_DIST;
      const sober = k === 4;
      const u = t - s - (k === 0 ? 0.3 : 0);
      // chiffre
      const ds = sober ? easeOutCubic(p(u, -0.2, 1.0)) : easeOutBack(p(u, -0.2, 0.8));
      tf(d.digit, `translateX(${f1(x * 1.25)}px) scale(${(0.82 + 0.18 * ds).toFixed(4)})`);
      op(d.digit, clamp(p(u, -0.3, 0.3)));
      // vignette
      const vy = sober ? easeInOutCubic(p(u, -0.2, 1.7)) : easeOutCubic(p(u, -0.15, 0.85));
      tf(d.vig, `translateX(${f1(x)}px) translateY(${f1(110 * (1 - vy))}px)`);
      op(d.vig, clamp(p(u, -0.3, sober ? 0.6 : 0.3)));
      // texte
      tf(d.txt, `translateX(${f1(x * 0.8)}px)`);
      const k1 = easeOutCubic(p(u, 0.1, 0.6)), k2 = p(u, 0.2, 0.75), k3 = easeOutCubic(p(u, 0.4, 0.95));
      op(d.kick, k1); tf(d.kick, `translateX(${f1(-30 * (1 - k1))}px)`);
      const k2e = sober ? easeOutCubic(k2) : easeOutBack(k2);
      op(d.ttl, clamp(k2 * 1.8)); tf(d.ttl, `translateY(${f1(50 * (1 - k2e))}px)`);
      op(d.lin, k3); tf(d.lin, `translateY(${f1(24 * (1 - k3))}px)`);
    });
    E.dots.forEach((el, k) => {
      const s = dayStart(k), e = s + DAYLEN;
      const a = (k === 0 ? 1 : p(t, s - PUSH, s + PUSH)) - (k === 6 ? 0 : p(t, e - PUSH, e + PUSH));
      const base = t >= e ? C.brick : C.slate;
      el.style.background = mixHex(base, C.gold, clamp(a));
      tf(el, `scale(${(1 + 0.35 * easeInOutCubic(clamp(a))).toFixed(4)})`);
    });
  }

  function sceneD(u) {
    const e = easeOutCubic(p(u, 0.2, 0.8));
    op($('dTitle'), e); tf($('dTitle'), `translateY(${f1(60 * (1 - e))}px)`);
    E.foods.forEach((el, i) => {
      const q = p(u, 0.6 + 0.16 * i, 1.2 + 0.16 * i);
      op(el, clamp(q * 2.5)); tf(el, `scale(${easeOutBack(q).toFixed(4)})`);
    });
  }

  const fmtNum = v => { const s = String(v); return s.length > 3 ? s.slice(0, -3) + ' ' + s.slice(-3) : s; };
  function sceneE(u) {
    const kk = easeOutCubic(p(u, 0.1, 0.6)); op($('eKick'), kk); tf($('eKick'), `translateX(${f1(-40 * (1 - kk))}px)`);
    const v = Math.round(1230 * easeOutCubic(p(u, 0.5, 2.4)));
    $('eNum').innerHTML = `${fmtNum(v)} <span class="eur">€</span>`;
    op($('eNum'), p(u, 0.25, 0.6));
    const s = easeOutCubic(p(u, 1.6, 2.2)); op($('eSent'), s); tf($('eSent'), `translateY(${f1(30 * (1 - s))}px)`);
    E.ePills.forEach((el, i) => {
      const q = p(u, 2.4 + 0.15 * i, 2.95 + 0.15 * i);
      op(el, clamp(q * 2.5)); tf(el, `translateY(${f1(70 * (1 - easeOutBack(q)))}px)`);
    });
    op($('bar'), p(u, 0.4, 0.8));
    E.segs.forEach((el, i) => {
      const q = easeOutCubic(p(u, 0.8 + 0.3 * i, 1.25 + 0.3 * i));
      tf(el, `scaleY(${q.toFixed(4)})`);
      const l = easeOutCubic(p(u, 0.95 + 0.3 * i, 1.45 + 0.3 * i));
      op(E.segls[i], l); tf(E.segls[i], `translateX(${f1(-24 * (1 - l))}px)`);
    });
  }

  function sceneF(u) {
    tf($('fPano'), `translateY(${f1(400 * (1 - easeOutCubic(p(u, 0, 1.6))))}px)`);
    const m = p(u, 0.5, 1.3);
    tf($('fMoon'), `scale(${easeOutBack(m).toFixed(4)})`); op($('fMoon'), p(u, 0.5, 0.9));
    E.fWords.forEach((el, j) => {
      const e = easeOutCubic(p(u, 0.8 + 0.18 * j, 1.4 + 0.18 * j));
      op(el, e); tf(el, `translateY(${f1(70 * (1 - e))}px)`);
    });
    const g = easeOutCubic(p(u, 1.9, 2.5)); op($('fGold'), g); tf($('fGold'), `translateY(${f1(30 * (1 - g))}px)`);
    const sm = easeOutCubic(p(u, 2.4, 3.0)); op($('fSmall'), sm); tf($('fSmall'), `translateY(${f1(24 * (1 - sm))}px)`);
  }

  // ------------------------------------------------------------------ render(t)
  let lastScene = -1;
  function render(t) {
    const sc = sceneIndex(t);
    if (sc !== lastScene) { E.scenes.forEach((el, i) => { el.style.display = i === sc ? 'block' : 'none'; }); lastScene = sc; }
    E.svgs.forEach(s => s.setCurrentTime(t));
    drawStars(t, STAR_LV[sc]);
    drawSnow(t, snowLevel(t, sc));
    const u = t - SCENE_START[sc];
    [sceneA, sceneB, sceneC, sceneD, sceneE, sceneF][sc](sc === 0 || sc === 2 ? t : u);

    // panneaux de transition
    let gx = -3200, bx = -3200;
    for (const b of BOUND) {
      const pb = p(t, b - 0.45, b + 0.45), pg = p(t, b - 0.52, b + 0.38);
      if (pb > 0 && pb < 1) bx = -3200 + 5300 * easeInOutCubic(pb);
      if (pg > 0 && pg < 1) gx = -3200 + 5300 * easeInOutCubic(pg);
    }
    tf($('panelGold'), `translateX(${f1(gx)}px) skewX(-12deg)`);
    tf($('panelBrick'), `translateX(${f1(bx)}px) skewX(-12deg)`);
    // fondu au noir
    op($('fade'), Math.max(1 - p(t, 0, 0.5), p(t, 44.0, 44.9)).toFixed(4));
  }

  build();
  window.render = render;
  window.ready = (async () => {
    await document.fonts.load('700 100px Lora', 'Cracovie żłąęśó Do zobaczenia');
    await document.fonts.load('600 40px Inter', 'JOUR żł');
    await document.fonts.load('400 40px Inter', 'Rynek żł');
    await document.fonts.ready;
    render(0);
    return true;
  })();
})();
