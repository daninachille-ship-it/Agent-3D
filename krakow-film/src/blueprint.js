// "Architect's drawing" renderer: every 3D scene is drawn as clean technical lines with hidden-line removal.
// Pass 1: view-space normals + depth + monument id (override material, solid geometry only, layer 0).
// Pass 2: edge detection -> lines on a blueprint background (monuments traced in gold).
// Pass 3: glows (lamps, sparkles, fireworks, beams, blueprint edges) rendered additively on top (layer 1).
import * as THREE from 'three';
import { G } from './util.js';

export function createBlueprint(renderer, width, height) {
  const rtN = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4 });
  const normMat = new THREE.ShaderMaterial({
    uniforms: { uId: { value: 0 }, uReveal: G.uReveal, uRevealC: G.uRevealC },
    vertexShader: `
      #include <common>
      varying vec3 vN; varying float vD; varying vec3 vW;
      void main(){
        #include <beginnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #include <project_vertex>
        vec4 w = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          w = instanceMatrix * w;
        #endif
        vW = (modelMatrix * w).xyz;
        vN = normalize(transformedNormal); vD = -mvPosition.z;
      }`,
    fragmentShader: `
      uniform float uId; uniform float uReveal; uniform vec2 uRevealC;
      varying vec3 vN; varying float vD; varying vec3 vW;
      void main(){
        if (length(vW.xz - uRevealC) > uReveal) discard;
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        gl_FragColor = vec4(n.xy * 0.5 + 0.5, uId, vD); // normal.xy, monument id, view depth
      }`,
    side: THREE.DoubleSide,
  });
  const edgeMat = new THREE.ShaderMaterial({
    uniforms: {
      tN: { value: rtN.texture }, uRes: { value: new THREE.Vector2(width, height) },
      uBg: { value: new THREE.Color() }, uBg2: { value: new THREE.Color() }, uLine: { value: new THREE.Color() }, uGold: { value: new THREE.Color() },
      uFill: { value: 0.08 }, uFar: { value: 260 }, uGrid: { value: 1 }, uGain: { value: 1.4 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `
      uniform sampler2D tN; uniform vec2 uRes; uniform vec3 uBg, uBg2, uLine, uGold; uniform float uFill, uFar, uGrid, uGain;
      varying vec2 vUv;
      vec4 S(vec2 o){ return texture2D(tN, vUv + o / uRes); }
      vec3 nrm(vec4 s){ vec2 xy = s.xy * 2. - 1.; float z = sqrt(max(0., 1. - dot(xy, xy))); return vec3(xy, z); }
      void main(){
        vec4 c = S(vec2(0));
        bool sky = c.a <= 0.0001;
        // background: blueprint gradient + grid
        vec2 g = vUv * vec2(uRes.x / uRes.y, 1.) * 22.;
        vec2 gf = abs(fract(g) - .5); vec2 g5 = abs(fract(g / 5.) - .5);
        float grid = (smoothstep(.47, .5, max(gf.x, gf.y)) * .35 + smoothstep(.485, .5, max(g5.x, g5.y)) * .7) * uGrid;
        vec3 bg = mix(uBg2, uBg, vUv.y) ;
        bg = mix(bg, uLine, grid * .07);
        bg *= 1. - .3 * length(vUv - .5);
        // edges: normal & depth discontinuities over a 2-px ring
        float d0 = max(c.a, 0.001);
        vec3 n0 = nrm(c);
        float e = 0., gold = 0.;
        float id0 = c.b > 0.5 && !sky ? 1. : 0.;
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.785398;
          vec2 o = vec2(cos(a), sin(a)) * 1.25;
          vec4 s = S(o);
          float ds = s.a <= 0.0001 ? 1e4 : s.a;
          float dd = abs(ds - d0) / d0;
          float nd = 1. - dot(n0, nrm(s));
          float ee = max(smoothstep(0.012, 0.05, dd), smoothstep(0.08, 0.3, nd));
          if (sky && s.a <= 0.0001) ee = 0.;
          e = max(e, ee);
          float ids = s.b > 0.5 && s.a > 0.0001 ? 1. : 0.;
          gold = max(gold, max(id0, ids) * ee);
        }
        float fade = mix(1., .32, smoothstep(30., uFar, d0));
        e *= fade;
        vec3 col = bg;
        if (!sky) {
          float shade = 0.55 + 0.45 * clamp(dot(n0, normalize(vec3(-.4, .8, .5))), 0., 1.);
          col = mix(bg, uLine, uFill * shade * fade);
          col = mix(col, bg * 0.92, smoothstep(uFar * .6, uFar * 1.6, d0));
        }
        vec3 lc = mix(uLine, uGold, gold > 0.05 ? smoothstep(0.05, 0.4, gold) : 0.);
        col = mix(col, lc * uGain, clamp(e, 0., 1.));
        gl_FragColor = vec4(col, 1.);
      }`,
    depthTest: false, depthWrite: false,
  });
  const edgeScene = new THREE.Scene(); edgeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), edgeMat));
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const setId = (v) => () => { if (normMat.uniforms.uId.value !== v) { normMat.uniforms.uId.value = v; normMat.uniformsNeedUpdate = true; } };
  const on0 = setId(0), on1 = setId(1);
  // Tag a scene: glow-type objects to layer 1, monuments get id 1.
  function prep(scene, monumentRoots = []) {
    const mons = new Set();
    for (const r of monumentRoots) r.traverse((o) => mons.add(o));
    scene.traverse((o) => {
      const m = o.material;
      const glow = o.isPoints || o.isSprite || o.isLine || (m && (m.blending === THREE.AdditiveBlending || m.side === THREE.BackSide && o.geometry?.parameters?.radius > 100));
      if (glow) { o.layers.set(1); return; }
      if (o.isMesh) o.onBeforeRender = mons.has(o) ? on1 : on0;
    });
  }
  function render(scene, cam, target, P) {
    // pass 1
    const bg = scene.background, fog = scene.fog;
    scene.background = null; scene.fog = null; scene.overrideMaterial = normMat;
    cam.layers.set(0);
    renderer.setRenderTarget(rtN); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
    scene.overrideMaterial = null;
    // pass 2
    const U = edgeMat.uniforms;
    U.uBg.value.copy(P.bg); U.uBg2.value.copy(P.bg2 || P.bg); U.uLine.value.copy(P.line); U.uGold.value.copy(P.gold);
    U.uFill.value = P.fill ?? 0.08; U.uFar.value = P.far ?? 260; U.uGrid.value = P.grid ?? 1; U.uGain.value = P.gain ?? 1.4;
    renderer.setRenderTarget(target); renderer.render(edgeScene, fsCam);
    // pass 3: glows on top (depth-tested against nothing: they are additive light)
    cam.layers.set(1);
    const ac = renderer.autoClear; renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(scene, cam);
    renderer.autoClear = ac;
    cam.layers.set(0);
    scene.background = bg; scene.fog = fog;
    renderer.setClearColor(0x000000, 1);
  }
  function resize(w, h) { rtN.setSize(w, h); edgeMat.uniforms.uRes.value.set(w, h); }
  return { prep, render, resize };
}
