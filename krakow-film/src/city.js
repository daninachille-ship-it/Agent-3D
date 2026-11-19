// The miniature city of Kraków — layout follows the real geography (units: 1 = 10 m, x = east, z = south).
import * as THREE from 'three';
import { std, patch, G, rng, hash, canvasTex, glowTex, gableGeo, box, cone, cyl, Buildable, clamp, smooth, lerp, easeOutBack, easeOut, inv } from './util.js';

export const P = {
  rynek: new THREE.Vector3(0, 0, 0),
  cloth: new THREE.Vector3(-0.5, 0, 0.5),
  mary: new THREE.Vector3(10.5, 0, -6.5),
  townhall: new THREE.Vector3(-5.2, 0, 6.8),
  adalbert: new THREE.Vector3(4.6, 0, 7.6),
  florian: new THREE.Vector3(0, 0, -43.5),
  barbican: new THREE.Vector3(0, 0, -49.5),
  wawel: new THREE.Vector3(-4, 0, 76),
  kazimierz: new THREE.Vector3(33, 0, 88),
  placNowy: new THREE.Vector3(32, 0, 86),
  szeroka: new THREE.Vector3(49, 0, 86),
};

const RIVER_PTS = [[-170, 40], [-110, 48], [-60, 60], [-29, 72], [-18, 86], [-4, 96.5], [20, 106], [50, 112], [85, 106], [120, 92], [170, 80]];
export const river = new THREE.CatmullRomCurve3(RIVER_PTS.map(([x, z]) => new THREE.Vector3(x, 0, z)));
const RING_PTS = [[0, -53.5], [27, -47], [43, -22], [44.5, 18], [36, 46], [14, 63.5], [-14, 63], [-34, 50], [-44.5, 20], [-44, -18], [-30, -46]];
export const ringRoad = new THREE.CatmullRomCurve3(RING_PTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), true);
const riverSamples = river.getSpacedPoints(600);
export const riverDist = (x, z) => { let m = 1e9; for (const p of riverSamples) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < m) m = d; } return Math.sqrt(m); };
const inPlanty = (x, z, s = 1) => ((x / (36 * s)) ** 2 + ((z - 8) / (52 * s)) ** 2) < 1;

const PASTELS = ['#efe2c4', '#e8c99a', '#f1d9a8', '#e7b48f', '#d9c7a7', '#f3e7cf', '#c9d6c2', '#e9cfc0', '#d8a77f', '#f0dcb4', '#cbd5dc', '#e6d2a0', '#f2c9a4', '#bfa58a'];
const KAZ = ['#d4795a', '#e3a85b', '#7f9e8a', '#c96f5f', '#e7c26a', '#8fa8b8', '#b9675a', '#e0b090', '#a7c4a0', '#c98a4f'];
const MODERN = ['#d8d4cc', '#c9c2b5', '#bdb6aa', '#e0d9cc', '#cfc7b8', '#b5aea3', '#d5c4a8'];
const ROOFS = ['#a8573a', '#9a4a32', '#b0654a', '#8f4c36', '#a35d42', '#7f4433', '#b67552', '#6e6a66', '#5d7f72'];

