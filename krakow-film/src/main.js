// Director: shots, camera paths, lighting, transitions, post-processing and typography.
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { G as GG, hermite, clamp, lerp, smooth, inv, bump, easeInOut, easeOut, easeIn, easeOutBack, easeOutExpo, hash, glowTex, canvasTex, rng } from './util.js';
import { buildEarth } from './earth.js';
import { buildCity, P } from './city.js';
import { buildGallery, buildMap, buildWieliczka, buildMemorial } from './dioramas.js';
import { SEGMENTS, IMPACTS, TABLEAUX, DURATION } from './timeline.js';
import { buildPhotos, PLATES } from './photos.js';

const G = GG; window.__G = GG;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export async function createFilm({ canvas, width, height, world, topojson, overlay, style = 'photo' }) {
  const PHOTO = style === 'photo';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;

  // ---------- worlds ----------
  let _t = performance.now(); const lap = (n) => { const x = performance.now(); console.log(`[t] ${n} ${(x - _t).toFixed(0)}ms`); _t = x; };
  const earth = buildEarth(world, topojson); lap('earth');
  const photos = PHOTO ? buildPhotos() : null; if (photos) { await photos.ready; lap('photos'); }
  const city = PHOTO ? null : buildCity(); lap('city');
  const gallery = PHOTO ? null : buildGallery(); lap('gallery');
  const map = buildMap(world, topojson); lap('map');
  const wiel = PHOTO ? null : buildWieliczka(); lap('wieliczka');
  const memo = PHOTO ? null : buildMemorial(); lap('memorial');

  const camA = new THREE.PerspectiveCamera(40, width / height, 0.1, 2000);
  const camB = new THREE.PerspectiveCamera(40, width / height, 0.1, 2000);

  // ---------- intro clouds in the city sky ----------
  const cloudTex = canvasTex(256, 256, (g, w, h) => {
    const r = rng(4);
    for (let i = 0; i < 22; i++) { const x = w * (0.2 + r() * 0.6), y = h * (0.35 + r() * 0.3), rad = 30 + r() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  });
  const clouds = new THREE.Group();
  { const r = rng(12); for (let i = 0; i < 46; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.7, fog: false })); const u = r(); s.position.set(lerp(-10, 80, u) + (r() - 0.5) * 120, lerp(230, 80, u) + (r() - 0.5) * 30, lerp(160, 110, u) + (r() - 0.5) * 120); s.scale.setScalar(60 + r() * 80); clouds.add(s); } }
  if (city) city.scene.add(clouds);

  // ---------- lighting presets ----------
  const C = (h) => new THREE.Color(h);
  const PRE = {
    day: { sunDir: V(-0.45, 0.78, 0.5), sunCol: C('#fff1dc'), sunI: 3.0, hemiSky: C('#bcd6ff'), hemiGround: C('#8a7a62'), hemiI: 1.15, skyTop: C('#2f6fd0'), skyHor: C('#cfe3f5'), fog: C('#d3e2ee'), fogD: 0.0032, night: 0, flood: 0, exposure: 1.0, bloom: 0.32 },
    golden: { sunDir: V(-0.78, 0.33, 0.5), sunCol: C('#ffc27a'), sunI: 3.3, hemiSky: C('#ffd9b5'), hemiGround: C('#6b5a48'), hemiI: 0.9, skyTop: C('#4a76c4'), skyHor: C('#ffc890'), fog: C('#efc6a0'), fogD: 0.0038, night: 0, flood: 0.1, exposure: 1.05, bloom: 0.45 },
    sunset: { sunDir: V(-0.85, 0.11, 0.45), sunCol: C('#ff7a3c'), sunI: 2.4, hemiSky: C('#c890a0'), hemiGround: C('#4a3a3a'), hemiI: 0.75, skyTop: C('#2c3f7a'), skyHor: C('#ff8656'), fog: C('#c27866'), fogD: 0.0045, night: 0.35, flood: 0.3, exposure: 1.1, bloom: 0.6 },
    bluehour: { sunDir: V(-0.9, 0.04, 0.4), sunCol: C('#7a8cff'), sunI: 0.6, hemiSky: C('#5070c0'), hemiGround: C('#202030'), hemiI: 0.95, skyTop: C('#0f1a44'), skyHor: C('#3a4f9a'), fog: C('#2a3466'), fogD: 0.0048, night: 0.85, flood: 0.75, exposure: 1.15, bloom: 0.8 },
    night: { sunDir: V(0.3, 0.6, -0.5), sunCol: C('#8fa8ff'), sunI: 0.8, hemiSky: C('#3a4f96'), hemiGround: C('#1c1c2a'), hemiI: 1.1, skyTop: C('#040920'), skyHor: C('#1a2550'), fog: C('#121a3a'), fogD: 0.0042, night: 1, flood: 0.85, exposure: 1.15, bloom: 0.95 },
    winter: { sunDir: V(-0.3, 0.45, 0.6), sunCol: C('#e8eef5'), sunI: 1.3, hemiSky: C('#c8d4e4'), hemiGround: C('#8a8f99'), hemiI: 1.35, skyTop: C('#8193ab'), skyHor: C('#c9d2dc'), fog: C('#c3ccd6'), fogD: 0.0055, night: 0.2, flood: 0, exposure: 1.0, bloom: 0.3 },
    spring: { sunDir: V(-0.55, 0.55, 0.55), sunCol: C('#fff0d0'), sunI: 3.2, hemiSky: C('#c4dcff'), hemiGround: C('#8a7a5a'), hemiI: 1.1, skyTop: C('#3a86e0'), skyHor: C('#d8ecff'), fog: C('#d9e8f4'), fogD: 0.003, night: 0, flood: 0, exposure: 1.05, bloom: 0.38 },
    finale: { sunDir: V(0.3, 0.6, -0.5), sunCol: C('#8fa8ff'), sunI: 0.8, hemiSky: C('#3a4f96'), hemiGround: C('#1c1c2a'), hemiI: 1.05, skyTop: C('#030716'), skyHor: C('#24306a'), fog: C('#101838'), fogD: 0.0028, night: 1, flood: 1.8, exposure: 1.2, bloom: 1.25 },
  };
  const LIGHT_KEYS = [[0, 'day'], [16, 'day'], [19.4, 'golden'], [21.2, 'sunset'], [22.8, 'bluehour'], [24.4, 'night'], [54, 'night'], [55.2, 'winter'], [57.6, 'winter'], [60.4, 'spring'], [64.3, 'spring'], [64.9, 'sunset'], [65.35, 'night'], [65.5, 'finale'], [76, 'finale']];
  const LT = Object.fromEntries(Object.keys(PRE.day).map((k) => [k, PRE.day[k].clone ? PRE.day[k].clone() : PRE.day[k]]));
  function lightingAt(t) {
    let i = 0; while (i < LIGHT_KEYS.length - 2 && t > LIGHT_KEYS[i + 1][0]) i++;
    const [ta, a] = LIGHT_KEYS[i], [tb, b] = LIGHT_KEYS[i + 1];
    const f = easeInOut(clamp((t - ta) / (tb - ta)));
    const A = PRE[a], B = PRE[b];
    for (const k in A) { if (A[k].isColor) LT[k].copy(A[k]).lerp(B[k], f); else if (A[k].isVector3) LT[k].copy(A[k]).lerp(B[k], f); else LT[k] = lerp(A[k], B[k], f); }
    return LT;
  }

  // ---------- camera paths ----------
  const K = (t, p, l, fov = 40) => ({ t, v: [...p, ...l, fov] });
  const PATHS = {
    old: [
      K(4.85, [10, 270, 175], [0, 0, 18], 38),
      K(6.0, [85, 120, 125], [0, 0, 12], 38),
      K(7.2, [100, 58, 40], [0, 0, 6], 36),
      K(8.3, [48, 24, -24], [1, 0, 0], 36),
      K(9.1, [21, 8.5, 15], [0, 1, 0], 40),
      K(10.0, [1.5, 3.4, -2.5], [9, 3.2, -6.5], 44),
      K(10.8, [5.4, 1.1, -5.8], [8.8, 7.2, -7.4], 62),
      K(11.6, [1.0, 6.5, -13], [-0.5, 1, -2], 42),
      K(12.6, [-4.6, 1.5, -4.2], [-0.6, 0.9, 3.5], 46),
      K(13.4, [-10, 4.2, 2.0], [-5.2, 3.2, 6.8], 42),
      K(14.2, [-2.4, 1.2, 9.6], [3.5, 1.0, 6.5], 48),
      K(15.0, [3.3, 1.1, 3.6], [3.8, 1.0, -3.5], 50),
      K(15.8, [1.6, 1.5, -4.6], [-1.5, 1.4, -10], 50),
      K(16.8, [-7, 15, -22], [0, 0, 12], 42),
      K(17.6, [-12, 22, 32], [-3, 2, 64], 40),
      K(18.6, [14, 13, 63], [-4, 3, 76], 42),
      K(20.4, [9, 8, 93], [-4, 3, 76], 42),
    ],
    kaz: [
      K(19.55, [10, 9, 64], [22, 1, 78], 44),
      K(20.6, [15, 5.5, 69], [24, 1, 80], 44),
      K(21.6, [20, 2.6, 76], [21, 0.8, 86], 46),
      K(22.5, [24, 3.0, 84.2], [32, 0.5, 86], 46),
      K(23.2, [36.4, 4.2, 82.2], [32, 0.6, 86], 44),
      K(23.9, [37.0, 4.4, 90.4], [32, 0.6, 86], 44),
      K(24.6, [42.5, 4.4, 80.0], [49, 0.6, 86], 46),
      K(25.6, [49, 3.4, 79.6], [49, 0.6, 93], 46),
      K(26.5, [53, 10, 100], [40, 0, 104], 44),
      K(27.6, [30, 6, 108], [0, 1, 96], 42),
      K(28.7, [7, 4, 101], [-4, 3, 76], 44),
      K(30.25, [-19, 9, 93], [-4, 3, 74], 44),
    ],
    map1: [
      K(42.7, [-20, 95, 75], [0, 0, 0], 40),
      K(43.6, [-6, 55, 50], [3, 0, 3], 40),
      K(44.4, [6, 22, 26], [9, 0, 8], 42),
      K(45.15, [9, 4, 12], [9.1, 0, 8.2], 50),
    ],
    wieliczka: [
      K(44.7, [-1, 21, 10], [-1, 12, -3], 44),
      K(45.6, [-1, 16, 5], [-1, 10, -3], 46),
      K(46.4, [0, 8.0, -0.5], [0, 4.5, -4], 52),
      K(47.1, [0, 2.6, -0.5], [0, 2.4, 6], 56),
      K(48.3, [0.9, 2.0, 4.6], [0, 2.4, 13], 56),
      K(49.6, [-1.2, 3.1, 9.0], [0, 2.0, 13], 54),
    ],
    map2: [
      K(49.1, [-4, 70, 55], [-18, 0, 2], 40),
      K(50.9, [-34, 45, 30], [-48, 0, -2], 40),
    ],
    memorial: [
      K(50.2, [0, 1.7, 48], [0, 3.2, 0], 38),
      K(55.5, [0, 2.3, 24], [0, 4.2, 0], 38),
    ],
    late: [
      K(54.6, [36, 13, 40], [0, 1, 2], 40),
      K(57.0, [44, 11, 6], [0, 1.5, 0], 40),
      K(59.5, [30, 9, -32], [0, 1.5, 0], 40),
      K(62.0, [-12, 8, -40], [0, 1.5, 0], 40),
      K(64.0, [-38, 10, -6], [0, 1.5, 2], 40),
      K(65.4, [-34, 16, 24], [-1, 2, 8], 40),
      K(67.2, [-10, 34, 58], [-2, 0, 22], 40),
      K(69.4, [52, 60, 70], [-2, 0, 26], 40),
      K(71.6, [92, 82, -10], [-2, 0, 24], 40),
      K(73.6, [30, 110, -78], [-2, 0, 22], 40),
      K(75.01, [-28, 130, -92], [-2, 0, 22], 40),
    ],
  };
  // Seq 6: true 360° orbit around the square (overrides keys between 55.5 and 64.6 with a circular path)
  function lateCam(t) {
    if (t < 64.2) {
      const u = clamp((t - 54.6) / (64.2 - 54.6));
      const a = 0.85 + easeInOut(u) * Math.PI * 1.65;
      const r = lerp(52, 40, u), h = lerp(14, 8, u);
      return [Math.cos(a) * r, h, Math.sin(a) * r * 0.95 + 4, 0, 1.4, 2, 40];
    }
    const base = hermite(PATHS.late, t);
    if (t < 65.4) { const u = (t - 64.2) / 1.2; const a = 0.85 + Math.PI * 1.65; const s = [Math.cos(a) * 40, 8, Math.sin(a) * 40 * 0.95 + 4, 0, 1.4, 2, 40]; return s.map((v, i) => lerp(v, base[i], easeInOut(u))); }
    return base;
  }

  function galleryCam(t) {
    // which tableau
    let i = 0; while (i < TABLEAUX.length - 1 && t >= TABLEAUX[i + 1] - 0.3) i++;
    const t0 = TABLEAUX[i], t1 = i < TABLEAUX.length - 1 ? TABLEAUX[i + 1] : 43.2;
    // whip: between (next-0.3) and next+0.05 the camera slides from i to i+1
    let idx = i;
    if (i > 0) { const w = clamp((t - (t0 - 0.3)) / 0.35); idx = i - 1 + easeInOut(w); }
    const u = clamp((t - t0) / (t1 - t0));
    const S = gallery.spacing;
    const styles = [
      { a0: -0.6, a1: 0.5, r: 6.5, h: 6.0, ly: 0.2 }, // pierogi: top-down-ish
      { a0: 0.9, a1: 0.1, r: 9, h: 3.4, ly: 1.0 },
      { a0: -0.3, a1: 0.6, r: 8.5, h: 3.8, ly: 0.8 },
      { a0: 0.7, a1: -0.2, r: 8, h: 3.2, ly: 1.1 },
      { a0: -0.5, a1: 0.5, r: 8.5, h: 2.6, ly: 1.2 },
      { a0: 0.6, a1: -0.4, r: 9, h: 3.0, ly: 0.8 },
    ];
    const st = styles[i];
    const a = lerp(st.a0, st.a1, easeOut(u));
    const cx = idx * S;
    const r = st.r * lerp(1.15, 0.92, easeOut(u));
    return { pos: [cx + Math.sin(a) * r, st.h, Math.cos(a) * r], look: [cx, st.ly, 0], fov: 40, idx, whip: (i > 0 ? bump(t0 - 0.3, t0 + 0.05, t, 0.15, 0.15) : 0) };
  }

  function applyCam(cam, v, shake = 0, t = 0) {
    cam.position.set(v[0], v[1], v[2]);
    if (shake > 0) cam.position.add(V(Math.sin(t * 91) * shake, Math.sin(t * 73 + 1) * shake, Math.cos(t * 87) * shake));
    cam.up.set(0, 1, 0);
    cam.lookAt(v[3], v[4], v[5]);
    cam.fov = v[6]; cam.near = 0.05; cam.far = 2500; cam.aspect = width / height;
    cam.updateProjectionMatrix();
  }

  const impactEnv = (t) => { let e = 0; for (const im of IMPACTS) { const d = t - im.t; if (d >= 0 && d < 0.6) e = Math.max(e, im.k * Math.exp(-d * 9)); } return e; };

  // ---------- per-world update ----------
  function updateCity(t) {
    const L = lightingAt(t);
    G.uTime.value = t;
    // living-map reveal & eruption
    const rev = t < 5.0 ? 0 : 3 + easeOut(clamp((t - 5.0) / 2.6)) * 260;
    G.uReveal.value = t > 9 ? 1e5 : rev;
    city.lineMat.uniforms.uO.value = bump(5.0, 9.5, t, 0.3, 1.5) * 0.9;
    city.setDust(rev, bump(5.0, 7.6, t, 0.1, 1.2));
    city.setHouses(5.3, t);
    city.setTrees(5.5, t);
    const M = city.M;
    const ghost = smooth(5.6, 6.6, t);
    M.mary.set(clamp((t - 9.55) / 0.9), ghost);
    M.cloth.set(clamp((t - 11.05) / 0.9), ghost);
    M.townhall.set(clamp((t - 12.55) / 0.9), ghost);
    M.adalbert.set(clamp((t - 12.85) / 0.8), ghost);
    M.mick.set(clamp((t - 13.1) / 0.6), ghost);
    M.wawel.set(clamp((t - 17.5) / 1.3), ghost);
    M.florian.set(clamp((t - 6.0) / 1.0), 0);
    M.barbican.set(clamp((t - 6.1) / 1.0), 0);
    M.kazimierz.set(clamp((t - 6.3) / 1.0), 0);
    city.setTrams(t);
    city.setPeople(t, t < 7.5 ? 0.0001 : Math.max(0.0001, easeOutBack(clamp((t - 7.5) / 0.6))));
    city.setBoats(t);
    city.setPigeons(t, 8.7);
    // season (seq 6)
    const snow = t < 54.6 ? 0 : 1 - smooth(57.4, 60.4, t);
    G.uSnow.value = snow;
    city.snowMat.uniforms.uO.value = t > 54.6 && t < 59.5 ? (1 - smooth(57.8, 59.5, t)) * 0.9 : 0;
    city.crownUniform.value = t < 54.6 ? 1 : smooth(59.0, 62.6, t);
    city.setUmbrellas(t < 54.6 ? 1 : clamp((t - 60.8) / 1.8));
    city.flowers.visible = t < 54.6 || t > 61.2;
    // lamps ignition (Kazimierz wave) & finale beams
    city.lampMat.uniforms.uIgnite.value = t < 20.5 ? -1 : t < 31 ? t - 21.2 : 10;
    city.beams.visible = t > 65.4;
    city.beamMat.uniforms.uO.value = smooth(65.45, 65.9, t) * (0.9 + 0.1 * Math.sin(t * 6));
    city.setFireworks(t, t > 66 && t < 75);
    clouds.visible = false;
    clouds.children.forEach((c) => { c.material.opacity = 0.7 * (1 - smooth(5.1, 5.6, t)); });
    // travelers
    const tr = city.travelers;
    tr.visible = (t > 8 && t < 30) || (t > 55 && t < 65);
    if (t < 19.5) { const u = (t - 8) * 0.25; tr.position.set(4.6 - u * 0.6, 0, -3.6 + u * 0.4); tr.rotation.y = -0.5; }
    else if (t < 30) { const u = (t - 21) * 0.35; tr.position.set(30.4 + u * 0.4, 0, 84.9 + Math.sin(u) * 0.2); tr.rotation.y = Math.PI / 2 - 0.2; }
    else { tr.position.set(-3.0, 0, 6.5); tr.rotation.y = 0.8; }
    city.state.flood = L.flood;
    return L;
  }

  // ---------- post-processing ----------
  const rtOpts = { type: THREE.HalfFloatType, samples: 4 };
  const rtA = new THREE.WebGLRenderTarget(width, height, rtOpts);
  const rtB = new THREE.WebGLRenderTarget(width, height, rtOpts);
  const rtMix = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType });
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.5, 0.55, 0.82);
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)); return s; };
  const mixMat = new THREE.ShaderMaterial({
    uniforms: { tA: { value: rtA.texture }, tB: { value: rtB.texture }, uMix: { value: 0 }, uMode: { value: 0 }, uTime: { value: 0 }, uAspect: { value: width / height } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `uniform sampler2D tA; uniform sampler2D tB; uniform float uMix; uniform int uMode; uniform float uTime; uniform float uAspect; varying vec2 vUv;
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x), mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
      vec2 swirl(vec2 uv, float k){ vec2 c = uv - .5; c.x *= uAspect; float r = length(c); float a = k * (1.0 - smoothstep(0., .9, r)) * 6.0; float s = sin(a), co = cos(a); c = mat2(co,-s,s,co)*c; c.x /= uAspect; return c + .5; }
      vec4 zoomBlur(sampler2D t, vec2 uv, float k){ vec4 acc = vec4(0.); vec2 d = (uv - .5); for(int i=0;i<12;i++){ float f = 1.0 - k * float(i)/12.0 * 0.35; acc += texture2D(t, .5 + d*f); } return acc/12.0; }
      vec4 dirBlur(sampler2D t, vec2 uv, float k){ vec4 acc = vec4(0.); for(int i=0;i<12;i++){ acc += texture2D(t, uv + vec2((float(i)/11.0-.5)*k, 0.)); } return acc/12.0; }
      void main(){
        float m = uMix; vec4 c;
        if (uMode == 0) { c = mix(texture2D(tA, vUv), texture2D(tB, vUv), smoothstep(0.,1.,m)); }
        else if (uMode == 1) { vec4 a = zoomBlur(tA, vUv, m*2.0); vec4 b = zoomBlur(tB, vUv, (1.-m)*1.5); c = mix(a, b, step(.5, m)); c += vec4(vec3(1.0,0.97,0.9) * pow(1.0 - abs(m - .5)*2.0, 2.0) * 6.0, 0.); }
        else if (uMode == 2) { float n = fbm(vUv*vec2(uAspect,1.)*3.0 + uTime*.3); float th = smoothstep(m - .15, m + .15, n * .9 + .05); vec4 a = texture2D(tA, swirl(vUv, m*1.2)); vec4 b = texture2D(tB, swirl(vUv, -(1.-m)*1.2)); c = mix(b, a, th); float edge = 1.0 - abs(th - .5)*2.0; c.rgb += vec3(1.0,0.6,0.3) * pow(edge, 6.0) * 3.0 * (1.0 - abs(m-.5)*2.0); }
        else if (uMode == 3) { float e = sin(m*3.14159); vec4 a = dirBlur(tA, vUv + vec2(m*.6, 0.), e*.25); vec4 b = dirBlur(tB, vUv - vec2((1.-m)*.6, 0.), e*.25); c = mix(a, b, smoothstep(.35,.65,m)); }
        else if (uMode == 4) { float a = smoothstep(0., .5, m), b = smoothstep(.5, 1., m); c = mix(texture2D(tA, vUv)*(1.-a), texture2D(tB, vUv)*b, step(.5, m)); }
        else { vec4 a = zoomBlur(tA, vUv, m*2.5); vec4 b = zoomBlur(tB, vUv, (1.-m)*2.5); c = mix(a, b, smoothstep(.3,.7,m)); c.rgb += vec3(0.6,0.9,1.0)*pow(1.0-abs(m-.5)*2.0, 3.0)*1.5; }
        gl_FragColor = c;
      }`,
    depthTest: false, depthWrite: false,
  });
  const mixScene = quad(mixMat);
  const gradeMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: rtMix.texture }, uRes: { value: new THREE.Vector2(width, height) }, uExposure: { value: 1 }, uSat: { value: 1.1 }, uTilt: { value: 0.6 }, uFocus: { value: 0.5 }, uVig: { value: 0.35 }, uFlash: { value: 0 }, uChroma: { value: 0 }, uTime: { value: 0 }, uWhip: { value: 0 }, uFade: { value: 1 }, uContrast: { value: 1.06 }, uTint: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `uniform sampler2D tSrc; uniform vec2 uRes; uniform float uExposure, uSat, uTilt, uFocus, uVig, uFlash, uChroma, uTime, uWhip, uFade, uContrast; uniform vec3 uTint; varying vec2 vUv;
      vec3 aces(vec3 x){ const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0., 1.); }
      vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1./2.4)) - 0.055, step(0.0031308, c)); }
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec2 uv = vUv;
        float blur = uTilt * pow(clamp(abs(uv.y - uFocus) * 2.2 - 0.25, 0., 1.), 1.4);
        vec3 col = vec3(0.); float tw = 0.;
        vec2 px = 1.0 / uRes;
        float rad = blur * 9.0;
        for (int i = 0; i < 16; i++) {
          float fi = float(i); float a = fi * 2.39996; float r = sqrt(fi / 16.0) * rad;
          vec2 o = vec2(cos(a), sin(a)) * r * px + vec2((fi/15.0 - .5) * uWhip * 0.06, 0.);
          vec2 cuv = uv + o;
          vec3 s;
          if (uChroma > 0.001) { vec2 d = (cuv - .5) * uChroma * 0.012; s = vec3(texture2D(tSrc, cuv + d).r, texture2D(tSrc, cuv).g, texture2D(tSrc, cuv - d).b); }
          else s = texture2D(tSrc, cuv).rgb;
          col += s; tw += 1.0;
        }
        col /= tw;
        col *= uExposure * uTint;
        col = aces(col);
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(l), col, uSat);
        col = (col - 0.5) * uContrast + 0.5;
        vec2 vc = uv - .5; vc.x *= uRes.x / uRes.y;
        col *= 1.0 - uVig * smoothstep(0.35, 1.1, length(vc));
        col = clamp(col, 0., 1.);
        col = toSRGB(col);
        col += (hsh(uv * uRes + fract(uTime * 13.7)) - 0.5) * 0.025;
        col = mix(col, vec3(1.0), uFlash);
        col *= uFade;
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const gradeScene = quad(gradeMat);

  // ---------- shots ----------
  function shot(name, t, cam) {
    const out = { scene: null, tilt: 0.55, sat: 1.12, vig: 0.38, focus: 0.5, exposure: 1, bloom: 0.4, whip: 0, tint: [1, 1, 1], contrast: 1.06 };
    const sh = impactEnv(t) * 0.25;
    if (PHOTO && PLATES[name]) {
      const r = photos.update(name, t, width / height);
      out.scene = r.scene; out.camera = r.cam;
      out.exposure = 0.92; out.bloom = 0.3; out.tilt = name === 'memorial' ? 0 : 0.28; out.focus = 0.5; out.sat = 1.08; out.vig = 0.42; out.contrast = 1.1;
      if (name === 'gallery') { let w = 0; for (const tb of TABLEAUX.slice(1)) w = Math.max(w, bump(tb - 0.18, tb + 0.12, t, 0.1, 0.1)); out.whip = w; }
      if (name === 'memorial') { out.sat = 0.15; out.bloom = 0.1; out.vig = 0.55; out.contrast = 1.02; }
      if (name === 'late' && t > 65.4) { out.bloom = 0.55; out.sat = 1.15; }
      return out;
    }
    if (name === 'earth') {
      earth.update(t, cam); out.scene = earth.scene; out.tilt = 0; out.bloom = 0.9; out.exposure = 1.1; out.vig = 0.5;
    } else if (name === 'old' || name === 'kaz' || name === 'late') {
      const L = updateCity(t);
      const v = name === 'late' ? lateCam(t) : hermite(PATHS[name], t);
      // dolly-zoom (vertigo) on St Mary's tower
      if (name === 'old' && t > 10.0 && t < 11.0) { const u = inv(10.0, 11.0, t); v[6] = lerp(44, 64, Math.sin(u * Math.PI)); }
      applyCam(cam, v, sh * (name === 'old' && t < 9 ? 3 : 1), t);
      const target = V(v[3], v[4], v[5]);
      const dist = cam.position.distanceTo(target);
      city.setLighting(L, target, clamp(dist * 0.9, 14, 170));
      if (t < 7.2) { const k = 1 - smooth(5.9, 7.2, t); const su = city.sky.material.uniforms; const navy = new THREE.Color('#081428'); su.uBot.value.lerp(navy, k); su.uHor.value.lerp(navy, k); su.uTop.value.lerp(navy, k); }
      city.lampMat.uniforms.uScale.value = height * 0.6;
      out.scene = city.scene; out.exposure = L.exposure; out.bloom = L.bloom; out.sat = 1.02;
      city.snowMat.uniforms.uC.value.copy(target); city.snowMat.uniforms.uScale.value = height; city.dust.material.uniforms.uScale.value = height * 1.4; city.fireworks.material.uniforms.uScale.value = height * 2.6;
      out.tilt = clamp(0.95 - dist / 400, 0.3, 0.85);
      out.focus = 0.52;
      if (name === 'late' && t > 65) out.sat = 1.12;
    } else if (name === 'gallery') {
      const g = galleryCam(t);
      gallery.update(t, g.idx);
      applyCam(cam, [...g.pos, ...g.look, g.fov], sh * 0.3, t);
      out.scene = gallery.scene; out.whip = g.whip; out.tilt = 0.75; out.bloom = 0.45; out.exposure = 0.95; out.vig = 0.5; out.focus = 0.55;
    } else if (name === 'map1' || name === 'map2') {
      const s = name === 'map1' ? { l1: inv(43.15, 44.3, t), l2: 0, pinW: inv(43.9, 44.5, t), pinO: 0 } : { l1: 1, l2: inv(49.35, 50.3, t), pinW: 1, pinO: inv(50.0, 50.5, t) };
      map.update(t, s);
      applyCam(cam, hermite(PATHS[name], t), 0, t);
      out.scene = map.scene; out.tilt = 0.6; out.bloom = name === 'map1' ? 1.0 : 0.6; out.sat = name === 'map2' ? 0.6 : 1.15;
    } else if (name === 'wieliczka') {
      wiel.update(t, inv(46.9, 48.1, t));
      applyCam(cam, hermite(PATHS.wieliczka, t), sh * 0.2, t);
      out.scene = wiel.scene; out.tilt = 0.45; out.bloom = 0.6; out.exposure = 0.82; out.vig = 0.55; out.sat = 0.95;
    } else if (name === 'memorial') {
      memo.update(t);
      applyCam(cam, hermite(PATHS.memorial, t), 0, t);
      out.scene = memo.scene; out.tilt = 0.25; out.bloom = 0.25; out.sat = 0.12; out.vig = 0.55; out.exposure = 0.95; out.contrast = 1.02;
    }
    return out;
  }

  // ---------- typography / overlay ----------
  const ov = overlay;
  ov.innerHTML = `
    <div id="hud"><div class="hud-day"><span class="hud-k">JOUR</span><span class="hud-n">1</span><span class="hud-of">/ 7</span></div><div class="hud-sub"></div><div class="hud-dots">${'<i></i>'.repeat(7)}</div></div>
    <div id="label"><div class="lab-k"></div><div class="lab-n"></div><div class="lab-s"></div></div>
    <div id="title"><div class="t-main"></div><div class="t-sub"><span class="ln"></span><span class="tx"></span><span class="ln"></span></div></div>
    <div id="final"><div class="f1"></div><div class="f2"><span></span><span></span><span></span></div><div class="f3"></div></div>
    <div id="memo"><div class="m1">AUSCHWITZ-BIRKENAU</div><div class="m2">Mémorial et Musée &nbsp;·&nbsp; Patrimoine mondial de l’UNESCO</div><div class="m3">Un lieu de mémoire. À visiter avec respect.</div></div>
    <div id="march"><div class="mk">MARS À CRACOVIE</div><div class="mt"><span class="from">−2°C</span><span class="arrow"></span><span class="to">12°C</span></div><div class="ms">Moins de monde &nbsp;·&nbsp; lumière dorée &nbsp;·&nbsp; premières terrasses</div></div>
    <div id="bars"></div>`;
  const $ = (s) => ov.querySelector(s);
  const hud = $('#hud'), hudN = $('.hud-n'), hudSub = $('.hud-sub'), dots = [...ov.querySelectorAll('.hud-dots i')];
  const lab = $('#label'), labK = $('.lab-k'), labN = $('.lab-n'), labS = $('.lab-s');
  const title = $('#title'), tMain = $('.t-main'), tSub = $('.t-sub'), tSubTx = $('.t-sub .tx');
  const fin = $('#final'), f1 = $('.f1'), f2 = [...ov.querySelectorAll('.f2 span')], f3 = $('.f3');
  const memoEl = $('#memo'), marchEl = $('#march');
  tMain.innerHTML = 'CRACOVIE'.split('').map((c) => `<span>${c}</span>`).join('');
  tSubTx.textContent = '7 JOURS – 2 VOYAGEURS';
  f1.innerHTML = 'CRACOVIE <em>–</em> POLOGNE'; f2[0].textContent = '7 JOURS.'; f2[1].textContent = '2 VOYAGEURS.'; f2[2].textContent = 'D’INNOMBRABLES EXPÉRIENCES.';
  f3.innerHTML = "PARTONS EXPLORER&nbsp;!";
  const DAYS = [[8.3, 17.2, 1, 'Vieille ville'], [17.2, 20.0, 2, 'Wawel'], [20.0, 30.0, 3, 'Kazimierz & la Vistule'], [30.0, 43.0, 4, 'Saveurs & culture'], [43.0, 49.3, 5, 'Wieliczka'], [49.3, 55.0, 6, 'Auschwitz-Birkenau'], [55.0, 65.2, 7, 'Mars à Cracovie']];
  const LABELS = [
    [8.6, 9.9, 'JOUR 1 · VIEILLE VILLE', 'Rynek Główny', 'La place du Marché, cœur de la Cracovie médiévale'],
    [10.0, 11.4, 'JOUR 1 · VIEILLE VILLE', 'Basilique Sainte-Marie', 'Bazylika Mariacka — le hejnał y retentit toutes les heures'],
    [11.5, 12.9, 'JOUR 1 · VIEILLE VILLE', 'La Halle aux Draps', 'Sukiennice — halle marchande Renaissance'],
    [13.0, 14.3, 'JOUR 1 · VIEILLE VILLE', 'Tour de l’Hôtel de Ville', 'Wieża Ratuszowa'],
    [14.5, 16.8, 'UNESCO · 1978', 'Centre historique', 'L’un des tout premiers sites du patrimoine mondial'],
    [18.0, 20.0, 'JOUR 2 · LA COLLINE ROYALE', 'Château du Wawel', 'Zamek Królewski et la cathédrale royale'],
    [20.8, 26.0, 'JOUR 3 · KAZIMIERZ', 'Kazimierz', 'Cafés · street art · bars en caves · une âme unique'],
    [26.6, 29.7, 'JOUR 3 · AU FIL DE L’EAU', 'Les berges de la Vistule', 'Bulwary Wiślane — le Wawel illuminé'],
    [45.3, 49.0, 'JOUR 5 · EXCURSION · 14 KM', 'Mines de sel de Wieliczka', 'Chapelle Sainte-Cunégonde — sculptée dans le sel, à 101 m sous terre'],
  ];
  const TAB_LABELS = [['SAVEURS', 'Pierogi & cuisine polonaise'], ['CAFÉS', 'Kawiarnie & obwarzanki'], ['SHOPPING', 'Ambre & artisanat aux Sukiennice'], ['MUSÉES', 'Patrimoine & trésors royaux'], ['VIE NOCTURNE', 'Bars voûtés en caves'], ['BALADES', 'Chaque rue, une nouvelle histoire']];

  const setO = (el, o, tf = '') => { el.style.opacity = o.toFixed(3); el.style.transform = tf; el.style.visibility = o > 0.001 ? 'visible' : 'hidden'; };
  function updateOverlay(t) {
    // HUD
    const d = DAYS.find(([a, b]) => t >= a && t < b);
    const hudO = d ? bump(DAYS[0][0], 65.2, t, 0.4, 0.4) : 0;
    setO(hud, hudO, `translateX(${(1 - smooth(8.3, 8.8, t)) * -40}px)`);
    if (d) {
      hudN.textContent = d[2]; hudSub.textContent = d[3];
      const pop = 1 + 0.25 * Math.exp(-(t - d[0]) * 8);
      hudN.style.transform = `scale(${pop.toFixed(3)})`;
      dots.forEach((el, i) => el.className = i < d[2] ? 'on' : '');
    }
    // lower-left labels
    let L = LABELS.find(([a, b]) => t >= a && t < b);
    let tabLabel = null;
    if (t >= 30.2 && t < 42.8) { let i = 0; while (i < TABLEAUX.length - 1 && t >= TABLEAUX[i + 1]) i++; const a = Math.max(TABLEAUX[i] + 0.15, 30.3), b = (i < TABLEAUX.length - 1 ? TABLEAUX[i + 1] : 42.9) - 0.25; tabLabel = [a, b, `JOUR 4 · ${TAB_LABELS[i][0]}`, TAB_LABELS[i][1], '']; }
    L = L || tabLabel;
    if (L) {
      const [a, b, k, n, s] = L;
      const o = bump(a, b, t, 0.25, 0.25);
      labK.textContent = k; labN.textContent = n; labS.textContent = s;
      const enter = easeOutExpo(clamp((t - a) / 0.6));
      setO(lab, o, `translateY(${(1 - enter) * 30}px)`);
      labN.style.letterSpacing = `${lerp(0.25, 0.0, enter).toFixed(3)}em`;
      labN.style.clipPath = `inset(0 ${((1 - enter) * 100).toFixed(1)}% 0 0)`;
    } else setO(lab, 0);
    // intro title
    const tO = bump(5.85, 8.1, t, 0.05, 0.5);
    setO(title, tO);
    if (tO > 0) {
      [...tMain.children].forEach((sp, i) => {
        const k = clamp((t - 5.88 - i * 0.045) / 0.45);
        const e = easeOutBack(k, 2.0);
        sp.style.opacity = clamp(k * 3).toFixed(3);
        sp.style.transform = `translateY(${((1 - e) * 120).toFixed(1)}px) scale(${lerp(2.2, 1, easeOut(k)).toFixed(3)})`;
        sp.style.filter = `blur(${((1 - k) * 18).toFixed(1)}px)`;
      });
      tMain.style.letterSpacing = `${lerp(0.22, 0.06, easeOut(clamp((t - 5.9) / 2.2))).toFixed(3)}em`;
      const s = clamp((t - 6.7) / 0.5);
      tSub.style.opacity = s.toFixed(3);
      tSub.style.letterSpacing = `${lerp(0.9, 0.42, easeOutExpo(s)).toFixed(3)}em`;
      title.style.transform = `scale(${lerp(1.0, 1.06, clamp((t - 6) / 2.1)).toFixed(4)})`;
    }
    // memorial captions
    setO(memoEl, bump(51.2, 54.5, t, 0.8, 0.6));
    memoEl.querySelector('.m3').style.opacity = smooth(52.4, 53.2, t).toFixed(3);
    // March caption
    const mO = bump(55.8, 63.8, t, 0.5, 0.5);
    setO(marchEl, mO);
    if (mO > 0) {
      const tmp = Math.round(lerp(-2, 12, smooth(56.5, 61.5, t)));
      marchEl.querySelector('.from').textContent = `${tmp < 0 ? '−' : ''}${Math.abs(tmp)} °C`;
      marchEl.querySelector('.from').style.color = tmp < 4 ? '#bfe3ff' : '#ffe0a0';
      marchEl.querySelector('.to').style.opacity = 0;
      marchEl.querySelector('.ms').style.opacity = smooth(59.5, 60.3, t).toFixed(3);
      marchEl.querySelector('.mk').style.letterSpacing = `${lerp(0.6, 0.3, easeOutExpo(clamp((t - 55.8) / 1.2))).toFixed(3)}em`;
    }
    // finale typography
    const fO = bump(65.9, 76, t, 0.05, 0.1);
    setO(fin, fO);
    if (fO > 0) {
      const k1 = clamp((t - 66.0) / 0.6);
      f1.style.opacity = (clamp(k1 * 2) * (1 - smooth(71.4, 71.9, t))).toFixed(3);
      f1.style.letterSpacing = `${lerp(0.8, 0.18, easeOutExpo(k1)).toFixed(3)}em`;
      f1.style.filter = `blur(${((1 - k1) * 14).toFixed(1)}px)`;
      [68.5, 69.5, 70.5].forEach((ts, i) => { const k = clamp((t - ts) / 0.4); f2[i].style.opacity = (k * (1 - smooth(71.4, 71.9, t))).toFixed(3); f2[i].style.transform = `translateY(${((1 - easeOutBack(k, 2.5)) * 50).toFixed(1)}px) scale(${lerp(1.6, 1, easeOutExpo(k)).toFixed(3)})`; });
      const k3 = clamp((t - 72.0) / 0.5);
      f3.style.opacity = k3.toFixed(3);
      f3.style.transform = `scale(${(lerp(2.6, 1, easeOutExpo(k3)) * lerp(1, 1.05, clamp((t - 72.5) / 2.5))).toFixed(3)})`;
      f3.style.filter = `blur(${((1 - k3) * 20).toFixed(1)}px)`;
    }
  }

  // ---------- render ----------
  function renderShot(name, t, cam, rt) {
    const o = shot(name, t, cam);
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(o.scene, o.camera || cam);
    return o;
  }
  function renderAt(t) {
    t = clamp(t, 0, DURATION);
    const seg = SEGMENTS.find((s) => t >= s.t0 && t < s.t1) || SEGMENTS[SEGMENTS.length - 1];
    let o;
    if (seg.shot) {
      o = renderShot(seg.shot, t, camA, rtA); mixMat.uniforms.uMix.value = 0; mixMat.uniforms.uMode.value = 0;
    } else {
      const m = (t - seg.t0) / (seg.t1 - seg.t0);
      const oa = renderShot(seg.from, t, camA, rtA);
      const ob = renderShot(seg.to, t, camB, rtB);
      o = {}; for (const k in oa) o[k] = typeof oa[k] === 'number' && typeof ob[k] === 'number' ? lerp(oa[k], ob[k], m) : (m < 0.5 ? oa[k] : ob[k]);
      mixMat.uniforms.uMix.value = m; mixMat.uniforms.uMode.value = seg.mode;
    }
    mixMat.uniforms.uTime.value = t;
    renderer.setRenderTarget(rtMix); renderer.render(mixScene, fsCam);
    bloom.strength = o.bloom; bloom.radius = 0.6; bloom.threshold = 0.95;
    bloom.render(renderer, null, rtMix, 0, false);
    const imp = impactEnv(t);
    const U = gradeMat.uniforms;
    U.uExposure.value = o.exposure * (1 + imp * 0.25); U.uSat.value = o.sat; U.uTilt.value = o.tilt; U.uFocus.value = o.focus; U.uVig.value = o.vig;
    U.uFlash.value = imp * 0.22 + (t < 0.6 ? 0 : 0); U.uChroma.value = imp * 2.0 + o.whip * 3; U.uWhip.value = o.whip; U.uTime.value = t; U.uContrast.value = o.contrast;
    U.uTint.value.setRGB(...o.tint);
    U.uFade.value = smooth(0, 0.6, t) * (1 - smooth(74.3, 75, t));
    renderer.setRenderTarget(null); renderer.render(gradeScene, fsCam);
    updateOverlay(t);
  }

  function resize(w, h) {
    width = w; height = h;
    renderer.setSize(w, h, false);
    for (const rt of [rtA, rtB, rtMix]) rt.setSize(w, h);
    bloom.setSize(w, h);
    gradeMat.uniforms.uRes.value.set(w, h); mixMat.uniforms.uAspect.value = w / h;
  }
  // warm-up: compile all programs by rendering each shot once
  async function warmup() {
    for (const t of [1, 6, 12, 22, 31, 33, 35, 37, 39, 41, 44, 47, 50, 52, 58, 68]) { const a = performance.now(); renderAt(t); renderer.getContext().finish(); console.log(`[t] warm ${t} ${(performance.now() - a).toFixed(0)}ms`); }
  }
  return { renderAt, resize, warmup, renderer, duration: DURATION };
}
