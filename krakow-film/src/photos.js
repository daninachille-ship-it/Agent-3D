// "Blueprint to reality" photo plates: each real photograph first draws itself as glowing architect lines
// on a navy blueprint, then fills in with the real image, with Ken Burns camera moves.
import * as THREE from 'three';
import { clamp, smooth, lerp, easeInOut, easeOut, inv } from './util.js';

// Each plate: key, start/end time, Ken Burns (zoom, centre x/y in 0..1, rotation deg) from -> to,
// draw = [start, end] of the line drawing, fill = [start, end] of the photographic fill.
// mode: 'blue' (glowing cyan lines) | 'grey' (sober pencil lines, desaturated) ; warm/cool grade tints.
export const PLATES = {
  old: [
    { k: 'aerial', t: [4.85, 8.5], kb: [1.45, 0.5, 0.55, -3, 1.08, 0.5, 0.5, 0], draw: [5.05, 6.4], fill: [5.95, 7.3] },
    { k: 'rynek', t: [8.5, 10.0], kb: [1.05, 0.45, 0.5, 0, 1.22, 0.55, 0.5, 1], draw: [8.5, 8.85], fill: [8.75, 9.25] },
    { k: 'mary', t: [10.0, 11.5], kb: [1.12, 0.5, 0.75, 0, 1.38, 0.5, 0.3, -1.5], draw: [10.0, 10.35], fill: [10.25, 10.75] },
    { k: 'cloth', t: [11.5, 13.0], kb: [1.25, 0.3, 0.5, 0, 1.12, 0.7, 0.5, 0], draw: [11.5, 11.85], fill: [11.75, 12.25] },
    { k: 'townhall', t: [13.0, 14.5], kb: [1.05, 0.5, 0.6, 1, 1.28, 0.5, 0.35, -1], draw: [13.0, 13.35], fill: [13.25, 13.75] },
    { k: 'adalbert', t: [14.5, 15.4], kb: [1.3, 0.35, 0.5, -2, 1.12, 0.6, 0.5, 2], draw: [14.5, 14.7], fill: [14.65, 14.95] },
    { k: 'florian', t: [15.4, 16.4], kb: [1.1, 0.6, 0.5, 2, 1.35, 0.45, 0.45, -1], draw: [15.4, 15.6], fill: [15.55, 15.85] },
    { k: 'wawel', t: [16.4, 20.5], kb: [1.35, 0.5, 0.5, 0, 1.06, 0.5, 0.5, 0], draw: [16.4, 17.6], fill: [17.55, 18.3] },
  ],
  kaz: [
    { k: 'szeroka', t: [19.5, 22.0], kb: [1.04, 0.5, 0.55, 0, 1.18, 0.5, 0.45, 0], draw: [19.6, 20.3], fill: [20.2, 20.9], tint: [1.04, 0.96, 0.88] },
    { k: 'placnowy', t: [22.0, 23.6], kb: [1.25, 0.4, 0.5, -1, 1.08, 0.55, 0.5, 1], draw: [22.0, 22.35], fill: [22.25, 22.75], tint: [1.03, 0.97, 0.92] },
    { k: 'tram', t: [23.6, 24.8], kb: [1.05, 0.3, 0.5, 0, 1.25, 0.65, 0.5, 0], draw: [23.6, 23.85], fill: [23.75, 24.1] },
    { k: 'mural', t: [24.8, 26.0], kb: [1.2, 0.5, 0.5, 1.5, 1.05, 0.5, 0.5, -1], draw: [24.8, 25.05], fill: [24.95, 25.3] },
    { k: 'kazinight', t: [26.0, 27.4], kb: [1.05, 0.5, 0.5, 0, 1.22, 0.5, 0.45, 0], draw: [26.0, 26.3], fill: [26.2, 26.6] },
    { k: 'boulevard', t: [27.4, 30.3], kb: [1.25, 0.4, 0.62, 0, 1.04, 0.5, 0.5, 0], draw: [27.4, 28.0], fill: [27.9, 28.6] },
  ],
  gallery: [
    { k: 'pierogi', t: [29.7, 32.0], kb: [1.3, 0.5, 0.5, -4, 1.08, 0.5, 0.5, 2], draw: [30.0, 30.35], fill: [30.25, 30.7] },
    { k: 'cafe', t: [32.0, 34.0], kb: [1.06, 0.4, 0.5, 0, 1.24, 0.6, 0.5, 0], draw: [32.0, 32.3], fill: [32.2, 32.6] },
    { k: 'amber', t: [34.0, 36.0], kb: [1.25, 0.6, 0.5, 2, 1.06, 0.4, 0.5, -1], draw: [34.0, 34.3], fill: [34.2, 34.6] },
    { k: 'museum', t: [36.0, 38.0], kb: [1.06, 0.5, 0.6, 0, 1.25, 0.5, 0.45, 0], draw: [36.0, 36.3], fill: [36.2, 36.6] },
    { k: 'cellar', t: [38.0, 40.5], kb: [1.2, 0.45, 0.5, -1, 1.05, 0.55, 0.5, 1], draw: [38.0, 38.3], fill: [38.2, 38.6], tint: [1.06, 0.95, 1.05] },
    { k: 'walk', t: [40.5, 43.3], kb: [1.05, 0.35, 0.5, 0, 1.25, 0.65, 0.5, 0], draw: [40.5, 40.8], fill: [40.7, 41.1] },
  ],
  wieliczka: [
    { k: 'headframe', t: [44.6, 46.6], kb: [1.04, 0.5, 0.6, 0, 1.25, 0.5, 0.4, 0], draw: [44.8, 45.5], fill: [45.3, 45.9] },
    { k: 'kinga', t: [46.6, 49.7], kb: [1.3, 0.5, 0.55, 0, 1.04, 0.5, 0.5, 0], draw: [46.6, 47.0], fill: [46.95, 47.6] },
  ],
  memorial: [
    { k: 'birkenau', t: [50.1, 55.6], kb: [1.03, 0.5, 0.55, 0, 1.18, 0.5, 0.42, 0], draw: [50.4, 51.9], fill: [51.5, 52.9], mode: 'grey' },
  ],
  late: [
    { k: 'winter', t: [54.5, 59.2], kb: [1.06, 0.5, 0.5, 0, 1.3, 0.5, 0.5, 0], draw: [55.5, 56.3], fill: [56.0, 57.0], tint: [0.94, 0.98, 1.06] },
    { k: 'spring', t: [59.2, 61.6], kb: [1.25, 0.45, 0.5, 0, 1.06, 0.55, 0.5, 0], draw: [59.2, 59.6], fill: [59.5, 60.1], tint: [1.03, 1.02, 0.96] },
    { k: 'terrace', t: [61.6, 64.3], kb: [1.06, 0.4, 0.5, 0, 1.25, 0.6, 0.5, 0], draw: [61.6, 61.95], fill: [61.85, 62.3], tint: [1.04, 1.0, 0.94] },
    { k: 'night', t: [64.3, 68.5], kb: [1.12, 0.5, 0.5, 0, 1.3, 0.5, 0.45, 0], draw: [64.3, 65.4], fill: [65.45, 65.9] },
    { k: 'fireworks', t: [68.5, 71.2], kb: [1.05, 0.5, 0.5, 0, 1.22, 0.5, 0.45, 0], draw: [68.5, 68.8], fill: [68.7, 69.1] },
    { k: 'finale', t: [71.2, 75.1], kb: [1.4, 0.5, 0.5, 0, 1.04, 0.5, 0.5, 0], draw: [71.2, 71.9], fill: [71.85, 72.3] },
  ],
};

