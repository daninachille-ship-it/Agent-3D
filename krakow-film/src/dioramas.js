// Experience tableaux (seq 4), excursion map, Wieliczka salt mine and the Auschwitz-Birkenau memorial (seq 5).
import * as THREE from 'three';
import { std, rng, hash, canvasTex, glowTex, glowPoints, box, cone, cyl, gableGeo, clamp, smooth, lerp, easeOutBack, easeOut, inv, bump } from './util.js';
import { llToVec } from './earth.js';

const S = (c, o = {}) => std(c, { ...o, patch: { snow: false, reveal: false } });

function person(c, skin = 0xf1c7a5, scale = 1) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.16, 3, 10), S(c, { roughness: 0.5 })); b.position.y = 0.16; b.castShadow = true; g.add(b);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), S(skin)); h.position.y = 0.35; h.castShadow = true; g.add(h);
  g.scale.setScalar(scale);
  return g;
}
const travelerPair = (scale = 1) => { const g = new THREE.Group(); const a = person(0xff5a4e, 0xf1c7a5, scale), b = person(0x22c1b5, 0xe8b894, scale); b.position.x = 0.22 * scale; g.add(a, b); return g; };

function plinth(radius, topColor, sideColor) {
  const g = new THREE.Group();
  const side = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.92, 0.6, 6), S(sideColor, { roughness: 0.6 })); side.position.y = -0.3; side.receiveShadow = true; g.add(side);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.98, radius * 0.98, 0.04, 6), S(topColor, { roughness: 0.8 })); top.position.y = 0.0; top.receiveShadow = true; g.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.03, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffe2a0 })); rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 6; rim.position.y = 0.02; g.add(rim);
  return g;
}

function steam(n, x, y, z, spread = 0.2, seed = 1) {
  const r = rng(seed); const pos = [], col = [], siz = [];
  for (let i = 0; i < n; i++) { pos.push(x + (r() - 0.5) * spread, y + r() * 0.8, z + (r() - 0.5) * spread); col.push(0.7, 0.7, 0.72); siz.push(0.6 + r()); }
  const p = glowPoints(pos, col, siz, { size: 0.5, opacity: 0.25 });
  p.userData.base = pos.slice();
  return p;
}
function animSteam(p, t) {
  const a = p.geometry.attributes.position.array, b = p.userData.base;
  for (let i = 0; i < a.length; i += 3) { const ph = (b[i + 1] + t * 0.35) % 0.8; a[i] = b[i] + Math.sin(t * 2 + i) * 0.03 * ph; a[i + 1] = (b[i + 1] - (b[i + 1] % 0.8)) + ph; }
  p.geometry.attributes.position.needsUpdate = true;
}

