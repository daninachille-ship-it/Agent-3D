// Shared helpers: deterministic randomness, easing, keyframed paths, shader patches.
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (a, b, x) => { const t = inv(a, b, x); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;
export const easeOutExpo = (t) => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
export const easeInExpo = (t) => t <= 0 ? 0 : Math.pow(2, 10 * t - 10);
export const easeOutBack = (t, s = 1.70158) => { const c3 = s + 1; return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
export const easeOutElastic = (t) => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
export const bump = (a, b, x, fadeIn = 0.3, fadeOut = 0.3) => smooth(a, a + fadeIn, x) * (1 - smooth(b - fadeOut, b, x));

// Mulberry32 deterministic PRNG
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// Time-aware cubic Hermite through keyframes {t, v:[...]} -> array (C1 continuous velocity).
export function hermite(keys, t) {
  const n = keys.length;
  if (t <= keys[0].t) return keys[0].v.slice();
  if (t >= keys[n - 1].t) return keys[n - 1].v.slice();
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[i], k1 = keys[i + 1];
  const h = k1.t - k0.t;
  const s = (t - k0.t) / h;
  const tan = (j) => {
    if (keys[j].hold || j === 0 || j === n - 1) return keys[j].v.map(() => 0);
    const a = keys[j - 1], b = keys[j + 1];
    return keys[j].v.map((_, c) => (b.v[c] - a.v[c]) / (b.t - a.t));
  };
  const m0 = tan(i), m1 = tan(i + 1);
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  return k0.v.map((v0, c) => h00 * v0 + h10 * h * m0[c] + h01 * k1.v[c] + h11 * h * m1[c]);
}

// Global shader uniforms shared by every patched material.
export const G = {
  uSnow: { value: 0 },
  uReveal: { value: 1e5 },
  uRevealC: { value: new THREE.Vector2(0, 0) },
  uRevealGlow: { value: new THREE.Color(0.35, 0.85, 1.0) },
  uTime: { value: 0 },
  uSpring: { value: 1 },
};

// Patch a standard material: snow on up-facing surfaces + radial "living map" reveal with glowing front.
export function patch(mat, { snow = true, reveal = true } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, G);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wpX = vec4(transformed, 1.0);
        vec3 wnX = objectNormal;
        #ifdef USE_INSTANCING
          wpX = instanceMatrix * wpX; wnX = mat3(instanceMatrix) * wnX;
        #endif
        wpX = modelMatrix * wpX; vWP = wpX.xyz; vWN = normalize((vec4(transformedNormal, 0.0) * viewMatrix).xyz);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP; varying vec3 vWN;
        uniform float uSnow; uniform float uReveal; uniform vec2 uRevealC; uniform vec3 uRevealGlow;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${reveal ? 'float rd = length(vWP.xz - uRevealC); if (rd > uReveal) discard;' : ''}
        ${snow ? `float sn = uSnow * smoothstep(0.35, 0.85, vWN.y) * (0.75 + 0.25 * fract(sin(dot(floor(vWP.xz*6.0), vec2(12.9898,78.233)))*43758.5453));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 1.0), clamp(sn, 0.0, 1.0));` : ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        ${reveal ? 'float rim = smoothstep(2.5, 0.0, uReveal - length(vWP.xz - uRevealC)); totalEmissiveRadiance += rim * uRevealGlow * 4.0;' : ''}`);
  };
  mat.customProgramCacheKey = () => `p${snow ? 1 : 0}${reveal ? 1 : 0}`;
  return mat;
}

export function std(color, opts = {}) {
  const { patch: po, ...rest } = opts;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.0, ...rest });
  return patch(m, po || {});
}

export function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// Soft round sprite used for lights, particles, glows.
let _glow = null;
export function glowTex() {
  if (_glow) return _glow;
  _glow = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.18, 'rgba(255,255,255,0.75)');
    gr.addColorStop(0.45, 'rgba(255,255,255,0.18)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  return _glow;
}

// Points cloud with per-point color & size, additive glow.
export function glowPoints(positions, colors, sizes, { size = 1, opacity = 1, depthWrite = false } = {}) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: glowTex() }, uScale: { value: 400 }, uOpacity: { value: opacity }, uSize: { value: size } },
    vertexShader: `attribute float size; varying vec3 vC; uniform float uScale; uniform float uSize;
      void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = size * uSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform float uOpacity; varying vec3 vC;
      void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.a * uOpacity, 1.0); }`,
    vertexColors: true, transparent: true, depthWrite, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  return p;
}

export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Gabled roof prism: width along x, depth z, ridge along x.
export function gableGeo() {
  const g = new THREE.BufferGeometry();
  const v = [
    // front slope (z+)
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0,
    // back slope (z-)
    0.5, 0, -0.5, -0.5, 0, -0.5, -0.5, 1, 0, 0.5, 0, -0.5, -0.5, 1, 0, 0.5, 1, 0,
    // gable left (x-)
    -0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 1, 0,
    // gable right (x+)
    0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 1, 0,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

// Pyramid / spire helpers
export function cone(r, h, seg, mat, x = 0, y = 0, z = 0, rot = 0) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat);
  m.position.set(x, y + h / 2, z); m.rotation.y = rot;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
export function cyl(rt, rb, h, seg, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Build animation helper: registers meshes of a group with per-part delays (bottom-up),
// and shows a glowing blueprint (edges) ghost before materialising.
export class Buildable {
  constructor(group, { spread = 0.6, drop = 3, blueprintColor = 0x66ddff } = {}) {
    this.group = group;
    this.parts = [];
    const bb = new THREE.Box3().setFromObject(group);
    const hgt = Math.max(0.01, bb.max.y - bb.min.y);
    const r = rng(group.id * 13 + 7);
    group.updateMatrixWorld(true);
    const edgeMat = new THREE.LineBasicMaterial({ color: blueprintColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.edgeMat = edgeMat;
    this.edges = new THREE.Group();
    group.traverse((o) => {
      if (!o.isMesh || o.userData.noBuild) return;
      const wp = new THREE.Vector3(); o.getWorldPosition(wp);
      const d = clamp((wp.y - bb.min.y) / hgt) * spread + r() * 0.08;
      this.parts.push({ o, pos: o.position.clone(), scale: o.scale.clone(), d, drop: drop * (0.6 + r() * 0.8) });
      if (o.geometry.attributes.position.count < 3000) {
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), edgeMat);
        e.position.copy(o.position); e.rotation.copy(o.rotation); e.scale.copy(o.scale);
        o.parent.add(e);
        e.userData.isEdge = true;
      }
    });
    this.spread = spread;
  }
  // ghost: 0..1 blueprint visibility, p: 0..1 materialisation
  set(p, ghost = 0) {
    for (const q of this.parts) {
      const l = clamp((p - q.d) / (1 - this.spread + 0.001));
      const s = l <= 0 ? 0.0001 : easeOutBack(l, 2.2);
      q.o.visible = l > 0;
      q.o.scale.set(q.scale.x * Math.max(0.0001, Math.min(s, 1.15) ), q.scale.y * Math.max(0.0001, s), q.scale.z * Math.max(0.0001, Math.min(s, 1.15)));
      q.o.position.set(q.pos.x, q.pos.y - (1 - easeOut(l)) * q.drop, q.pos.z);
    }
    this.edgeMat.opacity = ghost * (1 - smooth(0.5, 1.0, p) * 0.85);
    this.group.visible = p > 0 || ghost > 0.001;
  }
}