export const PHOTO_SEGS = ['old', 'kaz', 'wieliczka', 'memorial', 'late'];

export function buildPhotos(base = './data/photos/') {
  const loader = new THREE.TextureLoader();
  const tex = {};
  const keys = new Set(PHOTO_SEGS.flatMap((k) => PLATES[k]).map((p) => p.k));
  const loads = [];
  for (const k of keys) {
    loads.push(new Promise((res, rej) => loader.load(`${base}${k}.jpg`, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; (tex[k] ||= {}).photo = t; res(); }, undefined, rej)));
    loads.push(new Promise((res, rej) => loader.load(`${base}${k}_lines.png`, (t) => { t.colorSpace = THREE.NoColorSpace; (tex[k] ||= {}).lines = t; res(); }, undefined, rej)));
  }

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tPhoto: { value: null }, tLines: { value: null }, uImgAspect: { value: 1.5 }, uScrAspect: { value: 16 / 9 },
      uZoom: { value: 1 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uRot: { value: 0 },
      uDraw: { value: 0 }, uFill: { value: 0 }, uTime: { value: 0 }, uGrey: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uBright: { value: 1 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `
      uniform sampler2D tPhoto, tLines; uniform float uImgAspect, uScrAspect, uZoom, uRot, uDraw, uFill, uTime, uGrey, uBright; uniform vec2 uCenter; uniform vec3 uTint;
      varying vec2 vUv;
      float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x), mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.07; a*=.5; } return v; }
      void main(){
        bool card = uImgAspect < uScrAspect * 0.8;
        vec2 uv; vec2 q = vUv; float inCard = 1.0; float edgeD = 1.0;
        float ch = 0.9, cw = ch * uImgAspect / uScrAspect;
        float c = cos(uRot), s = sin(uRot);
        if (card) {
          // portrait photo shown as a centred card
          q = (vUv - vec2(0.5 - cw * 0.5, 0.05)) / vec2(cw, ch);
          inCard = step(0., q.x) * step(q.x, 1.) * step(0., q.y) * step(q.y, 1.);
          vec2 p2 = q - .5; p2.x *= uImgAspect; p2 = mat2(c,-s,s,c) * p2; p2.x /= uImgAspect;
          uv = p2 / uZoom + uCenter;
          edgeD = min(min(q.x, 1. - q.x) * cw * uScrAspect, min(q.y, 1. - q.y) * ch);
        } else {
          vec2 p = vUv - .5; p.x *= uScrAspect;
          p = mat2(c,-s,s,c) * p;
          p /= uZoom;
          vec2 cover = uScrAspect > uImgAspect ? vec2(uScrAspect, uScrAspect/uImgAspect) : vec2(uImgAspect, 1.0);
          uv = p / cover + uCenter;
        }
        uv = clamp(uv, vec2(0.001), vec2(0.999));
        // blueprint background with grid
        vec2 g = vUv * vec2(uScrAspect, 1.0) * 18.0;
        vec2 gf = abs(fract(g) - .5);
        float grid = smoothstep(.48, .5, max(gf.x, gf.y));
        vec2 g2 = abs(fract(g / 5.0) - .5);
        float grid2 = smoothstep(.485, .5, max(g2.x, g2.y));
        vec3 bpBlue = vec3(0.012, 0.045, 0.11) + vec3(0.03,0.09,0.16) * (grid * .35 + grid2 * .6);
        vec3 bpGrey = vec3(0.10) + vec3(0.04) * (grid * .3 + grid2 * .5);
        vec3 bg = mix(bpBlue, bpGrey, uGrey);
        bg *= 1.0 - .35 * length(vUv - .5);
        vec3 lineCol = mix(vec3(0.55, 0.9, 1.0), vec3(0.85), uGrey);
        float glow = mix(1.15, 0.8, uGrey);
        // line drawing, revealed with a sweeping noisy front
        float L = texture2D(tLines, uv).r * inCard;
        float order = (1.0 - q.y) * .55 + fbm(uv * 5.0) * .45;
        float dr = uDraw * 1.25 - .1;
        float drawn = smoothstep(dr, dr - .06, order);
        float front = smoothstep(.08, 0., abs(order - dr)) * step(.001, uDraw) * step(uDraw, .999) * inCard;
        vec3 col = bg + lineCol * L * drawn * glow * (1.0 - smoothstep(0.0, 0.6, uFill) * 0.6) + lineCol * front * (0.15 + L * 1.4) * (1.0 - uGrey * .8);
        // card frame drawn with the lines
        if (card) {
          float frame = smoothstep(0.004, 0.0, abs(edgeD)) * smoothstep(0., 0.3, uDraw);
          col += lineCol * frame * 1.4;
        }
        // photographic fill, dissolving in through noise
        vec3 ph = texture2D(tPhoto, uv).rgb * uTint * uBright;
        float lum = dot(ph, vec3(.2126,.7152,.0722));
        ph = mix(ph, vec3(lum), uGrey * .92);
        float fo = fbm(uv * 3.0 + 7.0) * .7 + (1.0 - L) * .1 + (1.0 - q.y) * .2;
        float fr = uFill * 1.3 - .15;
        float filled = smoothstep(fr, fr - .12, fo) * inCard;
        float edge = smoothstep(.1, 0., abs(fo - fr)) * step(.001, uFill) * step(uFill, .999) * inCard;
        col = mix(col, ph + lineCol * L * .25 * (1.0 - uFill), filled);
        col += mix(vec3(1.0, .62, .28), vec3(.9), uGrey) * edge * mix(0.8, .3, uGrey);
        if (card) {
          // around the card: the same photo, blurred and dimmed, over the blueprint
          vec2 ub = vec2(vUv.x, (vUv.y - .5) * uImgAspect / uScrAspect + .5);
          ub = (ub - .5) / (1.0 + 0.08 * uZoom) + .5;
          vec3 blur = texture2D(tPhoto, ub, 5.0).rgb * uTint;
          blur = mix(blur, vec3(dot(blur, vec3(.33))), .25 + uGrey * .7);
          vec3 outside = mix(bg, blur * 0.32 + bg * 0.5, smoothstep(0., 1., uFill));
          col = mix(outside, col, inCard);
          float shadow = (1. - inCard) * smoothstep(0.04, 0., -min(min(q.x, 1. - q.x) * cw * uScrAspect, min(q.y, 1. - q.y) * ch));
          col *= 1. - shadow * .35;
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function plateAt(list, t) {
    let pl = list[0];
    for (const p of list) if (t >= p.t[0]) pl = p;
    return pl;
  }
  // set up the plate for (segment, time); returns { scene, cam, plate }
  function update(seg, t, aspect) {
    const pl = plateAt(PLATES[seg], t);
    const T = tex[pl.k];
    const u = mat.uniforms;
    u.tPhoto.value = T.photo; u.tLines.value = T.lines;
    u.uImgAspect.value = T.photo.image.width / T.photo.image.height; u.uScrAspect.value = aspect;
    const k = easeInOut(inv(pl.t[0], pl.t[1], t));
    const [z0, x0, y0, r0, z1, x1, y1, r1] = pl.kb;
    // punchy push on the fill moment
    const punch = 0.04 * Math.exp(-Math.max(0, t - pl.fill[0]) * 6) * (t > pl.fill[0] ? 1 : 0);
    u.uZoom.value = lerp(z0, z1, k) + punch;
    u.uCenter.value.set(lerp(x0, x1, k), 1 - lerp(y0, y1, k));
    u.uRot.value = lerp(r0, r1, k) * Math.PI / 180;
    u.uDraw.value = easeOut(inv(pl.draw[0], pl.draw[1], t));
    u.uFill.value = easeInOut(inv(pl.fill[0], pl.fill[1], t));
    u.uTime.value = t;
    u.uGrey.value = pl.mode === 'grey' ? 1 : 0;
    u.uTint.value.set(...(pl.tint || [1, 1, 1]));
    u.uBright.value = { adalbert: 1.35, tram: 1.45, night: 1.4, kazinight: 1.2, finale: 1.25, florian: 1.2, cloth: 1.15, townhall: 1.2 }[pl.k] || 1.0;
    // keep the cover fit valid while zoomed/rotated: clamp the centre so edges never show
    const cover = u.uImgAspect.value < aspect * 0.8 ? [1, 1] : aspect > u.uImgAspect.value ? [1, u.uImgAspect.value / aspect] : [aspect / u.uImgAspect.value, 1];
    const hx = 0.5 * cover[0] / u.uZoom.value * 1.06, hy = 0.5 * cover[1] / u.uZoom.value * 1.06;
    u.uCenter.value.set(clamp(u.uCenter.value.x, hx, 1 - hx), clamp(u.uCenter.value.y, hy, 1 - hy));
    return { scene, cam, plate: pl };
  }
  return { ready: Promise.all(loads), update, PLATES };
}