export function buildGallery() {
  const scene = new THREE.Scene();
  const R = rng(77);
  const items = [];
  const spacing = 30;
  const key = new THREE.DirectionalLight(0xfff0dd, 2.6); key.position.set(4, 9, 6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  const kc = key.shadow.camera; kc.left = -5; kc.right = 5; kc.top = 5; kc.bottom = -5; kc.near = 0.5; kc.far = 30; key.shadow.bias = -0.0005;
  scene.add(key, key.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x554433, 1.0); scene.add(hemi);
  const bgCol = new THREE.Color();
  scene.background = bgCol;

  const mk = (i, bg, build) => {
    const g = new THREE.Group(); g.position.x = i * spacing;
    const pl = plinth(3.2, build.top || 0xd9c9a8, build.side || 0x2b2b36); g.add(pl);
    const content = new THREE.Group(); g.add(content);
    const extra = build.fn(content) || {};
    scene.add(g);
    // floating sparkles around
    const pos = [], col = [], siz = []; const c = new THREE.Color(build.spark || 0xffe2a0);
    for (let k = 0; k < 120; k++) { const a = R() * Math.PI * 2, r = 3.5 + R() * 4; pos.push(Math.cos(a) * r, -0.5 + R() * 5, Math.sin(a) * r); col.push(c.r, c.g, c.b); siz.push(0.3 + R()); }
    const sp = glowPoints(pos, col, siz, { size: 0.35, opacity: 0.8 }); g.add(sp);
    items.push({ g, content, bg: new THREE.Color(bg), bg2: new THREE.Color(build.bg2 || bg), sp, ...extra });
  };

  // 1. Pierogi & Polish flavours — table-top close-up
  mk(0, 0x3a1d12, {
    top: 0x8a5a36, side: 0x3b2416, spark: 0xffc36b, bg2: 0x6b2f17,
    fn: (c) => {
      const table = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.12, 48), S(0x9c6a3f, { roughness: 0.6 })); table.position.y = 0.06; table.receiveShadow = true; c.add(table);
      const cloth = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.01, 48), S(0xf2ede4)); cloth.position.y = 0.125; c.add(cloth);
      const tex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1f4fa8'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 110, 0, 7); g.stroke(); g.lineWidth = 4; for (let k = 0; k < 12; k++) { const a = k / 12 * 6.28; g.beginPath(); g.arc(128 + Math.cos(a) * 95, 128 + Math.sin(a) * 95, 9, 0, 7); g.stroke(); } });
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.9, 0.08, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.25 })); plate.position.y = 0.17; plate.castShadow = true; c.add(plate);
      const shp = new THREE.Shape(); shp.absarc(0, 0, 0.26, 0, Math.PI, false); shp.lineTo(0.26, 0);
      const dg = new THREE.ExtrudeGeometry(shp, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 4, curveSegments: 16 });
      dg.translate(0, 0, -0.04);
      const dm = S(0xf3d79a, { roughness: 0.45 });
      const dumplings = [];
      for (let k = 0; k < 9; k++) {
        const a = k / 9 * Math.PI * 2, r = k === 8 ? 0 : 0.6;
        const d = new THREE.Mesh(dg, dm); d.rotation.x = -Math.PI / 2; d.rotation.z = a + 0.6; d.position.set(k === 8 ? 0 : Math.cos(a) * r, 0.27, k === 8 ? 0 : Math.sin(a) * r);
        if (k === 8) d.position.y = 0.36; d.castShadow = true; c.add(d); dumplings.push(d);
      }
      for (let k = 0; k < 60; k++) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), S(R() < 0.6 ? 0xc0732a : 0x4c8a33)); const a = R() * 6.28, r = R() * 0.8; o.position.set(Math.cos(a) * r, 0.38 + R() * 0.05, Math.sin(a) * r); c.add(o); }
      const bowl = cyl(0.32, 0.25, 0.2, 24, S(0xffffff, { roughness: 0.3 }), 1.35, 0.13, -0.6); c.add(bowl);
      const cream = cyl(0.29, 0.29, 0.02, 24, S(0xfffbf0), 1.35, 0.32, -0.6); c.add(cream);
      const glassM = new THREE.MeshStandardMaterial({ color: 0xffb02e, roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x6b3d00, emissiveIntensity: 0.6 });
      c.add(cyl(0.18, 0.15, 0.6, 20, glassM, -1.3, 0.13, -0.8)); c.add(cyl(0.18, 0.18, 0.1, 20, S(0xfffaf0), -1.3, 0.72, -0.8));
      c.add(cyl(0.18, 0.15, 0.6, 20, glassM, -1.0, 0.13, 1.1)); c.add(cyl(0.18, 0.18, 0.1, 20, S(0xfffaf0), -1.0, 0.72, 1.1));
      const fork = box(0.05, 0.02, 0.9, S(0xcfd3d8, { metalness: 0.9, roughness: 0.2 }), 1.35, 0.13, 0.6); fork.rotation.y = 0.3; c.add(fork);
      const st = steam(140, 0, 0.45, 0, 1.0, 5); c.add(st);
      return { tick: (t) => { animSteam(st, t); dumplings.forEach((d, k) => { d.position.y = (k === 8 ? 0.36 : 0.27) + Math.max(0, Math.sin(t * 7 + k)) * 0.0; }); } };
    },
  });
  // 2. Cafés — kawiarnia terrace + obwarzanek cart
  mk(1, 0x1d3b44, {
    top: 0xc9b89a, side: 0x223038, spark: 0xfff0c0, bg2: 0x2f6b6a,
    fn: (c) => {
      const fac = box(4.6, 2.6, 1.2, S(0xe8c47f), 0, 0, -1.9); c.add(fac);
      const sign = canvasTex(512, 96, (g, w, h) => { g.fillStyle = '#2b1d14'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd98a'; g.font = 'bold 60px Georgia, serif'; g.textAlign = 'center'; g.fillText('KAWIARNIA', w / 2, 70); });
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), new THREE.MeshStandardMaterial({ map: sign, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 0.6 })); sm.position.set(0, 2.05, -1.29); c.add(sm);
      const stripes = canvasTex(256, 64, (g, w, h) => { for (let k = 0; k < 16; k++) { g.fillStyle = k % 2 ? '#f4efe2' : '#b8302a'; g.fillRect(k * 16, 0, 16, h); } });
      const awn = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.9), new THREE.MeshStandardMaterial({ map: stripes, side: THREE.DoubleSide })); awn.position.set(0, 1.55, -0.95); awn.rotation.x = -0.6; c.add(awn);
      for (let k = 0; k < 3; k++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: 0xffb860, emissiveIntensity: 1.2 })); w.position.set(-1.4 + k * 1.4, 0.75, -1.29); c.add(w); }
      const umbM = S(0xf4efe2);
      const cups = [];
      [[-1.3, 0.6], [0.2, 1.0], [1.5, 0.3]].forEach(([x, z]) => {
        c.add(cyl(0.35, 0.35, 0.03, 20, S(0xf5f5f0), x, 0.42, z)); c.add(cyl(0.03, 0.03, 0.42, 6, S(0x333333), x, 0, z));
        c.add(cyl(0.02, 0.02, 1.3, 6, S(0x444444), x, 0, z)); const u = cone(0.85, 0.35, 10, umbM, x, 1.2, z); c.add(u);
        for (const s of [-1, 1]) c.add(box(0.2, 0.3, 0.2, S(0x6b4a2e), x + s * 0.5, 0, z));
        const cup = cyl(0.06, 0.05, 0.08, 12, S(0xffffff, { roughness: 0.2 }), x + 0.1, 0.45, z); c.add(cup); cups.push(cup);
      });
      const tp = travelerPair(1.6); tp.position.set(0.0, 0, 1.0); tp.rotation.y = 0.4; c.add(tp);
      // obwarzanek cart (Kraków's ring-bread)
      const cart = new THREE.Group(); cart.add(box(0.9, 0.5, 0.55, S(0x2f64b8), 0, 0.3, 0)); cart.add(box(0.95, 0.04, 0.6, S(0xdedede), 0, 0.8, 0));
      for (let k = 0; k < 10; k++) { const o = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.035, 6, 14), S(0xc98a3e)); o.rotation.x = Math.PI / 2; o.position.set(-0.32 + (k % 5) * 0.16, 0.86 + Math.floor(k / 5) * 0.05, -0.1 + Math.floor(k / 5) * 0.2); cart.add(o); }
      for (const s of [-1, 1]) { const wh = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 6, 16), S(0x222222)); wh.position.set(s * 0.3, 0.15, 0.3); cart.add(wh); }
      cart.position.set(-2.1, 0, 1.4); cart.rotation.y = 0.5; c.add(cart);
      const st = steam(40, 0.3, 0.55, 1.0, 0.2, 9); c.add(st);
      return { tick: (t) => animSteam(st, t) };
    },
  });
  // 3. Shopping — Sukiennice market stalls with amber
  mk(2, 0x3d2a10, {
    top: 0xd8c9a6, side: 0x3a2a14, spark: 0xffa733, bg2: 0x7a4a12,
    fn: (c) => {
      for (let k = 0; k < 5; k++) { const x = -2.4 + k * 1.2; c.add(cyl(0.12, 0.14, 2.2, 10, S(0xece2c8), x, 0, -1.6)); }
      const vault = box(5.4, 0.3, 1.0, S(0xe6d7b0), 0, 2.2, -1.6); c.add(vault);
      const amberM = new THREE.MeshStandardMaterial({ color: 0xffa21a, emissive: 0xff7a00, emissiveIntensity: 1.6, roughness: 0.15, transparent: true, opacity: 0.92 });
      const stalls = [];
      for (let k = 0; k < 4; k++) {
        const x = -1.8 + k * 1.2; const st = new THREE.Group();
        st.add(box(1.0, 0.7, 0.6, S(0x6b4528), 0, 0, 0));
        st.add(box(1.04, 0.04, 0.64, S(0x3a2614), 0, 0.7, 0));
        const roofS = new THREE.Mesh(gableGeo(), S([0xb8302a, 0x2c5d43, 0x1f4f8a, 0xc98a1a][k])); roofS.scale.set(1.1, 0.3, 0.8); roofS.position.y = 1.5; st.add(roofS);
        for (const s of [-1, 1]) st.add(box(0.04, 0.8, 0.04, S(0x3a2614), s * 0.48, 0.7, 0.28));
        for (let j = 0; j < 7; j++) { const a = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06 + R() * 0.04, 0), j % 3 === 0 ? S(0xd6c1a0) : amberM); a.position.set(-0.4 + j * 0.13, 0.78, (R() - 0.5) * 0.3); st.add(a); }
        st.position.set(x, 0, -0.4); c.add(st); stalls.push(st);
      }
      const bagCols = [0xe84a5f, 0xffd166, 0x118ab2];
      bagCols.forEach((bc, k) => { const b = box(0.35, 0.45, 0.15, S(bc), 0.6 + k * 0.4, 0, 1.4); b.rotation.y = 0.3 - k * 0.2; c.add(b); const hd = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 4, 12, Math.PI), S(0x222222)); hd.position.set(0.6 + k * 0.4, 0.45, 1.4); c.add(hd); });
      const tp = travelerPair(1.6); tp.position.set(-0.6, 0, 1.0); tp.rotation.y = Math.PI; c.add(tp);
      return { tick: (t) => { amberM.emissiveIntensity = 1.4 + 0.4 * Math.sin(t * 5); } };
    },
  });
  // 4. Museums & heritage — gallery hall, paintings, royal crown under spotlight
  mk(3, 0x161a2c, {
    top: 0xe8e2d6, side: 0x1f2233, spark: 0xbfd0ff, bg2: 0x2c3566,
    fn: (c) => {
      const wall = box(5.2, 2.6, 0.2, S(0x7a1f2b), 0, 0, -1.9); c.add(wall);
      const side = box(0.2, 2.6, 3.4, S(0x7a1f2b), -2.5, 0, -0.3); c.add(side);
      for (let k = 0; k < 6; k++) { c.add(cyl(0.13, 0.15, 2.6, 14, S(0xf0ece2), -2.0 + k * 0.85, 0, -1.55)); }
      const paint = (seed) => canvasTex(160, 200, (g, w, h) => { const r = rng(seed); g.fillStyle = `hsl(${r() * 60 + 10},40%,25%)`; g.fillRect(0, 0, w, h); for (let i = 0; i < 18; i++) { g.fillStyle = `hsla(${r() * 360},50%,${30 + r() * 40}%,0.7)`; g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 50, 10 + r() * 40, r() * 3, 0, 7); g.fill(); } g.fillStyle = 'rgba(240,210,170,0.9)'; g.beginPath(); g.ellipse(w / 2, h * 0.4, 22, 28, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(30,20,20,0.9)'; g.fillRect(w / 2 - 34, h * 0.58, 68, h * 0.42); });
      for (let k = 0; k < 3; k++) {
        const fr = box(1.0, 1.2, 0.06, S(0xc9a24a, { metalness: 0.8, roughness: 0.3 }), -1.6 + k * 1.6, 0.9, -1.78); c.add(fr);
        const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 1.04), new THREE.MeshStandardMaterial({ map: paint(k + 3), roughness: 0.8, emissive: 0xffffff, emissiveMap: paint(k + 3), emissiveIntensity: 0.15 })); pm.position.set(-1.6 + k * 1.6, 1.5, -1.745); c.add(pm);
      }
      c.add(cyl(0.35, 0.4, 0.9, 16, S(0xf2efe8), 0.8, 0, 0.8));
      const caseM = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.18, roughness: 0.05 });
      c.add(box(0.7, 0.7, 0.7, caseM, 0.8, 0.9, 0.8));
      const crown = new THREE.Group(); const cg = S(0xf2c14e, { metalness: 0.95, roughness: 0.2, emissive: 0x7a5200, emissiveIntensity: 0.5 });
      crown.add(cyl(0.2, 0.2, 0.12, 24, cg, 0, 0, 0)); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; crown.add(cone(0.05, 0.16, 4, cg, Math.cos(a) * 0.19, 0.1, Math.sin(a) * 0.19)); const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.03), new THREE.MeshStandardMaterial({ color: k % 2 ? 0xff2a4a : 0x2a7bff, emissive: k % 2 ? 0xff2a4a : 0x2a7bff, emissiveIntensity: 1.5 })); gem.position.set(Math.cos(a) * 0.205, 0.06, Math.sin(a) * 0.205); crown.add(gem); }
      crown.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), cg)).position.y = 0.22;
      crown.position.set(0.8, 1.0, 0.8); c.add(crown);
      const spot = new THREE.SpotLight(0xfff2d0, 30, 8, 0.35, 0.5); spot.position.set(0.8, 4, 0.8); spot.target = crown; c.add(spot);
      const tp = travelerPair(1.6); tp.position.set(-0.6, 0, 1.3); tp.rotation.y = Math.PI * 0.85; c.add(tp);
      return { tick: (t) => { crown.rotation.y = t * 1.5; } };
    },
  });
  // 5. Nightlife — vaulted brick cellar bar with neon
  mk(4, 0x14051f, {
    top: 0x3a2030, side: 0x1a0a22, spark: 0xff4fd8, bg2: 0x3a0f5a,
    fn: (c) => {
      const brickT = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#5a2a1e'; g.fillRect(0, 0, w, h); for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) { g.fillStyle = `hsl(12,${40 + Math.random() * 20}%,${28 + Math.random() * 12}%)`; g.fillRect(x * 32 + (y % 2) * 16 + 1, y * 16 + 1, 30, 14); } }, { repeat: [3, 2] });
      const vault = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 4.6, 32, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ map: brickT, side: THREE.BackSide, roughness: 0.9 }));
      vault.rotation.z = Math.PI / 2; vault.rotation.y = 0; vault.position.set(0, 0.2, -0.6); vault.scale.set(1, 1, 0.9); c.add(vault);
      const bar = box(3.6, 0.8, 0.6, S(0x3b2414), 0, 0, -0.9); c.add(bar);
      c.add(box(3.7, 0.06, 0.7, S(0x111111, { roughness: 0.2, metalness: 0.5 }), 0, 0.8, -0.9));
      const bottleCols = [0x2bd96b, 0xff3b6b, 0xffc21a, 0x39b7ff, 0xffffff, 0xa45bff];
      for (let k = 0; k < 16; k++) { const bc = bottleCols[k % 6]; const b = cyl(0.06, 0.07, 0.38, 10, new THREE.MeshStandardMaterial({ color: bc, emissive: bc, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }), -1.6 + k * 0.21, 1.3, -1.55); c.add(b); }
      c.add(box(3.6, 0.04, 0.3, S(0x2a1a10), 0, 1.28, -1.55));
      const neonT = canvasTex(512, 160, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.shadowColor = '#ff3fd8'; g.shadowBlur = 25; g.strokeStyle = '#ffb3f2'; g.lineWidth = 9; g.font = 'italic bold 78px Inter, sans-serif'; g.textAlign = 'center'; g.strokeText('NA ZDROWIE!', w / 2, 118); });
      const neon = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8), new THREE.MeshBasicMaterial({ map: neonT, transparent: true, blending: THREE.AdditiveBlending, color: 0xffffff })); neon.position.set(0, 2.05, -1.62); c.add(neon);
      const shots = [];
      for (let k = 0; k < 4; k++) { const s = cyl(0.05, 0.04, 0.12, 10, new THREE.MeshStandardMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.7, roughness: 0.05 }), -0.6 + k * 0.4, 0.86, -0.75); c.add(s); shots.push(s); }
      const tp = travelerPair(1.6); tp.position.set(-0.25, 0, 0.0); c.add(tp);
      // dancing crowd
      const crowd = [];
      for (let k = 0; k < 10; k++) { const p = person([0xff4fd8, 0x39b7ff, 0xffffff, 0xffc21a, 0xa45bff][k % 5], 0xe0b090, 1.4); p.position.set(-1.8 + (k % 5) * 0.9, 0, 0.9 + Math.floor(k / 5) * 0.7); c.add(p); crowd.push(p); }
      // disco beams
      const beamM = new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const beamsG = new THREE.Group(); for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3, 16, 1, true).translate(0, -1.5, 0), beamM.clone()); b.material.color.setHSL(k / 6, 1, 0.6); b.position.set(0, 2.3, 0.3); b.rotation.z = (k - 2.5) * 0.3; beamsG.add(b); } c.add(beamsG);
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), S(0xdddddd, { metalness: 1, roughness: 0.1, flatShading: true })); ball.position.set(0, 2.3, 0.3); c.add(ball);
      const pl = new THREE.PointLight(0xff4fd8, 8, 6); pl.position.set(0, 1.8, 0.6); c.add(pl);
      return { tick: (t) => { crowd.forEach((p, k) => { p.position.y = Math.abs(Math.sin(t * 8 + k)) * 0.12; }); beamsG.rotation.y = t * 2; ball.rotation.y = t * 3; beamsG.children.forEach((b, k) => b.rotation.z = Math.sin(t * 3 + k) * 0.7); pl.color.setHSL((t * 0.5) % 1, 1, 0.6); } };
    },
  });
  // 6. Urban walks — cobbled street, tenements, the two travelers strolling, glowing footprint trail
  mk(5, 0x1f3550, {
    top: 0xb7aa92, side: 0x253445, spark: 0xa8e6ff, bg2: 0x4a7aa8,
    fn: (c) => {
      const cols = ['#e7b48f', '#efe2c4', '#c9d6c2', '#e9cfc0', '#f1d9a8'];
      for (let k = 0; k < 5; k++) {
        const h = 1.6 + R() * 0.8; const b = box(0.95, h, 1.0, S(cols[k]), -2.0 + k * 1.0, 0, -1.7); c.add(b);
        const r = new THREE.Mesh(gableGeo(), S(0xb5532f)); r.scale.set(0.97, 0.5, 1.02); r.position.set(-2.0 + k * 1.0, h, -1.7); c.add(r);
        for (let f = 0; f < 3; f++) for (let w = 0; w < 2; w++) { const wm = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.26), new THREE.MeshStandardMaterial({ color: 0x2b3442, emissive: 0xffc070, emissiveIntensity: R() < 0.4 ? 0.8 : 0 })); wm.position.set(-2.2 + k * 1.0 + w * 0.4, 0.5 + f * 0.45, -1.195); c.add(wm); }
      }
      const tp = travelerPair(1.6); c.add(tp);
      const fp = []; const fpm = new THREE.MeshBasicMaterial({ color: 0x9be8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      for (let k = 0; k < 18; k++) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.05, 10), fpm.clone()); m.rotation.x = -Math.PI / 2; c.add(m); fp.push(m); }
      const lampP = []; for (let k = 0; k < 4; k++) { c.add(cyl(0.02, 0.025, 1.3, 6, S(0x222222), -2.2 + k * 1.5, 0, 0.9)); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd08a, blending: THREE.AdditiveBlending, depthWrite: false })); s.position.set(-2.2 + k * 1.5, 1.35, 0.9); s.scale.setScalar(0.6); c.add(s); }
      const pig = []; for (let k = 0; k < 12; k++) { const p = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0).scale(1.6, 0.5, 0.8), S(0x777788)); c.add(p); pig.push(p); }
      return {
        tick: (t) => {
          const x = -2.3 + ((t * 0.9) % 4.6);
          tp.position.set(x, 0, -0.2); tp.rotation.y = Math.PI / 2;
          tp.children.forEach((p, k) => p.position.y = Math.abs(Math.sin(t * 9 + k)) * 0.04);
          fp.forEach((m, k) => { const fx = x - 0.15 - k * 0.22; m.position.set(fx, 0.03, -0.2 + (k % 2 ? 0.08 : -0.08)); m.material.opacity = Math.max(0, 1 - k / 18) * (fx > -2.6 ? 1 : 0); });
          pig.forEach((p, k) => { const kk = clamp((t % 4) - hash(k) * 0.5); p.position.set(1.2 + Math.cos(k + kk * 3) * kk * 1.5, 0.05 + kk * 2.5, 0.6 + Math.sin(k + kk * 3) * kk * 1.5); });
        },
      };
    },
  });

  function update(t, idx, mixNext) {
    // idx: float index of the current tableau
    const i0 = Math.floor(idx), f = idx - i0;
    const a = items[clamp(i0, 0, items.length - 1)], b = items[clamp(i0 + 1, 0, items.length - 1)];
    bgCol.copy(a.bg).lerp(b.bg, smooth(0.75, 1, f));
    items.forEach((it, k) => {
      const d = idx - k; // seconds-ish distance
      // pop in: content rises & spins as it arrives
      const arrive = clamp(1 - Math.abs(d) * 1.2);
      it.content.scale.setScalar(Math.max(0.0001, easeOutBack(clamp((d + 0.65) / 0.45), 2)));
      it.content.rotation.y = (1 - easeOut(clamp((d + 0.65) / 0.6))) * -2.5;
      it.g.position.y = -(1 - easeOut(clamp((d + 0.8) / 0.5))) * 4;
      it.g.visible = d > -1.2 && d < 1.3;
      it.sp.rotation.y = t * 0.3;
      if (it.tick) it.tick(t);
    });
    key.target.position.set(idx * spacing, 0, 0); key.position.set(idx * spacing + 4, 9, 6);
  }
  return { scene, update, spacing, items };
}