function facadeTextures(cols, rows, shop, seed) {
  const W = 256, H = 512;
  const r = rng(seed);
  const lit = [];
  const draw = (g, emissive) => {
    const r2 = rng(seed);
    g.fillStyle = emissive ? '#000' : '#fff'; g.fillRect(0, 0, W, H);
    const top = 40, bottom = shop ? 110 : 30;
    if (!emissive) {
      g.fillStyle = '#d9d2c4'; g.fillRect(0, 0, W, 22); g.fillStyle = '#c4bba9'; g.fillRect(0, 22, W, 8);
      g.fillStyle = '#e8e1d2'; g.fillRect(0, H - bottom - 8, W, 8);
      for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(0,0,0,${0.02 + r2() * 0.03})`; g.fillRect(r2() * W, r2() * H, 30 + r2() * 60, 30 + r2() * 80); }
    }
    const cw = W / cols, rh = (H - top - bottom) / rows;
    let k = 0;
    for (let row = 0; row < rows; row++) for (let c = 0; c < cols; c++) {
      const x = c * cw + cw * 0.25, y = top + row * rh + rh * 0.18, w = cw * 0.5, h = rh * 0.62;
      const on = lit[k] ?? (lit[k] = r() < 0.55); k++;
      if (emissive) { if (on) { g.fillStyle = r2() < 0.2 ? '#ffe2b0' : '#ffc77a'; g.fillRect(x + 2, y + 2, w - 4, h - 4); } }
      else {
        g.fillStyle = '#f7f3ea'; g.fillRect(x - 5, y - 5, w + 10, h + 12);
        g.fillStyle = '#2b3442'; g.fillRect(x, y, w, h);
        g.fillStyle = '#4a5a6e'; g.fillRect(x, y, w, h * 0.45);
        g.fillStyle = '#f7f3ea'; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h * 0.4, w, 3);
      }
    }
    if (shop) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * 0.12, y = H - bottom + 14, w = cw * 0.76, h = bottom - 22;
        if (emissive) { g.fillStyle = '#ffb860'; g.fillRect(x, y, w, h); }
        else { g.fillStyle = '#1e2530'; g.fillRect(x, y, w, h); g.fillStyle = '#5d4a3a'; g.fillRect(x - 4, y - 8, w + 8, 8); }
      }
    }
  };
  const map = canvasTex(W, H, (g) => draw(g, false));
  const emis = canvasTex(W, H, (g) => draw(g, true));
  return { map, emis };
}

function muralTex(seed) {
  const r = rng(seed);
  return canvasTex(256, 384, (g, w, h) => {
    const hues = [r() * 360, r() * 360, r() * 360];
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, `hsl(${hues[0]},80%,55%)`); gr.addColorStop(1, `hsl(${hues[1]},80%,45%)`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      g.fillStyle = `hsla(${hues[i % 3] + r() * 60},90%,${50 + r() * 30}%,0.85)`;
      g.beginPath(); g.arc(r() * w, r() * h, 20 + r() * 90, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = '#111'; g.lineWidth = 7;
    // a stylised face in profile
    g.beginPath(); g.moveTo(w * 0.3, h * 0.2); g.bezierCurveTo(w * 0.8, h * 0.1, w * 0.85, h * 0.5, w * 0.62, h * 0.55); g.lineTo(w * 0.7, h * 0.65); g.lineTo(w * 0.55, h * 0.7); g.bezierCurveTo(w * 0.6, h * 0.95, w * 0.2, h * 0.9, w * 0.25, h * 0.6); g.stroke();
    g.fillStyle = '#111'; g.beginPath(); g.arc(w * 0.55, h * 0.35, 9, 0, 7); g.fill();
  });
}

function pointedWindow(w, h, mat) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h);
  s.quadraticCurveTo(w / 2, h + w * 0.55, 0, h + w * 0.85);
  s.quadraticCurveTo(-w / 2, h + w * 0.55, -w / 2, h); s.closePath();
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s), mat);
  return m;
}

export function buildCity() {
  const scene = new THREE.Scene();
  const R = rng(2024);
  const anim = []; // per-frame updaters

  // ---------- Ground (painted map) ----------
  const GX0 = -170, GZ0 = -150, GS = 340;
  const toC = (x, z, S) => [((x - GX0) / GS) * S, ((z - GZ0) / GS) * S];
  const groundTex = canvasTex(4096, 4096, (g, S) => {
    const u = S / GS;
    g.fillStyle = '#a9a291'; g.fillRect(0, 0, S, S);
    // outskirts green falloff
    const [cx, cz] = toC(0, 20, S);
    const gr = g.createRadialGradient(cx, cz, 120 * u, cx, cz, 175 * u);
    gr.addColorStop(0, 'rgba(110,140,80,0)'); gr.addColorStop(1, 'rgba(104,138,74,1)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    // noise speckle
    const r = rng(9);
    for (let i = 0; i < 26000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.03 + r() * 0.04})`; const s = (0.5 + r() * 2.5) * u; g.fillRect(r() * S, r() * S, s, s); }
    // Błonia meadow and parks
    const park = (x, z, rx, rz, c = '#7ea35a') => { const [px, pz] = toC(x, z, S); g.fillStyle = c; g.beginPath(); g.ellipse(px, pz, rx * u, rz * u, 0, 0, 7); g.fill(); };
    park(-95, 5, 30, 18); park(-70, -30, 12, 9, '#76a052'); park(60, -40, 10, 8); park(-40, 110, 16, 10, '#7aa056'); park(90, 60, 12, 9);
    // river banks green boulevards
    g.lineCap = 'round'; g.lineJoin = 'round';
    const pathOf = (curve, n = 300) => { g.beginPath(); curve.getSpacedPoints(n).forEach((p, i) => { const [x, y] = toC(p.x, p.z, S); i ? g.lineTo(x, y) : g.moveTo(x, y); }); };
    g.strokeStyle = '#86a960'; g.lineWidth = 22 * u; pathOf(river); g.stroke();
    g.strokeStyle = '#cdbf9e'; g.lineWidth = 14 * u; pathOf(river); g.stroke();
    // Ring road + Planty
    g.strokeStyle = '#6f6a62'; g.lineWidth = 3.2 * u; pathOf(ringRoad); g.stroke();
    g.strokeStyle = '#99928a'; g.lineWidth = 0.25 * u; pathOf(ringRoad); g.stroke();
    const [ox, oz] = toC(0, 8, S);
    g.fillStyle = '#6f9a4c'; g.beginPath(); g.ellipse(ox, oz, 41 * u, 57 * u, 0, 0, 7); g.fill();
    g.fillStyle = '#c4baa6'; g.beginPath(); g.ellipse(ox, oz, 36.5 * u, 52.5 * u, 0, 0, 7); g.fill();
    // Planty walking paths
    g.strokeStyle = '#d8ccb1'; g.lineWidth = 0.6 * u; g.beginPath(); g.ellipse(ox, oz, 38.8 * u, 54.8 * u, 0, 0, 7); g.stroke();
    // radial roads
    g.strokeStyle = '#7b766d'; g.lineWidth = 2.4 * u;
    for (let a = 0; a < 10; a++) { const ang = a / 10 * Math.PI * 2 + 0.2; const [x0, y0] = toC(Math.cos(ang) * 48, 8 + Math.sin(ang) * 62, S); const [x1, y1] = toC(Math.cos(ang) * 190, 8 + Math.sin(ang) * 190, S); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    // Old-town streets
    g.strokeStyle = '#a49b8b'; g.lineWidth = 1.4 * u;
    for (const v of STREETS_X) { const [x0, y0] = toC(v, -60, S); const [x1, y1] = toC(v, 70, S); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    for (const v of STREETS_Z) { const [x0, y0] = toC(-45, v, S); const [x1, y1] = toC(45, v, S); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    // Rynek paving
    const [rx0, rz0] = toC(-10, -10, S);
    g.fillStyle = '#ddd2bd'; g.fillRect(rx0, rz0, 20 * u, 20 * u);
    g.strokeStyle = 'rgba(150,135,110,0.45)'; g.lineWidth = 0.08 * u;
    for (let i = -10; i <= 10; i += 1) { const [a, b] = toC(i, -10, S); const [c, d] = toC(i, 10, S); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); const [e, f] = toC(-10, i, S); const [h, k] = toC(10, i, S); g.beginPath(); g.moveTo(e, f); g.lineTo(h, k); g.stroke(); }
    g.strokeStyle = 'rgba(140,120,95,0.6)'; g.lineWidth = 0.18 * u; g.strokeRect(rx0 + 0.6 * u, rz0 + 0.6 * u, 18.8 * u, 18.8 * u);
    // Kazimierz & Stradom paving
    const [kx, kz] = toC(12, 66, S); g.fillStyle = '#c2b39a'; g.fillRect(kx, kz, 46 * u, 36 * u);
    g.strokeStyle = '#9d9079'; g.lineWidth = 1.2 * u;
    for (const v of KAZ_X) { const [a, b] = toC(v, 66, S); const [c, d] = toC(v, 100, S); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
    for (const v of KAZ_Z) { const [a, b] = toC(12, v, S); const [c, d] = toC(58, v, S); g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
    const [sx, sz] = toC(46, 79, S); g.fillStyle = '#d6c8ae'; g.fillRect(sx, sz, 6 * u, 13 * u);
    const [px, pz] = toC(29, 83, S); g.fillStyle = '#d6c8ae'; g.fillRect(px, pz, 6.5 * u, 6.5 * u);
    // Grodzka / Stradom
    g.strokeStyle = '#a49b8b'; g.lineWidth = 1.5 * u; g.beginPath(); let [a1, b1] = toC(0, 60, S); g.moveTo(a1, b1); [a1, b1] = toC(4, 66, S); g.lineTo(a1, b1); [a1, b1] = toC(20, 80, S); g.lineTo(a1, b1); g.stroke();
    // tram tracks Kazimierz line
    g.strokeStyle = '#5c5850'; g.lineWidth = 0.35 * u; g.beginPath(); TRAM_K.forEach(([x, z], i) => { const [a, b] = toC(x, z, S); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke();
  });
  const groundMat = std(0xffffff, { map: groundTex, roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GS, GS), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(GX0 + GS / 2, 0, GZ0 + GS / 2);
  ground.receiveShadow = true; scene.add(ground);
  const farGround = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), std(0x678a49, { roughness: 1 }));
  farGround.rotation.x = -Math.PI / 2; farGround.position.y = -0.05; farGround.receiveShadow = true; scene.add(farGround);

  // ---------- Living-map glowing street lines ----------
  const linePts = [];
  const seg = (a, b) => linePts.push(a[0], 0.06, a[1], b[0], 0.06, b[1]);
  for (const v of STREETS_X) seg([v, -50], [v, 60]);
  for (const v of STREETS_Z) seg([-40, v], [40, v]);
  ringRoad.getSpacedPoints(160).forEach((p, i, arr) => { if (i) seg([arr[i - 1].x, arr[i - 1].z], [p.x, p.z]); });
  river.getSpacedPoints(200).forEach((p, i, arr) => { if (i) { const q = arr[i - 1]; seg([q.x, q.z - 5.5], [p.x, p.z - 5.5]); seg([q.x, q.z + 5.5], [p.x, p.z + 5.5]); } });
  for (let a = 0; a < 10; a++) { const ang = a / 10 * Math.PI * 2 + 0.2; seg([Math.cos(ang) * 48, 8 + Math.sin(ang) * 62], [Math.cos(ang) * 190, 8 + Math.sin(ang) * 190]); }
  for (const v of KAZ_X) seg([v, 66], [v, 100]);
  for (const v of KAZ_Z) seg([12, v], [58, v]);
  for (let i = 0; i < 4; i++) { const s = 10 - i * 0.01; seg([-s, -s], [s, -s]); seg([s, -s], [s, s]); seg([s, s], [-s, s]); seg([-s, s], [-s, -s]); }
  const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
  const lineMat = new THREE.ShaderMaterial({
    uniforms: { ...G, uO: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uReveal; uniform vec2 uRevealC; uniform float uO; varying vec3 vW;
      void main(){ float d = length(vW.xz-uRevealC); if(d>uReveal) discard; float edge = smoothstep(6.0,0.0,uReveal-d);
        gl_FragColor = vec4(vec3(0.35,0.85,1.0)*(uO*0.9 + edge*2.5), 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const streetLines = new THREE.LineSegments(lineGeo, lineMat); streetLines.frustumCulled = false;
  scene.add(streetLines);

  // ---------- River ----------
  const rv = [], ri = [], ruv = [];
  const NS = 400;
  const rp = river.getSpacedPoints(NS);
  for (let i = 0; i <= NS; i++) {
    const p = rp[i], tng = river.getTangentAt(i / NS); const nx = -tng.z, nz = tng.x;
    rv.push(p.x + nx * 5.6, 0.03, p.z + nz * 5.6, p.x - nx * 5.6, 0.03, p.z - nz * 5.6);
    ruv.push(i / NS * 60, 0, i / NS * 60, 1);
    if (i < NS) { const a = i * 2; ri.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const riverGeo = new THREE.BufferGeometry();
  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(rv, 3));
  riverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(ruv, 2));
  riverGeo.setIndex(ri); riverGeo.computeVertexNormals();
  const waterMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uSkyTop: { value: new THREE.Color() }, uSkyHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() },
      uTime: G.uTime, uNight: { value: 0 }, uReveal: G.uReveal, uRevealC: G.uRevealC, uSnow: G.uSnow,
    }]),
    vertexShader: `#include <fog_pars_vertex>
      varying vec3 vW; varying vec2 vUv; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mvPosition = viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `#include <fog_pars_fragment>
      uniform vec3 uSkyTop; uniform vec3 uSkyHor; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uTime; uniform float uNight; uniform float uReveal; uniform vec2 uRevealC; uniform float uSnow;
      varying vec3 vW; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        if(length(vW.xz-uRevealC) > uReveal) discard;
        vec2 p = vW.xz;
        vec3 n = normalize(vec3(
          0.06*sin(p.x*2.1+uTime*1.7)+0.04*sin(p.y*3.3-uTime*1.3)+0.03*sin((p.x+p.y)*5.0+uTime*2.3),
          1.0,
          0.06*cos(p.y*2.4+uTime*1.5)+0.04*cos(p.x*3.1+uTime*1.1)+0.03*cos((p.x-p.y)*4.7-uTime*2.1)));
        vec3 v = normalize(cameraPosition - vW);
        float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0)*0.85 + 0.15;
        vec3 r = reflect(-v, n);
        vec3 sky = mix(uSkyHor, uSkyTop, clamp(r.y*1.4, 0.0, 1.0));
        vec3 deep = mix(vec3(0.05,0.17,0.2), vec3(0.02,0.04,0.07), uNight);
        vec3 col = mix(deep, sky, fr);
        float sp = pow(max(dot(r, normalize(uSun)), 0.0), 220.0);
        col += uSunCol * sp * 3.0;
        // city light shimmer at night
        float edge = abs(vUv.y - 0.5)*2.0;
        float sh = step(0.985, h(floor(vec2(vUv.x*40.0, vUv.y*10.0 + sin(uTime*2.0+vUv.x*30.)*0.6))));
        col += vec3(1.0,0.7,0.35) * sh * uNight * smoothstep(0.3, 1.0, edge) * 2.5;
        col += vec3(1.0,0.75,0.4) * uNight * smoothstep(0.6, 1.0, edge) * 0.25 * (0.6+0.4*sin(vUv.x*80.0+uTime));
        col = mix(col, vec3(0.75,0.82,0.88), uSnow*0.25);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
    fog: true,
  });
  const water = new THREE.Mesh(riverGeo, waterMat); water.receiveShadow = false; scene.add(water);

  // ---------- Houses (instanced) ----------
  const houses = []; // {x,z,rot,w,d,h,col,roof,rh,type}
  const addRow = (x0, z0, x1, z1, inward, opts) => {
    // frontage from (x0,z0) to (x1,z1); inward = unit normal pointing to the block interior
    const len = Math.hypot(x1 - x0, z1 - z0); const dx = (x1 - x0) / len, dz = (z1 - z0) / len;
    let s = 0;
    while (s < len - 0.4) {
      let w = opts.wMin + R() * (opts.wMax - opts.wMin); if (s + w > len) w = len - s;
      const d = opts.dMin + R() * (opts.dMax - opts.dMin);
      const cx = x0 + dx * (s + w / 2) + inward[0] * d / 2, cz = z0 + dz * (s + w / 2) + inward[1] * d / 2;
      const skip = opts.skip && opts.skip(cx, cz);
      if (!skip) houses.push({ x: cx, z: cz, rot: Math.atan2(-dz, dx), w: w * 0.985, d, h: opts.hMin + R() * (opts.hMax - opts.hMin), col: opts.pal[Math.floor(R() * opts.pal.length)], roof: ROOFS[Math.floor(R() * ROOFS.length)], rh: opts.flat && R() < opts.flat ? 0.05 : 0.45 + R() * 0.45, type: opts.type });
      s += w;
    }
  };
  const block = (x0, x1, z0, z1, opts) => {
    const dm = opts.dMax;
    addRow(x0, z0, x1, z0, [0, 1], opts); // north side
    addRow(x1, z1, x0, z1, [0, -1], opts); // south side
    addRow(x1, z0 + dm, x1, z1 - dm, [-1, 0], opts); // east
    addRow(x0, z1 - dm, x0, z0 + dm, [1, 0], opts); // west
  };
  const nearMonument = (x, z) => (x > 7 && x < 17.5 && z > -9.5 && z < -3.5) || (Math.hypot(x - P.florian.x, z - P.florian.z) < 2.5);
  const oldOpts = { wMin: 0.9, wMax: 1.5, dMin: 2.0, dMax: 2.8, hMin: 1.35, hMax: 2.1, pal: PASTELS, type: 0, skip: nearMonument };
  // Rynek frontage
  const rr = { ...oldOpts, dMin: 2.6, dMax: 3.0 };
  addRow(-13, -10, -0.8, -10, [0, -1], rr); addRow(0.8, -10, 13, -10, [0, -1], rr);
  addRow(-13, 10, -0.8, 10, [0, 1], rr); addRow(0.8, 10, 13, 10, [0, 1], rr);
  addRow(10, -7, 10, -0.7, [1, 0], rr); addRow(10, 0.7, 10, 7, [1, 0], rr);
  addRow(-10, -7, -10, -0.7, [-1, 0], rr); addRow(-10, 0.7, -10, 7, [-1, 0], rr);
  // Old-town blocks
  const XB = [[-35, -27.5], [-26.1, -18.6], [-17.2, -14.4], [-13, -0.75], [0.75, 13], [14.4, 17.2], [18.6, 26.1], [27.5, 35]];
  const ZB = [[-45, -33.4], [-32, -23.9], [-22.5, -14.4], [14.4, 22.5], [23.9, 32], [33.4, 41.5], [42.9, 51], [52.4, 60.5]];
  for (const [x0, x1] of XB) for (const [z0, z1] of ZB) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (!inPlanty(cx, cz, 0.98)) continue;
    block(x0, x1, z0, z1, oldOpts);
  }
  // side columns flanking the Rynek (between z -13..13)
  for (const [x0, x1] of [[-35, -27.5], [-26.1, -18.6], [-17.2, -14.4], [14.4, 17.2], [18.6, 26.1], [27.5, 35]]) {
    for (const [z0, z1] of [[-13, -0.75], [0.75, 13]]) if (inPlanty((x0 + x1) / 2, (z0 + z1) / 2, 0.98)) block(x0, x1, z0, z1, oldOpts);
  }
  // Stradom + Kazimierz
  const kazOpts = { wMin: 0.9, wMax: 1.6, dMin: 1.8, dMax: 2.6, hMin: 1.1, hMax: 1.9, pal: KAZ.concat(PASTELS.slice(0, 5)), type: 1 };
  const kazSkip = (x, z) => (x > 28.6 && x < 35.6 && z > 82.6 && z < 89.6) || (x > 45.5 && x < 52.5 && z > 78.5 && z < 92.5) || Math.hypot(x - 49, z - 95) < 2.2 || Math.hypot(x - 21.5, z - 93.5) < 3.2;
  for (let i = 0; i < KAZ_X.length - 1; i++) for (let j = 0; j < KAZ_Z.length - 1; j++) {
    const x0 = KAZ_X[i] + 0.65, x1 = KAZ_X[i + 1] - 0.65, z0 = KAZ_Z[j] + 0.65, z1 = KAZ_Z[j + 1] - 0.65;
    if (x1 - x0 < 2 || z1 - z0 < 2) continue;
    block(x0, x1, z0, z1, { ...kazOpts, skip: kazSkip });
  }
  // Outer city
  const modOpts = { wMin: 1.4, wMax: 3.0, dMin: 2.2, dMax: 3.4, hMin: 1.2, hMax: 2.8, pal: MODERN.concat(PASTELS), type: 2, flat: 0.45 };
  for (let gx = -150; gx < 150; gx += 11) for (let gz = -140; gz < 175; gz += 11) {
    const cx = gx + 5, cz = gz + 5;
    if (((cx) / 50) ** 2 + ((cz - 8) / 65) ** 2 < 1) continue;
    if (Math.hypot(cx - P.wawel.x, cz - P.wawel.z) < 18) continue;
    if (cx > 8 && cx < 60 && cz > 62 && cz < 103) continue;
    if (((cx + 95) / 33) ** 2 + ((cz - 5) / 21) ** 2 < 1) continue;
    if (riverDist(cx, cz) < 15) continue;
    const dist = Math.hypot(cx, cz - 20);
    if (R() < smooth(80, 160, dist) * 0.8) continue;
    block(gx + 1, gx + 9.6, gz + 1, gz + 9.6, { ...modOpts, hMax: lerp(2.8, 1.6, smooth(60, 150, dist)) });
  }

  const facadeOld = facadeTextures(3, 4, true, 11);
  const facadeMod = facadeTextures(5, 4, false, 12);
  const mkHouseMat = (f) => std(0xffffff, { map: f.map, emissiveMap: f.emis, emissive: 0xffd6a0, emissiveIntensity: 0, roughness: 0.85 });
  const houseMatOld = mkHouseMat(facadeOld), houseMatMod = mkHouseMat(facadeMod);
  const roofMat = std(0xffffff, { roughness: 0.7 });
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const roofGeoG = gableGeo();
  const groups = [houses.filter((h) => h.type !== 2), houses.filter((h) => h.type === 2)];
  const houseMeshes = [];
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  groups.forEach((list, gi) => {
    const body = new THREE.InstancedMesh(bodyGeo, gi ? houseMatMod : houseMatOld, list.length);
    const roof = new THREE.InstancedMesh(roofGeoG, roofMat, list.length);
    body.castShadow = body.receiveShadow = roof.castShadow = roof.receiveShadow = true;
    list.forEach((h, i) => {
      body.setColorAt(i, col.set(h.col)); roof.setColorAt(i, col.set(h.roof));
      h.delay = Math.hypot(h.x, h.z) * 0.011 + hash(i + gi * 9999) * 0.35;
    });
    body.frustumCulled = roof.frustumCulled = false;
    scene.add(body, roof);
    houseMeshes.push({ body, roof, list });
  });
  let lastHouseP = -1;
  function setHouses(t0, t) {
    // eruption wave: houses rise starting at t0 from the centre outward
    const key = clamp(t - t0, -1, 5).toFixed(3);
    if (key === lastHouseP) return; lastHouseP = key;
    for (const { body, roof, list } of houseMeshes) {
      list.forEach((h, i) => {
        const l = clamp((t - t0 - h.delay) / 0.55);
        const s = l <= 0 ? 0.0001 : easeOutBack(l, 2.6);
        tmpQ.setFromAxisAngle(yAxis, h.rot);
        tmpP.set(h.x, 0, h.z); tmpS.set(h.w, h.h * s, h.d);
        body.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
        tmpP.set(h.x, h.h * s, h.z); tmpS.set(h.w * 1.02, h.rh * Math.max(0.0001, s), h.d * 1.04);
        roof.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
      });
      body.instanceMatrix.needsUpdate = roof.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------- Murals (Kazimierz street art) ----------
  const murals = new THREE.Group();
  [[20.2, 1.6, 82.0, 0, 1], [36.8, 1.6, 88.0, -Math.PI / 2, 2], [45.3, 1.5, 84.5, Math.PI / 2, 3], [27.5, 1.6, 95.5, 0, 4], [52.8, 1.6, 89, -Math.PI / 2, 5]].forEach(([x, y, z, ry, s]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.6), new THREE.MeshStandardMaterial({ map: muralTex(s), roughness: 0.8, emissive: 0xffffff, emissiveMap: muralTex(s), emissiveIntensity: 0 }));
    m.position.set(x, y, z); m.rotation.y = ry; murals.add(m);
  });
  scene.add(murals);

  // ---------- Monuments ----------
  const M = {};
  const brick = std(0x8c4c3b, { roughness: 0.85 });
  const brickDark = std(0x6c3b2e, { roughness: 0.9 });
  const stone = std(0xd8cdb6, { roughness: 0.8 });
  const cream = std(0xead8b0, { roughness: 0.75 });
  const copper = std(0x4f8f78, { roughness: 0.55, metalness: 0.35 });
  const copperDark = std(0x3c6b5c, { roughness: 0.6, metalness: 0.3 });
  const slate = std(0x4c4a4f, { roughness: 0.6 });
  const gold = std(0xe2b44c, { roughness: 0.25, metalness: 0.9, emissive: 0x6b4a10, emissiveIntensity: 0.25 });
  const tile = std(0xb55a35, { roughness: 0.7 });
  const white = std(0xf3efe6, { roughness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1b2333, roughness: 0.2, metalness: 0.4, emissive: 0xffb865, emissiveIntensity: 0, side: THREE.DoubleSide });
  const stained = new THREE.MeshStandardMaterial({ color: 0x223, roughness: 0.3, emissive: 0x6a7dff, emissiveIntensity: 0, side: THREE.DoubleSide });
  const floodMats = [brick, brickDark, stone, cream, white, copper, tile];

  // St. Mary's Basilica: west front (two unequal towers) faces the square
  {
    const g = new THREE.Group();
    const x0 = 8.2, len = 8.4, zc = 0; // local: towers at x0..x0+1.4
    g.add(box(len, 2.8, 3.0, brick, x0 + 1.2 + len / 2, 0, zc));
    // steep nave roof
    const roofM = new THREE.Mesh(gableGeo(), slate); roofM.scale.set(len, 1.8, 3.1); roofM.position.set(x0 + 1.2 + len / 2, 2.8, zc); roofM.castShadow = true; g.add(roofM);
    // chancel (narrower) & apse
    g.add(box(2.4, 2.6, 2.3, brick, x0 + 1.2 + len + 0.6, 0, zc));
    const ap = cyl(1.15, 1.15, 2.6, 8, brick, x0 + len + 2.8, 0, zc); g.add(ap);
    g.add(cone(1.25, 1.5, 8, slate, x0 + len + 2.8, 2.6, zc, Math.PI / 8));
    // buttresses
    for (let i = 0; i < 6; i++) { g.add(box(0.25, 2.5, 0.3, brickDark, x0 + 2.0 + i * 1.35, 0, zc - 1.62)); g.add(box(0.25, 2.5, 0.3, brickDark, x0 + 2.0 + i * 1.35, 0, zc + 1.62)); }
    // gothic windows
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
      const w = pointedWindow(0.42, 1.2, stained); w.position.set(x0 + 2.65 + i * 1.35, 0.8, zc + s * 1.505); w.rotation.y = s > 0 ? 0 : Math.PI; g.add(w);
    }
    // North tower (taller, gothic spire with crown)
    const tN = zc - 1.0, tS = zc + 1.0;
    g.add(box(1.45, 5.6, 1.45, brick, x0 + 0.72, 0, tN));
    g.add(box(1.25, 0.8, 1.25, brickDark, x0 + 0.72, 5.6, tN));
    const sp = cone(0.62, 2.6, 8, copper, x0 + 0.72, 6.4, tN, Math.PI / 8); g.add(sp);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.add(cone(0.1, 0.9, 6, copper, x0 + 0.72 + Math.cos(a) * 0.62, 6.4, tN + Math.sin(a) * 0.62)); }
    g.add(cyl(0.22, 0.26, 0.25, 12, gold, x0 + 0.72, 7.3, tN)); // the gilded crown
    g.add(cone(0.04, 0.6, 6, gold, x0 + 0.72, 9.0, tN));
    // South tower (lower, renaissance helmet)
    g.add(box(1.35, 4.9, 1.35, brick, x0 + 0.72, 0, tS));
    g.add(cyl(0.5, 0.62, 0.5, 8, copper, x0 + 0.72, 4.9, tS));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), copper); dome.position.set(x0 + 0.72, 5.4, tS); dome.castShadow = true; g.add(dome);
    g.add(cyl(0.12, 0.16, 0.5, 8, copper, x0 + 0.72, 5.85, tS)); g.add(cone(0.12, 0.6, 8, copper, x0 + 0.72, 6.35, tS));
    // porch between towers + big west window
    g.add(box(0.7, 1.2, 0.6, stone, x0 + 0.2, 0, zc));
    const ww = pointedWindow(0.7, 1.5, stained); ww.position.set(x0 + 0.05, 1.6, zc); ww.rotation.y = -Math.PI / 2; g.add(ww);
    g.position.set(0, 0, P.mary.z);
    scene.add(g); M.mary = new Buildable(g, { spread: 0.65, drop: 4 });
  }
  // Cloth Hall (Sukiennice) — long axis north–south, arcades & renaissance attic
  {
    const g = new THREE.Group();
    const L = 10.4, Wd = 2.3, Hh = 1.45;
    g.add(box(Wd, Hh, L, cream, 0, 0, 0));
    // main roof (behind attic)
    const rf = new THREE.Mesh(gableGeo(), tile); rf.rotation.y = Math.PI / 2; rf.scale.set(L - 0.2, 0.7, Wd - 0.3); rf.position.set(0, Hh, 0); rf.castShadow = true; g.add(rf);
    // attic parapet with crenels & mascarons
    for (const s of [-1, 1]) {
      g.add(box(0.12, 0.32, L, cream, s * (Wd / 2 - 0.06), Hh, 0));
      for (let i = 0; i < 22; i++) g.add(box(0.14, 0.18, 0.18, white, s * (Wd / 2 - 0.06), Hh + 0.32, -L / 2 + 0.25 + i * (L - 0.5) / 21));
    }
    for (const s of [-1, 1]) { g.add(box(Wd, 0.5, 0.12, cream, 0, Hh, s * (L / 2 - 0.06))); }
    // arcades (loggias) along both long sides
    for (const s of [-1, 1]) {
      g.add(box(0.7, 0.09, L, white, s * (Wd / 2 + 0.35), 0.62, 0));
      const ar = new THREE.Mesh(gableGeo(), tile); ar.rotation.y = Math.PI / 2; ar.scale.set(L, 0.18, 0.7); ar.position.set(s * (Wd / 2 + 0.35), 0.71, 0); g.add(ar);
      for (let i = 0; i <= 16; i++) g.add(box(0.09, 0.62, 0.09, white, s * (Wd / 2 + 0.66), 0, -L / 2 + i * L / 16));
    }
    // central risalit (entrance) projecting on each long side, taller
    for (const s of [-1, 1]) { g.add(box(0.5, 2.0, 2.2, cream, s * (Wd / 2 + 0.15), 0, 0)); for (let i = 0; i < 5; i++) g.add(box(0.12, 0.2, 0.2, white, s * (Wd / 2 + 0.3), 2.0, -0.9 + i * 0.45)); }
    // windows row
    for (const s of [-1, 1]) for (let i = 0; i < 12; i++) { if (Math.abs(i - 5.5) < 1.6) continue; const w = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.42), glass); w.position.set(s * (Wd / 2 + 0.005), 0.95, -L / 2 + 0.55 + i * 0.85); w.rotation.y = s * Math.PI / 2; g.add(w); }
    g.position.copy(P.cloth);
    scene.add(g); M.cloth = new Buildable(g, { spread: 0.6, drop: 3 });
  }
  // Town Hall Tower
  {
    const g = new THREE.Group();
    g.add(box(1.5, 1.0, 1.5, stone, 0, 0, 0));
    g.add(box(1.35, 4.2, 1.35, brick, 0, 1.0, 0));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.22, 5.0, 0.22, stone, sx * 0.68, 0, sz * 0.68));
    g.add(box(1.45, 0.25, 1.45, stone, 0, 5.2, 0));
    g.add(cyl(0.55, 0.7, 0.6, 8, slate, 0, 5.45, 0));
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), slate); d.position.set(0, 6.05, 0); d.castShadow = true; g.add(d);
    g.add(cyl(0.15, 0.18, 0.5, 8, slate, 0, 6.5, 0)); g.add(cone(0.15, 0.7, 8, slate, 0, 7.0, 0)); g.add(cone(0.03, 0.4, 6, gold, 0, 7.6, 0));
    for (const s of [-1, 1]) { const w = pointedWindow(0.3, 0.7, glass); w.position.set(0, 3.3, s * 0.68); w.rotation.y = s > 0 ? 0 : Math.PI; g.add(w); }
    g.position.copy(P.townhall); g.rotation.y = 0.05;
    scene.add(g); M.townhall = new Buildable(g, { spread: 0.7, drop: 3 });
  }
  // St. Adalbert's church
  {
    const g = new THREE.Group();
    g.add(box(1.2, 0.9, 1.7, stone, 0, 0, 0));
    const rf = new THREE.Mesh(gableGeo(), copperDark); rf.rotation.y = Math.PI / 2; rf.scale.set(1.7, 0.5, 1.25); rf.position.y = 0.9; g.add(rf);
    g.add(cyl(0.35, 0.4, 0.45, 8, stone, 0, 1.1, -0.5));
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), copper); d.position.set(0, 1.55, -0.5); g.add(d);
    g.add(cone(0.08, 0.4, 8, copper, 0, 1.9, -0.5));
    g.position.copy(P.adalbert);
    scene.add(g); M.adalbert = new Buildable(g, { spread: 0.5, drop: 2 });
  }
  // Mickiewicz monument
  {
    const g = new THREE.Group();
    g.add(box(0.7, 0.35, 0.7, stone)); g.add(box(0.4, 0.5, 0.4, stone, 0, 0.35, 0));
    g.add(cyl(0.08, 0.12, 0.42, 8, copperDark, 0, 0.85, 0));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), copperDark)).position.set(0, 1.33, 0);
    g.position.set(4.2, 0, -2.6); scene.add(g); M.mick = new Buildable(g, { spread: 0.5, drop: 1 });
  }
  // Florian Gate + city walls + Barbican
  {
    const g = new THREE.Group();
    g.add(box(1.3, 3.2, 1.3, stone, 0, 0, 0));
    g.add(box(1.4, 0.2, 1.4, stone, 0, 3.2, 0));
    g.add(cyl(0.45, 0.6, 0.5, 8, copper, 0, 3.4, 0));
    g.add(cone(0.35, 1.0, 8, copper, 0, 3.9, 0));
    for (const s of [-1, 1]) { g.add(box(5, 1.3, 0.6, brick, s * 3.15, 0, 0)); g.add(box(1.1, 2.2, 1.1, brick, s * 5.8, 0, 0)); g.add(cone(0.85, 0.9, 4, tile, s * 5.8, 2.2, 0, Math.PI / 4)); }
    g.position.copy(P.florian); scene.add(g); M.florian = new Buildable(g, { spread: 0.6, drop: 2 });
    const b = new THREE.Group();
    const ringB = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.5, 1.5, 32, 1, true), brick); ringB.position.y = 0.75; ringB.castShadow = true; b.add(ringB);
    b.add(cyl(2.3, 2.3, 0.05, 32, std(0x8c8574), 0, 0.02, 0));
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; b.add(cyl(0.28, 0.28, 0.6, 8, brick, Math.cos(a) * 2.4, 1.5, Math.sin(a) * 2.4)); b.add(cone(0.33, 0.7, 8, tile, Math.cos(a) * 2.4, 2.1, Math.sin(a) * 2.4)); }
    b.position.copy(P.barbican); scene.add(b); M.barbican = new Buildable(b, { spread: 0.6, drop: 2 });
  }
  // Wawel hill, castle & cathedral
  {
    const g = new THREE.Group();
    const hillGeo = new THREE.CylinderGeometry(1, 1.25, 1, 48, 4);
    const pos = hillGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i); const a = Math.atan2(z, x); const n = 1 + 0.06 * Math.sin(a * 3) + 0.04 * Math.sin(a * 7 + 1); pos.setXYZ(i, x * n * 10, (y + 0.5) * 2.4, z * n * 8.5); }
    hillGeo.computeVertexNormals();
    const hill = new THREE.Mesh(hillGeo, std(0x6f8d4c, { roughness: 1 })); hill.receiveShadow = hill.castShadow = true; hill.userData.noBuild = true; g.add(hill);
    const top = 2.4;
    // defensive walls along the rim
    const wallMat = brick;
    for (let k = 0; k < 28; k++) {
      const a0 = k / 28 * Math.PI * 2, a1 = (k + 1) / 28 * Math.PI * 2;
      const n0 = 1 + 0.06 * Math.sin(a0 * 3) + 0.04 * Math.sin(a0 * 7 + 1);
      const x0 = Math.cos(a0) * 9.6 * n0, z0 = Math.sin(a0) * 8.1 * n0;
      const n1 = 1 + 0.06 * Math.sin(a1 * 3) + 0.04 * Math.sin(a1 * 7 + 1);
      const x1 = Math.cos(a1) * 9.6 * n1, z1 = Math.sin(a1) * 8.1 * n1;
      const w = box(Math.hypot(x1 - x0, z1 - z0) + 0.1, 0.6, 0.35, wallMat, (x0 + x1) / 2, top, (z0 + z1) / 2);
      w.rotation.y = -Math.atan2(z1 - z0, x1 - x0); g.add(w);
      if (k % 4 === 0) { g.add(box(0.8, 1.1, 0.8, brick, x0, top, z0)); g.add(cone(0.65, 0.7, 4, tile, x0, top + 1.1, z0, Math.PI / 4)); }
    }
    // Royal castle quadrangle (east part)
    const cx = 3.0, cz = 1.5, CW = 6.2, CD = 5.6, T = 1.25, CH = 2.0;
    const wing = (x, z, w, d, ridgeAlongX) => {
      g.add(box(w, CH, d, cream, x, top, z));
      const rf = new THREE.Mesh(gableGeo(), tile); rf.scale.set(ridgeAlongX ? w : d, 0.8, ridgeAlongX ? d : w); if (!ridgeAlongX) rf.rotation.y = Math.PI / 2; rf.position.set(x, top + CH, z); rf.castShadow = true; g.add(rf);
      // window rows
      for (let fl = 0; fl < 3; fl++) {
        const n = Math.floor((ridgeAlongX ? w : d) / 0.55);
        for (let i = 0; i < n; i++) {
          const off = -((ridgeAlongX ? w : d) / 2) + 0.3 + i * 0.55;
          for (const s of [-1, 1]) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.32), glass);
            if (ridgeAlongX) { win.position.set(x + off, top + 0.35 + fl * 0.6, z + s * (d / 2 + 0.005)); win.rotation.y = s > 0 ? 0 : Math.PI; }
            else { win.position.set(x + s * (w / 2 + 0.005), top + 0.35 + fl * 0.6, z + off); win.rotation.y = s * Math.PI / 2; }
            g.add(win);
          }
        }
      }
    };
    wing(cx, cz - CD / 2 + T / 2, CW, T, true); wing(cx, cz + CD / 2 - T / 2, CW, T, true);
    wing(cx - CW / 2 + T / 2, cz, T, CD - 2 * T, false); wing(cx + CW / 2 - T / 2, cz, T, CD - 2 * T, false);
    // arcaded courtyard (three tiers)
    for (let fl = 0; fl < 3; fl++) for (let i = 0; i < 9; i++) {
      const ax = cx - CW / 2 + T + 0.15 + i * (CW - 2 * T - 0.3) / 8;
      for (const s of [-1, 1]) g.add(box(0.07, 0.5, 0.07, white, ax, top + fl * 0.62, cz + s * (CD / 2 - T - 0.12)));
    }
    // towers
    g.add(cyl(0.9, 1.0, 3.0, 12, brick, cx + CW / 2 - 0.3, top, cz + CD / 2 + 0.3)); g.add(cone(1.05, 1.3, 12, copper, cx + CW / 2 - 0.3, top + 3.0, cz + CD / 2 + 0.3)); // Sandomierska
    g.add(box(1.1, 3.2, 1.1, brick, cx - CW / 2 + 0.2, top, cz - CD / 2 - 0.2)); g.add(cone(0.8, 1.4, 4, copper, cx - CW / 2 + 0.2, top + 3.2, cz - CD / 2 - 0.2, Math.PI / 4)); // Senatorska
    g.add(box(1.0, 2.8, 1.0, cream, cx + CW / 2 + 0.2, top, cz - CD / 2 + 0.6)); g.add(cone(0.75, 1.2, 4, copper, cx + CW / 2 + 0.2, top + 2.8, cz - CD / 2 + 0.6, Math.PI / 4)); // Duńska
    // Cathedral (north-west), oriented east–west
    const kx = -4.2, kz = -3.6;
    g.add(box(6.2, 2.0, 1.9, stone, kx, top, kz));
    const kr = new THREE.Mesh(gableGeo(), copper); kr.scale.set(6.2, 1.1, 2.0); kr.position.set(kx, top + 2.0, kz); kr.castShadow = true; g.add(kr);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { const w = pointedWindow(0.3, 0.8, stained); w.position.set(kx - 2.4 + i * 1.2, top + 0.6, kz + s * 0.955); w.rotation.y = s > 0 ? 0 : Math.PI; g.add(w); }
    // Sigismund tower & clock tower at the west front
    g.add(box(1.3, 4.0, 1.3, stone, kx - 3.4, top, kz - 0.8)); g.add(cyl(0.45, 0.65, 0.6, 8, copper, kx - 3.4, top + 4.0, kz - 0.8)); g.add(cone(0.4, 1.6, 8, copper, kx - 3.4, top + 4.6, kz - 0.8));
    g.add(box(1.2, 3.4, 1.2, brick, kx - 3.4, top, kz + 1.0)); g.add(cyl(0.4, 0.6, 0.5, 8, copper, kx - 3.4, top + 3.4, kz + 1.0)); const cd = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), copper); cd.position.set(kx - 3.4, top + 3.9, kz + 1.0); g.add(cd); g.add(cone(0.1, 0.9, 8, copper, kx - 3.4, top + 4.25, kz + 1.0));
    // Sigismund Chapel — golden dome — and Vasa chapel on the south side
    g.add(box(1.2, 1.7, 1.2, stone, kx + 0.2, top, kz + 1.5)); g.add(cyl(0.45, 0.5, 0.4, 16, stone, kx + 0.2, top + 1.7, kz + 1.5));
    const gd = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold); gd.position.set(kx + 0.2, top + 2.1, kz + 1.5); gd.castShadow = true; g.add(gd);
    g.add(cyl(0.1, 0.12, 0.3, 8, gold, kx + 0.2, top + 2.6, kz + 1.5));
    g.add(box(1.1, 1.6, 1.1, stone, kx - 1.3, top, kz + 1.45)); const vd = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), slate); vd.position.set(kx - 1.3, top + 1.6, kz + 1.45); g.add(vd);
    g.add(box(1.0, 3.2, 1.0, stone, kx + 2.7, top, kz - 1.2)); g.add(cone(0.45, 1.5, 8, copper, kx + 2.7, top + 3.2, kz - 1.2)); // Silver Bells tower
    // outer courtyard paving
    const pv = cyl(6.5, 6.5, 0.02, 32, std(0xcfc5ae), -1.5, top - 0.0, 2.5); pv.scale.z = 0.6; pv.userData.noBuild = true; g.add(pv);
    // Dragon statue at the foot of the hill by the river
    const dr = new THREE.Group();
    dr.add(box(0.6, 0.2, 0.6, stone)); const body = new THREE.Mesh(new THREE.TorusKnotGeometry(0.18, 0.06, 40, 8), std(0x3d6b3a, { metalness: 0.5, roughness: 0.4 })); body.position.y = 0.55; dr.add(body);
    dr.position.set(-9.0, 0, 6.5); g.add(dr);
    g.position.copy(P.wawel);
    scene.add(g); M.wawel = new Buildable(g, { spread: 0.75, drop: 3 });
    M.wawelTop = top;
  }
  // Kazimierz landmarks
  {
    const g = new THREE.Group();
    // Okrąglak — the round market hall of Plac Nowy
    g.add(cyl(1.3, 1.3, 0.7, 24, std(0xd9b98b), P.placNowy.x - P.kazimierz.x, 0, P.placNowy.z - P.kazimierz.z));
    g.add(cone(1.5, 0.6, 24, tile, P.placNowy.x - P.kazimierz.x, 0.7, P.placNowy.z - P.kazimierz.z));
    // Old Synagogue (Szeroka)
    g.add(box(2.4, 1.3, 1.6, brick, 49 - 33, 0, 95 - 88)); for (let i = 0; i < 9; i++) g.add(box(0.18, 0.3, 0.18, brick, 49 - 33 - 1.1 + i * 0.275, 1.3, 95 - 88 - 0.72));
    // Corpus Christi church
    g.add(box(4.2, 1.9, 1.8, brick, 21.5 - 33, 0, 93.5 - 88)); const cr = new THREE.Mesh(gableGeo(), tile); cr.scale.set(4.2, 1.4, 1.9); cr.position.set(21.5 - 33, 1.9, 93.5 - 88); g.add(cr);
    g.add(box(1.0, 3.6, 1.0, brick, 21.5 - 33 - 2.4, 0, 93.5 - 88)); g.add(cone(0.55, 1.6, 8, copper, 21.5 - 33 - 2.4, 3.6, 93.5 - 88));
    g.position.copy(P.kazimierz); scene.add(g); M.kazimierz = new Buildable(g, { spread: 0.5, drop: 2 });
  }

  // ---------- Trees ----------
  const trees = [];
  for (let i = 0; i < 2600; i++) {
    const a = R() * Math.PI * 2, rr2 = 37.2 + R() * 3.4; trees.push([Math.cos(a) * rr2 * 1.0, 8 + Math.sin(a) * (rr2 + 16.3), 0.6 + R() * 0.35]);
    if (i > 900) break;
  }
  for (let i = 0; i < 350; i++) { const p = river.getPointAt(R()); const tg = river.getTangentAt(clamp(R())); const s = R() < 0.5 ? 1 : -1; const off = 6.6 + R() * 2.4; trees.push([p.x - tg.z * off * s, p.z + tg.x * off * s, 0.5 + R() * 0.4]); }
  for (let i = 0; i < 160; i++) { const a = R() * Math.PI * 2, r3 = Math.sqrt(R()); trees.push([P.wawel.x + Math.cos(a) * r3 * 11, P.wawel.z + Math.sin(a) * r3 * 9.5, 0.5 + R() * 0.3, 1]); }
  for (let i = 0; i < 600; i++) { const ang = R() * Math.PI * 2, r4 = 60 + R() * 110; const x = Math.cos(ang) * r4, z = 20 + Math.sin(ang) * r4; if (riverDist(x, z) > 7) trees.push([x, z, 0.6 + R() * 0.6]); }
  for (let i = 0; i < 120; i++) { trees.push([-95 + (R() - 0.5) * 60, 5 + (R() < 0.5 ? -1 : 1) * (17 + R() * 6), 0.7 + R() * 0.3]); }
  const filteredTrees = trees.filter(([x, z, s, onHill]) => {
    if (onHill) { const dx = (x - P.wawel.x) / 9.6, dz = (z - P.wawel.z) / 8.1; return dx * dx + dz * dz > 1.05; }
    return true;
  });
  const trunkGeo = new THREE.CylinderGeometry(0.05, 0.08, 1, 5).translate(0, 0.5, 0);
  const branchGeo = new THREE.ConeGeometry(0.42, 0.9, 5, 1, true).translate(0, 0.95, 0);
  const crownGeo = new THREE.IcosahedronGeometry(0.55, 1);
  const trunkMat = std(0x5a4636, { roughness: 1 });
  const branchMat = std(0x6b5646, { roughness: 1, wireframe: true });
  const crownMat = std(0xffffff, { roughness: 0.9 });
  const crownUniform = { value: 1 };
  const prevCompile = crownMat.onBeforeCompile;
  crownMat.onBeforeCompile = (sh) => {
    prevCompile(sh);
    sh.uniforms.uGrow = crownUniform;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uGrow;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float dlg = fract(sin(float(gl_InstanceID)*12.9898)*43758.5453);
        float gg = clamp(uGrow*1.7 - dlg*0.7, 0.0, 1.0); gg = gg*gg*(3.0-2.0*gg);
        transformed *= max(gg, 0.0001);`);
  };
  crownMat.customProgramCacheKey = () => 'crown';
  const NT = filteredTrees.length;
  const trunkI = new THREE.InstancedMesh(trunkGeo, trunkMat, NT), branchI = new THREE.InstancedMesh(branchGeo, branchMat, NT), crownI = new THREE.InstancedMesh(crownGeo, crownMat, NT);
  const treeData = filteredTrees.map(([x, z, s, onHill], i) => {
    const y = onHill ? 0 : 0;
    const c = new THREE.Color().setHSL(0.24 + R() * 0.1, 0.45 + R() * 0.2, 0.28 + R() * 0.12);
    if (R() < 0.12) c.set(R() < 0.5 ? '#f3b6c8' : '#f7e8ee');
    crownI.setColorAt(i, c);
    return { x, z, s, y, delay: Math.hypot(x, z) * 0.011 + hash(i * 3.3) * 0.3 };
  });
  trunkI.castShadow = crownI.castShadow = true; crownI.receiveShadow = true;
  trunkI.frustumCulled = branchI.frustumCulled = crownI.frustumCulled = false;
  scene.add(trunkI, branchI, crownI);
  let lastTree = '';
  function setTrees(t0, t) {
    const key = clamp(t - t0, -1, 5).toFixed(3); if (key === lastTree) return; lastTree = key;
    treeData.forEach((d, i) => {
      const l = clamp((t - t0 - d.delay) / 0.5); const s = l <= 0 ? 0.0001 : easeOutBack(l, 2) * d.s;
      tmpQ.identity(); tmpP.set(d.x, d.y, d.z); tmpS.set(s, s * 1.1, s); trunkI.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
      branchI.setMatrixAt(i, tmpM);
      tmpP.set(d.x, d.y + 1.15 * s * 1.1, d.z); tmpS.set(s, s * 1.15, s); crownI.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
    });
    trunkI.instanceMatrix.needsUpdate = branchI.instanceMatrix.needsUpdate = crownI.instanceMatrix.needsUpdate = true;
  }

  // ---------- Street lamps (glows with ignition wave) ----------
  const lampPos = [], lampDelay = [], lampCol = [];
  const addLamp = (x, z, delay) => { lampPos.push(x, 0.35, z); lampDelay.push(delay); const w = 0.85 + R() * 0.15; lampCol.push(1.0 * w, 0.72 * w, 0.4 * w); };
  for (let i = -9; i <= 9; i += 1.5) { addLamp(i, -9.3, 0); addLamp(i, 9.3, 0); addLamp(-9.3, i, 0); addLamp(9.3, i, 0); }
  for (const v of STREETS_X) for (let z = -48; z < 60; z += 2.2) if (inPlanty(v, z)) addLamp(v + 0.55, z, 0);
  for (const v of STREETS_Z) for (let x = -36; x < 36; x += 2.2) if (inPlanty(x, v)) addLamp(x, v + 0.55, 0);
  ringRoad.getSpacedPoints(200).forEach((p) => addLamp(p.x, p.z, 0));
  river.getSpacedPoints(260).forEach((p, i) => { const tg = river.getTangentAt(i / 260); addLamp(p.x - tg.z * 6.6, p.z + tg.x * 6.6, 0); addLamp(p.x + tg.z * 6.6, p.z - tg.x * 6.6, 0); });
  // Kazimierz lamps with ignition order (distance from Plac Nowy)
  const kazStart = lampPos.length / 3;
  for (const v of KAZ_X) for (let z = 66; z < 100; z += 1.6) addLamp(v + 0.5, z, Math.hypot(v - 20, z - 70) * 0.03);
  for (const v of KAZ_Z) for (let x = 12; x < 58; x += 1.6) addLamp(x, v + 0.5, Math.hypot(x - 20, v - 70) * 0.03);
  // string lights over Szeroka & Plac Nowy
  for (let k = 0; k < 6; k++) for (let i = 0; i <= 20; i++) { const x = 46 + i * 0.3, z = 80 + k * 2.2; const sag = Math.sin(i / 20 * Math.PI) * 0.3; lampPos.push(x, 1.2 - sag, z); lampDelay.push(1.4 + i * 0.01 + k * 0.05); const c = [[1, 0.8, 0.4], [1, 0.5, 0.3], [0.9, 0.9, 0.6]][(i + k) % 3]; lampCol.push(...c); }
  for (let k = 0; k < 4; k++) for (let i = 0; i <= 18; i++) { const x = 29 + i * 0.36, z = 83.5 + k * 1.6; lampPos.push(x, 1.1 - Math.sin(i / 18 * Math.PI) * 0.25, z); lampDelay.push(1.2 + i * 0.012); lampCol.push(1, 0.75, 0.45); }
  // outer city scattered lights
  for (let i = 0; i < 1500; i++) { const a = R() * Math.PI * 2, r5 = 48 + R() * 120; const x = Math.cos(a) * r5, z = 15 + Math.sin(a) * r5; if (riverDist(x, z) > 6) addLamp(x, z, 0); }
  const lampGeo = new THREE.BufferGeometry();
  lampGeo.setAttribute('position', new THREE.Float32BufferAttribute(lampPos, 3));
  lampGeo.setAttribute('color', new THREE.Float32BufferAttribute(lampCol, 3));
  lampGeo.setAttribute('delay', new THREE.Float32BufferAttribute(lampDelay, 1));
  const lampMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: glowTex() }, uNight: { value: 0 }, uIgnite: { value: 10 }, uScale: { value: 500 }, uReveal: G.uReveal, uRevealC: G.uRevealC },
    vertexShader: `attribute float delay; varying vec3 vC; varying float vA; uniform float uNight; uniform float uIgnite; uniform float uScale; uniform float uReveal; uniform vec2 uRevealC;
      void main(){ vC=color; float on = smoothstep(delay, delay+0.25, uIgnite); float pop = 1.0 + 1.5*exp(-12.0*max(uIgnite-delay,0.0))*step(delay,uIgnite);
        vA = on*uNight*step(length(position.xz-uRevealC), uReveal); vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = 0.4*pop*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vC*a*vA*1.6, 1.0); }`,
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const lamps = new THREE.Points(lampGeo, lampMat); lamps.frustumCulled = false; scene.add(lamps);

  // ---------- Trams ----------
  const tramBody = std(0x1f3f8f, { roughness: 0.4, metalness: 0.2 });
  const tramWhite = std(0xeef2f6, { roughness: 0.5 });
  const tramWin = new THREE.MeshStandardMaterial({ color: 0x1a2230, emissive: 0xfff0c8, emissiveIntensity: 0, roughness: 0.2 });
  const tramGeo = new THREE.BoxGeometry(1.0, 0.26, 0.25).translate(0, 0.13 + 0.03, 0);
  const tramTopGeo = new THREE.BoxGeometry(0.96, 0.04, 0.22).translate(0, 0.3, 0);
  const tramWinGeo = new THREE.BoxGeometry(0.9, 0.09, 0.255).translate(0, 0.2, 0);
  const tramK = new THREE.CatmullRomCurve3(TRAM_K.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const tramRiver = new THREE.CatmullRomCurve3(river.getSpacedPoints(40).map((p, i) => { const tg = river.getTangentAt(i / 40); return new THREE.Vector3(p.x - tg.z * 8.6, 0, p.z + tg.x * 8.6); }));
  const trams = [];
  const mkTram = (curve, s0, speed, loop) => {
    const segs = [];
    for (let k = 0; k < 3; k++) { const g = new THREE.Group(); const b = new THREE.Mesh(tramGeo, tramBody); const tp = new THREE.Mesh(tramTopGeo, tramWhite); const w = new THREE.Mesh(tramWinGeo, tramWin); b.castShadow = true; g.add(b, tp, w); scene.add(g); segs.push(g); }
    trams.push({ curve, s0, speed, loop, segs, L: curve.getLength() });
  };
  for (let i = 0; i < 7; i++) mkTram(ringRoad, i / 7, 3.2 * (i % 2 ? 1 : -1), true);
  for (let i = 0; i < 3; i++) mkTram(tramK, i / 3, 2.6, false);
  for (let i = 0; i < 2; i++) mkTram(tramRiver, i / 2, 3.0, false);
  const tv = new THREE.Vector3(), tv2 = new THREE.Vector3();
  function setTrams(t) {
    for (const tr of trams) {
      for (let k = 0; k < 3; k++) {
        let u = tr.s0 + (tr.speed * t - k * 1.05) / tr.L;
        if (tr.loop) u = ((u % 1) + 1) % 1; else { u = ((u % 2) + 2) % 2; if (u > 1) u = 2 - u; u = clamp(u, 0.001, 0.999); }
        tr.curve.getPointAt(u, tv); tr.curve.getTangentAt(u, tv2);
        tr.segs[k].position.set(tv.x + tv2.z * 0.18, 0, tv.z - tv2.x * 0.18);
        tr.segs[k].rotation.y = Math.atan2(-tv2.z, tv2.x);
      }
    }
  }

  // ---------- People (instanced) ----------
  const people = [];
  const addWalkers = (n, x0, x1, z0, z1, pal) => { for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2; people.push({ x: lerp(x0, x1, R()), z: lerp(z0, z1, R()), dx: Math.cos(a), dz: Math.sin(a), sp: 0.25 + R() * 0.35, rng: 1.5 + R() * 4, ph: R() * 10, c: pal[Math.floor(R() * pal.length)] }); } };
  const CLOTHES = ['#d94f4f', '#2f5fa8', '#f2c14e', '#3b8f6a', '#f0f0f0', '#262626', '#8c4fb3', '#e98a3b', '#4fb3c9', '#b33b5a'];
  addWalkers(210, -9.5, 9.5, -9.5, 9.5, CLOTHES);
  addWalkers(90, -0.6, 0.6, -42, -11, CLOTHES); addWalkers(90, -0.6, 0.6, 11, 62, CLOTHES);
  addWalkers(160, 46.3, 51.7, 79.5, 92, CLOTHES); addWalkers(90, 29.2, 35.2, 83.2, 89.2, CLOTHES);
  for (const v of KAZ_X) addWalkers(18, v - 0.4, v + 0.4, 67, 99, CLOTHES);
  river.getSpacedPoints(80).forEach((p, i) => { const tg = river.getTangentAt(i / 80); for (let k = 0; k < 3; k++) people.push({ x: p.x - tg.z * 6.2, z: p.z + tg.x * 6.2, dx: tg.x, dz: tg.z, sp: 0.3, rng: 3, ph: R() * 10, c: CLOTHES[Math.floor(R() * 10)] }); });
  const personGeo = new THREE.CapsuleGeometry(0.032, 0.1, 2, 6).translate(0, 0.082, 0);
  const personMat = std(0xffffff, { roughness: 0.7, patch: { snow: false } });
  const peopleI = new THREE.InstancedMesh(personGeo, personMat, people.length);
  people.forEach((p, i) => peopleI.setColorAt(i, col.set(p.c)));
  peopleI.castShadow = true; peopleI.frustumCulled = false; scene.add(peopleI);
  const avoid = (x, z) => (Math.abs(x - P.cloth.x) < 1.9 && Math.abs(z - P.cloth.z) < 5.8);
  function setPeople(t, vis) {
    people.forEach((p, i) => {
      let s = Math.sin((t * p.sp) / p.rng * 2 + p.ph) * p.rng;
      let x = p.x + p.dx * s, z = p.z + p.dz * s;
      if (avoid(x, z)) x += x > P.cloth.x ? 1.4 : -1.4;
      tmpQ.identity(); tmpP.set(x, Math.abs(Math.sin(t * 9 + p.ph)) * 0.015, z); const k = vis; tmpS.set(k, k, k);
      peopleI.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
    });
    peopleI.instanceMatrix.needsUpdate = true;
  }

  // ---------- The two travelers ----------
  const travelers = new THREE.Group();
  const mkTraveler = (c, pack) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.16, 3, 10), std(c, { roughness: 0.5, patch: { snow: false } })); b.position.y = 0.16; b.castShadow = true; g.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), std(0xf1c7a5, { patch: { snow: false } })); h.position.y = 0.35; h.castShadow = true; g.add(h);
    const bp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.06), std(pack, { patch: { snow: false } })); bp.position.set(0, 0.2, -0.07); g.add(bp);
    return g;
  };
  const t1 = mkTraveler(0xff5a4e, 0x223344), t2 = mkTraveler(0x22c1b5, 0x553322);
  t2.position.x = 0.2; travelers.add(t1, t2);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 40), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.set(0.1, 0.02, 0); travelers.add(halo);
  travelers.scale.setScalar(1.6);
  scene.add(travelers);

  // ---------- Terraces & umbrellas, flower stalls (spring) ----------
  const umbPos = [];
  for (let i = -8; i <= 8; i += 1.15) { umbPos.push([i, -8.6], [i, 8.6]); if (Math.abs(i) < 6.5) { umbPos.push([-8.6, i], [8.6, i]); } }
  for (let i = 0; i < 14; i++) umbPos.push([46.8 + (i % 2) * 4.4, 81 + Math.floor(i / 2) * 1.6]);
  for (let i = 0; i < 8; i++) umbPos.push([29.6 + (i % 4) * 1.8, i < 4 ? 83.6 : 88.8]);
  const umbGeo = new THREE.ConeGeometry(0.36, 0.14, 8).translate(0, 0.42, 0);
  const poleGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 4).translate(0, 0.21, 0);
  const umbMat = std(0xffffff, { roughness: 0.8 });
  const umbI = new THREE.InstancedMesh(umbGeo, umbMat, umbPos.length), poleI = new THREE.InstancedMesh(poleGeo, std(0x444444), umbPos.length);
  const UMB = ['#f4efe2', '#c8352f', '#efe3c6', '#2c5d43', '#f4efe2'];
  umbPos.forEach((p, i) => umbI.setColorAt(i, col.set(UMB[i % UMB.length])));
  umbI.castShadow = true; umbI.frustumCulled = poleI.frustumCulled = false; scene.add(umbI, poleI);
  function setUmbrellas(k) {
    umbPos.forEach(([x, z], i) => { const l = clamp(k * 1.6 - hash(i) * 0.6); const s = l <= 0 ? 0.0001 : easeOutBack(l, 2.5); tmpQ.identity(); tmpP.set(x, 0, z); tmpS.set(s, s, s); umbI.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS)); poleI.setMatrixAt(i, tmpM); });
    umbI.instanceMatrix.needsUpdate = poleI.instanceMatrix.needsUpdate = true;
  }
  const flowers = new THREE.Group();
  for (let i = 0; i < 8; i++) { const z = -4 + i * 1.1; const st = box(0.5, 0.18, 0.7, std(['#e8435a', '#f7d046', '#f08ac0', '#ffffff', '#ff7a2f', '#a066ff'][i % 6], { roughness: 0.9 }), -3.4, 0, z); flowers.add(st); }
  scene.add(flowers);

  // ---------- Boats ----------
  const boats = [];
  for (let i = 0; i < 4; i++) { const b = new THREE.Group(); b.add(box(1.4, 0.18, 0.4, std(0xf0f0f0))); b.add(box(0.7, 0.18, 0.32, std(0x22305a), -0.1, 0.18, 0)); const w = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.33), tramWin); w.position.set(-0.1, 0.3, 0); b.add(w); scene.add(b); boats.push({ g: b, u0: 0.3 + i * 0.08, sp: (i % 2 ? 1 : -1) * 0.0018, off: (i % 2 ? 2.2 : -2.2) }); }
  function setBoats(t) { for (const b of boats) { let u = ((b.u0 + b.sp * t) % 1 + 1) % 1; river.getPointAt(u, tv); river.getTangentAt(u, tv2); b.g.position.set(tv.x - tv2.z * b.off, 0.03, tv.z + tv2.x * b.off); b.g.rotation.y = Math.atan2(-tv2.z, tv2.x) + (b.sp < 0 ? Math.PI : 0); } }

  // ---------- Pigeons ----------
  const NP = 70;
  const pigeonI = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.06, 0).scale(1.6, 0.4, 0.8), std(0x6d6d78, { patch: { snow: false, reveal: false } }), NP);
  pigeonI.frustumCulled = false; scene.add(pigeonI);
  function setPigeons(t, t0) {
    for (let i = 0; i < NP; i++) {
      const h = hash(i * 7.1), h2 = hash(i * 3.7), h3 = hash(i * 1.3);
      const bx = -3 + h * 6 + 2.0, bz = -4 + h2 * 8;
      const k = clamp((t - t0 - h3 * 0.3) / 2.5);
      const a = h * 6.28 + k * 3.0;
      const r = k * (2 + h2 * 3);
      tmpQ.setFromAxisAngle(yAxis, -a); tmpP.set(bx + Math.cos(a) * r, 0.05 + easeOut(k) * (3 + h3 * 3), bz + Math.sin(a) * r);
      const flap = k > 0 && k < 1 ? 0.6 + 0.4 * Math.abs(Math.sin(t * 30 + i)) : 1;
      const vis = k < 1 ? 1 : 0.0001;
      tmpS.set(vis, vis * flap, vis);
      pigeonI.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
    }
    pigeonI.instanceMatrix.needsUpdate = true;
  }

  // ---------- Volumetric floodlight beams (finale) ----------
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uO: { value: 0 }, uCol: { value: new THREE.Color(1.0, 0.85, 0.6) } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 w = modelMatrix*vec4(position,1.); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uO; uniform vec3 uCol; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(vN,vV)), 1.5); float a = pow(1.0-vUv.y, 1.6)*e*uO; gl_FragColor = vec4(uCol*a*0.6, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beams = new THREE.Group();
  const beamGeo = new THREE.CylinderGeometry(0.15, 1.6, 22, 24, 1, true).translate(0, 11, 0);
  [[P.mary.x - 1.5, P.mary.z - 1, 0.1], [P.mary.x - 1.5, P.mary.z + 1, -0.1], [P.townhall.x, P.townhall.z, 0.08], [P.wawel.x - 7, P.wawel.z - 4, 0.15], [P.wawel.x + 3, P.wawel.z + 4, -0.12], [P.cloth.x, P.cloth.z - 5, 0.2], [P.cloth.x, P.cloth.z + 5, -0.2], [P.florian.x, P.florian.z, 0], [P.barbican.x, P.barbican.z, 0.1], [P.kazimierz.x - 11, P.kazimierz.z + 5, 0.1], [P.szeroka.x, P.szeroka.z + 8, -0.1]].forEach(([x, z, tilt], i) => {
    const b = new THREE.Mesh(beamGeo, beamMat); b.position.set(x, 0, z); b.rotation.z = tilt; b.rotation.x = (i % 2 ? 1 : -1) * 0.12; beams.add(b);
  });
  beams.visible = false; scene.add(beams);

  // ---------- Particles: eruption dust ring, snow, fireworks ----------
  const dustN = 1500; const dustP = [], dustC = [], dustS = [];
  for (let i = 0; i < dustN; i++) { dustP.push(0, 0, 0); const w = 0.6 + R() * 0.4; dustC.push(0.6 * w, 0.85 * w, 1.0 * w); dustS.push(0.5 + R() * 1.5); }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustP, 3)); dustGeo.setAttribute('color', new THREE.Float32BufferAttribute(dustC, 3)); dustGeo.setAttribute('size', new THREE.Float32BufferAttribute(dustS, 1));
  const dustSeeds = Array.from({ length: dustN }, () => [R() * Math.PI * 2, R(), R(), R()]);
  const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    uniforms: { map: { value: glowTex() }, uO: { value: 1 }, uScale: { value: 500 } },
    vertexShader: `attribute float size; varying vec3 vC; uniform float uScale; void main(){ vC=color; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = size*uScale*0.25/max(0.1,-mv.z); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D map; uniform float uO; varying vec3 vC; void main(){ gl_FragColor = vec4(vC*texture2D(map, gl_PointCoord).a*uO, 1.0); }`,
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  dust.frustumCulled = false; scene.add(dust);
  function setDust(revealR, o) {
    const a = dustGeo.attributes.position.array;
    for (let i = 0; i < dustN; i++) { const [ang, r1, r2, r3] = dustSeeds[i]; const rr3 = revealR - r1 * 4; a[i * 3] = Math.cos(ang) * rr3; a[i * 3 + 1] = r2 * r2 * 4 * (1 - r1) + 0.1; a[i * 3 + 2] = Math.sin(ang) * rr3; }
    dustGeo.attributes.position.needsUpdate = true; dust.material.uniforms.uO.value = o;
  }
  // snow: positions animated in shader (deterministic in time)
  const snowN = 9000, sp2 = [], sc2 = [], ss2 = [];
  for (let i = 0; i < snowN; i++) { sp2.push((R() - 0.5) * 90, R() * 30, (R() - 0.5) * 90); sc2.push(1, 1, 1); ss2.push(0.4 + R() * 0.8); }
  const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp2, 3)); snowGeo.setAttribute('color', new THREE.Float32BufferAttribute(sc2, 3)); snowGeo.setAttribute('size', new THREE.Float32BufferAttribute(ss2, 1));
  const snowMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: glowTex() }, uO: { value: 0 }, uT: G.uTime, uC: { value: new THREE.Vector3() }, uScale: { value: 500 } },
    vertexShader: `attribute float size; uniform float uT; uniform vec3 uC; uniform float uScale; void main(){ vec3 p = position; p.y = mod(p.y - uT*1.6*size, 30.0); p.x += sin(uT*0.7 + position.z)*0.8; p.x = uC.x + mod(p.x - uC.x + 45.0, 90.0) - 45.0; p.z = uC.z + mod(p.z - uC.z + 45.0, 90.0) - 45.0; vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = size*uScale*0.3/max(0.1,-mv.z); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D map; uniform float uO; void main(){ gl_FragColor = vec4(vec3(1.0)*texture2D(map, gl_PointCoord).a*uO, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const snow = new THREE.Points(snowGeo, snowMat); snow.frustumCulled = false; scene.add(snow);
  // fireworks
  const FW = 8, FWP = 260, fwPos = new Float32Array(FW * FWP * 3), fwCol = [], fwSize = [];
  const fwSeeds = [];
  for (let f = 0; f < FW; f++) { const hue = [0.02, 0.12, 0.55, 0.83, 0.3, 0.08, 0.6, 0.95][f]; const c = new THREE.Color().setHSL(hue, 0.9, 0.6); for (let i = 0; i < FWP; i++) { fwCol.push(c.r, c.g, c.b); fwSize.push(0.8 + R()); const th = Math.acos(2 * R() - 1), ph = R() * Math.PI * 2; fwSeeds.push([Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph), 0.8 + R() * 0.3]); } }
  const fwGeo = new THREE.BufferGeometry(); fwGeo.setAttribute('position', new THREE.BufferAttribute(fwPos, 3)); fwGeo.setAttribute('color', new THREE.Float32BufferAttribute(fwCol, 3)); fwGeo.setAttribute('size', new THREE.Float32BufferAttribute(fwSize, 1));
  const fwMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: glowTex() }, uScale: { value: 500 } },
    vertexShader: `attribute float size; varying vec3 vC; uniform float uScale; void main(){ vC=color; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = size*uScale*0.5/max(0.1,-mv.z); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec3 vC; void main(){ gl_FragColor = vec4(vC*texture2D(map, gl_PointCoord).a*2.0, 1.0); }`,
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const fireworks = new THREE.Points(fwGeo, fwMat); fireworks.frustumCulled = false; fireworks.visible = false; scene.add(fireworks);
  const FW_SPOTS = [[-4, 76, 66.3], [10, 0, 66.9], [-20, 40, 67.6], [30, 88, 68.2], [-4, 76, 69.0], [0, -45, 69.8], [20, 30, 70.6], [-4, 70, 71.6]];
  function setFireworks(t, on) {
    fireworks.visible = on; if (!on) return;
    for (let f = 0; f < FW; f++) {
      const [x, z, t0] = FW_SPOTS[f]; const k = t - t0;
      for (let i = 0; i < FWP; i++) {
        const j = (f * FWP + i), [dx, dy, dz, sp] = fwSeeds[j];
        if (k < 0 || k > 2.4) { fwPos[j * 3 + 1] = -100; continue; }
        const r = easeOut(clamp(k / 1.4)) * 7 * sp;
        fwPos[j * 3] = x + dx * r; fwPos[j * 3 + 1] = 22 + dy * r - k * k * 1.2; fwPos[j * 3 + 2] = z + dz * r;
      }
    }
    fwGeo.attributes.position.needsUpdate = true;
    const k0 = FW_SPOTS.map(([, , t0]) => clamp(1 - Math.abs(t - t0 - 0.9) / 1.5));
    
    fireworks.material.opacity = Math.max(...k0);
  }

  // ---------- Sky dome ----------
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uStars: { value: 0 } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uBot; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uStars; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
      void main(){ float y = vD.y; vec3 c = y > 0.0 ? mix(uHor, uTop, pow(clamp(y,0.,1.), 0.55)) : mix(uHor, uBot, clamp(-y*4.0,0.,1.));
        float s = max(dot(normalize(vD), normalize(uSun)), 0.0); c += uSunCol * (pow(s, 600.0)*6.0 + pow(s, 12.0)*0.35);
        vec3 q = floor(vD*420.0); float st = step(0.9975, h(q)) * uStars * smoothstep(0.05, 0.4, y); c += vec3(st);
        gl_FragColor = vec4(c, 1.0); }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat); sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);

  // ---------- Lights ----------
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a60, 1.0); scene.add(hemi);
  scene.fog = new THREE.FogExp2(0xcfdbe6, 0.004);

  const state = { monuments: M, houseMeshes };

  function setLighting(L, focus, radius) {
    sun.color.copy(L.sunCol); sun.intensity = L.sunI;
    const sd = L.sunDir.clone().normalize();
    sun.position.copy(focus).addScaledVector(sd, 120); sun.target.position.copy(focus);
    const r = radius; const cam = sun.shadow.camera; cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.near = 1; cam.far = 300; cam.updateProjectionMatrix();
    hemi.color.copy(L.hemiSky); hemi.groundColor.copy(L.hemiGround); hemi.intensity = L.hemiI;
    scene.fog.color.copy(L.fog); scene.fog.density = L.fogD * clamp(55 / Math.max(radius, 1), 0.18, 1.3);
    skyMat.uniforms.uTop.value.copy(L.skyTop); skyMat.uniforms.uHor.value.copy(L.skyHor); skyMat.uniforms.uBot.value.copy(L.fog);
    skyMat.uniforms.uSun.value.copy(sd); skyMat.uniforms.uSunCol.value.copy(L.sunCol).multiplyScalar(Math.min(1, L.sunI / 3)); skyMat.uniforms.uStars.value = L.night;
    waterMat.uniforms.uSkyTop.value.copy(L.skyTop); waterMat.uniforms.uSkyHor.value.copy(L.skyHor); waterMat.uniforms.uSun.value.copy(sd); waterMat.uniforms.uSunCol.value.copy(L.sunCol).multiplyScalar(Math.min(1, L.sunI / 3)); waterMat.uniforms.uNight.value = L.night;
    waterMat.uniforms.fogColor.value.copy(L.fog); waterMat.uniforms.fogDensity.value = scene.fog.density;
    const n = L.night;
    houseMatOld.emissiveIntensity = houseMatMod.emissiveIntensity = n * 1.25;
    glass.emissiveIntensity = n * 0.7; stained.emissiveIntensity = n * 1.4 + L.flood * 0.6; tramWin.emissiveIntensity = n * 1.5;
    lampMat.uniforms.uNight.value = n;
    for (const m of floodMats) { m.emissive.copy(m.color); m.emissiveIntensity = L.flood * 0.42; }
    gold.emissiveIntensity = 0.25 + L.flood * 1.2;
    murals.children.forEach((m) => { m.material.emissiveIntensity = n * 0.35; });
  }

  return {
    scene, P, M, state, sky, sun, travelers, streetLines, lineMat, lampMat, beams, beamMat, flowers, snowMat, crownUniform,
    setHouses, setTrees, setTrams, setPeople, setUmbrellas, setBoats, setPigeons, setDust, setFireworks, setLighting,
    tramMeshes: trams, dust, fireworks,
  };
}

// Street grid constants (centre lines)
const STREETS_X = [-36.3, -26.8, -17.9, -13.7, 0, 13.7, 17.9, 26.8, 36.3];
const STREETS_Z = [-46.1, -32.7, -23.2, -13.7, 13.7, 23.2, 32.7, 42.2, 51.7, 61.2];
const KAZ_X = [12.5, 20, 28, 36, 44, 46, 52, 57.5];
const KAZ_Z = [66.5, 72, 78, 84, 90, 94, 99.5];
const TRAM_K = [[14, 63.5], [16, 70], [20.5, 76], [24, 82], [24, 90], [24.5, 98], [27, 104], [31, 112], [36, 125]];