// ---------------- Excursion map (Małopolska) ----------------
export function buildMap(world, topojson) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06101f);
  scene.fog = new THREE.FogExp2(0x06101f, 0.006);
  // Map projection: km around Kraków
  const K = { lat: 50.0614, lon: 19.9366 };
  const proj = (lat, lon) => [(lon - K.lon) * 71.5, -(lat - K.lat) * 111.2];
  const sites = { krakow: proj(50.0614, 19.9366), wieliczka: proj(49.987, 20.064), oswiecim: proj(50.035, 19.178) };
  const SZ = 160;
  const countries = topojson.feature(world, world.objects.countries).features;
  const tex = canvasTex(2048, 2048, (g, w, h) => {
    const toC = (x, z) => [(x / SZ + 0.5) * w, (z / SZ + 0.5) * h];
    g.fillStyle = '#0d2238'; g.fillRect(0, 0, w, h);
    // countries
    for (const f of countries) {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      g.fillStyle = f.id === '616' ? '#1f4a5c' : '#16323f'; g.strokeStyle = '#59c7ff'; g.lineWidth = 3;
      for (const poly of polys) { g.beginPath(); for (const ring of poly) ring.forEach(([lon, lat], i) => { const [x, z] = proj(lat, lon); const [cx, cy] = toC(x, z); i ? g.lineTo(cx, cy) : g.moveTo(cx, cy); }); g.fill(); g.stroke(); }
    }
    // grid
    g.strokeStyle = 'rgba(120,200,255,0.12)'; g.lineWidth = 1;
    for (let i = 0; i <= 32; i++) { g.beginPath(); g.moveTo(i / 32 * w, 0); g.lineTo(i / 32 * w, h); g.stroke(); g.beginPath(); g.moveTo(0, i / 32 * h); g.lineTo(w, i / 32 * h); g.stroke(); }
    // Vistula (approx.)
    const vis = [[50.02, 18.7], [50.0, 19.0], [50.03, 19.2], [50.05, 19.5], [50.03, 19.75], [50.05, 19.93], [50.04, 20.05], [50.07, 20.2], [50.1, 20.5], [50.2, 20.8]];
    g.strokeStyle = '#4fb6ff'; g.lineWidth = 7; g.beginPath(); vis.forEach(([la, lo], i) => { const [x, z] = proj(la, lo); const [cx, cy] = toC(x, z); i ? g.lineTo(cx, cy) : g.moveTo(cx, cy); }); g.stroke();
    // forests / hills hint
    const r = rng(5); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(80,160,120,${0.05 + r() * 0.08})`; g.beginPath(); g.arc(r() * w, h * 0.55 + r() * h * 0.45, 10 + r() * 40, 0, 7); g.fill(); }
    // labels
    g.font = 'bold 34px Inter, sans-serif'; g.fillStyle = 'rgba(160,220,255,0.55)'; g.textAlign = 'center';
    const lab = (txt, la, lo) => { const [x, z] = proj(la, lo); const [cx, cy] = toC(x, z); g.fillText(txt, cx, cy); };
    lab('POLSKA', 50.45, 19.9); lab('SLOVENSKO', 49.35, 19.9); lab('Wisła', 50.11, 20.35);
  });
  const geo = new THREE.PlaneGeometry(SZ, SZ, 200, 200);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); const z = -y; const hgt = Math.max(0, (z - 20) / 60) ** 1.5 * 6 * (0.6 + 0.4 * Math.sin(x * 0.15) * Math.cos(z * 0.2)) + 0.3 * Math.sin(x * 0.4) * Math.cos(z * 0.33); pos.setZ(i, hgt); }
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  scene.add(new THREE.HemisphereLight(0x9fd0ff, 0x101820, 1.2));
  const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(-30, 50, 20); scene.add(dl);

  // glowing cluster for Kraków
  const r = rng(8); const cp = [], cc = [], cs = [];
  for (let i = 0; i < 600; i++) { const a = r() * 6.28, d = Math.pow(r(), 1.8) * 6; cp.push(sites.krakow[0] + Math.cos(a) * d, 0.3 + r() * 0.3, sites.krakow[1] + Math.sin(a) * d); cc.push(1, 0.75 + r() * 0.2, 0.4); cs.push(0.4 + r() * 0.8); }
  const city = glowPoints(cp, cc, cs, { size: 0.9 }); scene.add(city);

  const mkPin = (xz, color) => {
    const g = new THREE.Group(); g.position.set(xz[0], 0, xz[1]);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 12, 1, true).translate(0, 3, 0), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 12), new THREE.MeshBasicMaterial({ color })); head.position.y = 6;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 48), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.4;
    g.add(col, head, ring); scene.add(g); return { g, ring };
  };
  const pins = { krakow: mkPin(sites.krakow, 0xffd27a), wieliczka: mkPin(sites.wieliczka, 0x8fe8ff), oswiecim: mkPin(sites.oswiecim, 0xdfe6ee) };
  const arc = (a, b, hgt) => new THREE.QuadraticBezierCurve3(new THREE.Vector3(a[0], 0.5, a[1]), new THREE.Vector3((a[0] + b[0]) / 2, hgt, (a[1] + b[1]) / 2), new THREE.Vector3(b[0], 0.5, b[1]));
  const mkLine = (curve, color) => {
    const geo = new THREE.TubeGeometry(curve, 120, 0.45, 8, false);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(m); const glowS = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, blending: THREE.AdditiveBlending, depthWrite: false })); glowS.scale.setScalar(5); scene.add(glowS);
    return { m, curve, count: geo.index.count, glowS };
  };
  const l1 = mkLine(arc(sites.krakow, sites.wieliczka, 6), 0xffe08a);
  const l2 = mkLine(arc(sites.krakow, sites.oswiecim, 14), 0xdfe6ee);
  const setLine = (l, p) => { l.m.geometry.setDrawRange(0, Math.floor(l.count * clamp(p) / 6) * 6); l.m.visible = p > 0; l.glowS.visible = p > 0 && p < 1.05; l.curve.getPoint(clamp(p), l.glowS.position); };

  function update(t, s) {
    // s: { l1, l2, pinW, pinO }
    setLine(l1, s.l1); setLine(l2, s.l2);
    pins.wieliczka.g.scale.setScalar(Math.max(0.0001, easeOutBack(clamp(s.pinW), 2)));
    pins.oswiecim.g.scale.setScalar(Math.max(0.0001, easeOutBack(clamp(s.pinO), 1.2)));
    for (const k in pins) { const rr = (t * 0.8) % 1; pins[k].ring.scale.setScalar(1 + rr * 2); pins[k].ring.material.opacity = 1 - rr; }
  }
  return { scene, update, sites };
}

// ---------------- Wieliczka Salt Mine ----------------
export function buildWieliczka() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0806);
  scene.fog = new THREE.FogExp2(0x120c08, 0.02);
  const R = rng(51);
  const salt = S(0xb9b1a3, { roughness: 0.55, metalness: 0.05 });
  const saltLight = S(0xd8d0c0, { roughness: 0.45 });
  const saltDark = S(0x7f776b, { roughness: 0.7 });
  const wood = S(0x6b4a2e, { roughness: 0.9 });
  // Cut-away earth block (surface at y = 12)
  const surfY = 12;
  const layers = [[0x3f6b2e, 0.6], [0x6b4a30, 2.4], [0x8a6a48, 2.0], [0x9c9282, 3.0], [0xa8a196, 4.0]];
  let y = surfY;
  layers.forEach(([c, h]) => { const l = box(16, h, 10, S(c, { roughness: 1 }), 0, y - h, -6); l.position.x = 0; scene.add(l); y -= h; });
  // Surface: Daniłowicz shaft headframe + buildings
  const head = new THREE.Group();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const leg = box(0.15, 3.2, 0.15, wood, sx * 0.6, 0, sz * 0.6); leg.rotation.z = -sx * 0.08; head.add(leg); }
  head.add(box(1.6, 0.15, 1.6, wood, 0, 3.1, 0)); head.add(cyl(0.45, 0.45, 0.12, 20, S(0x333333), 0, 3.3, 0));
  head.add(box(2.4, 1.2, 1.8, S(0xd9cba8), 2.2, 0, 0)); const hr = new THREE.Mesh(gableGeo(), S(0x6b3b2a)); hr.scale.set(2.4, 0.7, 1.9); hr.position.set(2.2, 1.2, 0); head.add(hr);
  head.position.set(-1, surfY, -3); scene.add(head);
  for (let k = 0; k < 25; k++) { const tr = cone(0.4, 1.4, 6, S(0x2f5a2a), -7 + R() * 14, surfY, -10 + R() * 8); scene.add(tr); }
  // Shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, surfY + 2, 16, 1, true), S(0x3a2e24, { side: THREE.DoubleSide })); shaft.position.set(-1, surfY / 2 - 1, -3); scene.add(shaft);
  // Galleries & chapel space: hollow carved out in front (z > -1) — chapel hall at y 0..4
  const hallL = 12, hallW = 5, hallH = 4.2;
  const floorT = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#8f8676'; g.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#a69d8c' : '#7d7465'; g.save(); g.translate(i * 64 + 32, j * 64 + 32); g.rotate(Math.PI / 4); g.fillRect(-22, -22, 44, 44); g.restore(); } }, { repeat: [3, 6] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(hallW, hallL), new THREE.MeshStandardMaterial({ map: floorT, roughness: 0.35, metalness: 0.1 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 6); floor.receiveShadow = true; scene.add(floor);
  // walls with bas-relief panels
  const relief = (seed) => canvasTex(256, 192, (g, w, h) => { const r = rng(seed); g.fillStyle = '#b7ae9d'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8b8272'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = '#cfc6b4'; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(40 + i * 45, 120 - r() * 20, 14, 40, 0, 0, 7); g.fill(); g.beginPath(); g.arc(40 + i * 45, 70 - r() * 20, 12, 0, 7); g.fill(); } g.fillStyle = '#dcd4c2'; g.beginPath(); g.moveTo(w / 2, 20); g.lineTo(w / 2 + 40, 60); g.lineTo(w / 2 - 40, 60); g.fill(); });
  for (const s of [-1, 1]) {
    const wall = box(0.4, hallH, hallL, salt, s * (hallW / 2 + 0.2), 0, 6); scene.add(wall);
    for (let k = 0; k < 4; k++) { const rp = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), new THREE.MeshStandardMaterial({ map: relief(k + (s > 0 ? 10 : 0)), roughness: 0.5, emissive: 0x302418, emissiveIntensity: 0.4 })); rp.position.set(s * (hallW / 2 - 0.005), 1.7, 1.4 + k * 2.9); rp.rotation.y = -s * Math.PI / 2; scene.add(rp); }
  }
  // ceiling (curved)
  const ceil = new THREE.Mesh(new THREE.CylinderGeometry(hallW / 2 + 0.4, hallW / 2 + 0.4, hallL, 24, 1, true, -Math.PI / 2, Math.PI), S(0x9a9182, { side: THREE.BackSide, roughness: 0.6 }));
  ceil.rotation.x = -Math.PI / 2; ceil.rotation.z = 0; ceil.position.set(0, hallH, 6); ceil.scale.set(1, 1, 0.5); scene.add(ceil);
  // altar at the far end
  const altar = new THREE.Group();
  altar.add(box(3.6, 3.8, 0.4, saltLight, 0, 0, 0)); altar.add(box(1.2, 0.8, 0.6, saltLight, 0, 0, 0.4));
  for (let k = 0; k < 4; k++) altar.add(cyl(0.12, 0.14, 3.2, 12, saltLight, -1.4 + k * 0.93, 0, 0.3));
  const statue = new THREE.Group(); statue.add(cyl(0.12, 0.25, 0.9, 12, saltLight, 0, 0, 0)); statue.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), saltLight)).position.y = 1.0; statue.position.set(0, 1.4, 0.35); altar.add(statue);
  altar.position.set(0, 0, 12.0); altar.rotation.y = Math.PI; scene.add(altar);
  // salt-crystal chandeliers
  const chand = [];
  const crystalM = new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0xffc98a, emissiveIntensity: 0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.95 });
  for (let k = 0; k < 4; k++) {
    const g = new THREE.Group();
    g.add(cyl(0.008, 0.008, 1.1, 4, saltDark, 0, 0, 0));
    for (let tier = 0; tier < 3; tier++) { const rr = 0.55 - tier * 0.15; const n = 12 - tier * 3; for (let j = 0; j < n; j++) { const a = j / n * 6.28; const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), crystalM); c.scale.y = 2.2; c.position.set(Math.cos(a) * rr, -tier * 0.22, Math.sin(a) * rr); g.add(c); } }
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); core.scale.setScalar(2.4); core.position.y = -0.2; g.add(core);
    const pl = new THREE.PointLight(0xffc98a, 0, 7, 1.6); pl.position.y = -0.3; g.add(pl);
    g.position.set(0, hallH - 0.3, 2.5 + k * 2.6); scene.add(g); chand.push({ g, core, pl });
  }
  // gallery tunnels with wooden supports leading from the shaft
  for (let k = 0; k < 8; k++) { const z = -2 + k * 0.5; scene.add(box(0.12, 2.2, 0.12, wood, -2.0, 4.5, z)); scene.add(box(0.12, 2.2, 0.12, wood, 0.0, 4.5, z)); scene.add(box(2.2, 0.12, 0.14, wood, -1.0, 6.7, z)); }
  // underground salt lake glow
  const lake = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40), new THREE.MeshStandardMaterial({ color: 0x0c3a3a, emissive: 0x1fa89a, emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.6 })); lake.rotation.x = -Math.PI / 2; lake.position.set(5.5, 6.05, -4); scene.add(lake);
  scene.add(box(5, 0.1, 5, saltDark, 5.5, 5.95, -4));
  // travelers in the nave
  const tp = travelerPair(2.2); tp.position.set(-0.3, 0, 4.5); tp.rotation.y = Math.PI; scene.add(tp);
  // salt sparkles
  const pos = [], col = [], siz = [];
  for (let i = 0; i < 900; i++) { pos.push((R() - 0.5) * 5, R() * 4.2, 0 + R() * 12.5); col.push(1, 0.92, 0.8); siz.push(0.1 + R() * 0.4); }
  const sp = glowPoints(pos, col, siz, { size: 0.4, opacity: 0.8 }); scene.add(sp);
  scene.add(new THREE.AmbientLight(0x8a8278, 1.3));
  const warm = new THREE.PointLight(0xffc890, 6, 20, 1.5); warm.position.set(0, 3, 10); scene.add(warm);
  const surfLight = new THREE.DirectionalLight(0xfff0d8, 2.0); surfLight.position.set(5, 30, 10); scene.add(surfLight);
  function update(t, k) {
    // k: chandelier ignition 0..1
    chand.forEach((c, i) => { const on = clamp(k * 4 - i * 0.8); c.core.material.opacity = on; c.pl.intensity = on * 6; });
    crystalM.emissiveIntensity = k * 2.2;
    sp.material.uniforms.uOpacity.value = 0.4 + 0.4 * Math.sin(t * 3);
  }
  return { scene, update, surfY };
}

// ---------------- Auschwitz-Birkenau Memorial (sober, documentary) ----------------
export function buildMemorial() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9aa0a6);
  scene.fog = new THREE.Fog(0x9aa0a6, 20, 110);
  const brick = S(0x7a5248, { roughness: 0.95 });
  const roof = S(0x4a4440, { roughness: 0.9 });
  const woodM = S(0x5a4a3c, { roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), S(0x7d8068, { roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // Gate building: long low brick building with central tower; rails pass through the arch
  const gate = new THREE.Group();
  gate.add(box(30, 3.2, 4, brick, 0, 0, 0));
  const gr = new THREE.Mesh(gableGeo(), roof); gr.scale.set(30, 1.4, 4.2); gr.position.y = 3.2; gate.add(gr);
  gate.add(box(5, 9, 4.6, brick, 0, 0, 0));
  gate.add(box(5.4, 1.4, 5.0, brick, 0, 7.6, 0));
  const tr = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.6, 4), roof); tr.rotation.y = Math.PI / 4; tr.position.y = 10.3; gate.add(tr);
  // arch opening (dark)
  gate.add(box(2.4, 4.2, 4.7, S(0x1a1a1a), 0, 0, 0));
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) gate.add(box(0.8, 0.8, 0.05, S(0x222222), s * (0.9 + k * 0.0), 6.0, 2.31 + 0.0).translateX(s * k * 1.2 - s * 1.5 + (s > 0 ? 0.6 : -0.6)));
  gate.position.set(0, 0, 0); scene.add(gate);
  // rails into the camp (towards -z), concrete sleepers
  const railM = S(0x5a5550, { metalness: 0.6, roughness: 0.5 });
  for (const s of [-0.72, 0.72]) { const r = box(0.12, 0.12, 120, railM, s, 0.05, -40); scene.add(r); }
  for (let k = 0; k < 120; k++) scene.add(box(2.4, 0.08, 0.3, S(0x6a645c), 0, 0, 18 - k * 1.0));
  // barracks rows
  for (let row = 0; row < 2; row++) for (let k = 0; k < 9; k++) for (const s of [-1, 1]) {
    const x = s * (14 + row * 12), z = -12 - k * 11;
    const b = box(4, 2.2, 9, woodM, x, 0, z); scene.add(b);
    const r = new THREE.Mesh(gableGeo(), roof); r.rotation.y = Math.PI / 2; r.scale.set(9.2, 1.2, 4.4); r.position.set(x, 2.2, z); r.castShadow = true; scene.add(r);
    scene.add(box(0.8, 0.4, 7, roof, x, 3.3, z));
  }
  // concrete fence posts with curved tops & wire
  const postM = S(0xa9a69e, { roughness: 1 });
  const wireP = [];
  for (const s of [-1, 1]) for (let k = 0; k < 40; k++) {
    const x = s * 8.5, z = -6 - k * 3;
    const p = box(0.2, 3, 0.2, postM, x, 0, z); scene.add(p);
    const top = box(0.15, 0.15, 0.6, postM, x - s * 0.25, 3, z); top.rotation.y = Math.PI / 2; scene.add(top);
    for (let w = 0; w < 6; w++) wireP.push(x, 0.5 + w * 0.45, z, x, 0.5 + w * 0.45, z - 3);
  }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wireP, 3));
  scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x3a3a3a })));
  // watchtowers
  for (const [x, z] of [[-8.5, -30], [8.5, -60], [-8.5, -90]]) { const wt = new THREE.Group(); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) wt.add(box(0.2, 5, 0.2, woodM, a * 0.9, 0, b * 0.9)); wt.add(box(2.4, 1.2, 2.4, woodM, 0, 5, 0)); const rr = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1, 4), roof); rr.rotation.y = Math.PI / 4; rr.position.y = 6.7; wt.add(rr); wt.position.set(x, 0, z); scene.add(wt); }
  // memorial candles at the rails
  const candles = [];
  for (let k = 0; k < 9; k++) { const c = cyl(0.06, 0.06, 0.18, 8, S(0xeeeeee), -0.9 + (k % 5) * 0.45 + (k > 4 ? 0.2 : 0), 0, 8 + Math.floor(k / 5) * 0.4); scene.add(c); const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); fl.scale.setScalar(0.5); fl.position.set(c.position.x, 0.3, c.position.z); scene.add(fl); candles.push(fl); }
  scene.add(new THREE.HemisphereLight(0xd0d4d8, 0x5a5a50, 1.6));
  const dl = new THREE.DirectionalLight(0xe0e4e8, 1.0); dl.position.set(-20, 30, 25); dl.castShadow = true; dl.shadow.mapSize.set(2048, 2048);
  const sc = dl.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.far = 120; scene.add(dl);
  function update(t) { candles.forEach((c, k) => { c.scale.setScalar(0.45 + 0.08 * Math.sin(t * 13 + k * 2)); }); }
  return { scene, update };
}
