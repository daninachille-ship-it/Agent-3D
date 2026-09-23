import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, FrontSide, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from "three";
import { audioBus, BAND_COUNT } from "../voice/audioBus";
import { sampleMic } from "../voice/mic";
import type { PhareState } from "../voice/usePhare";

/** Taille de l'œuf à l'écran (utilisée aussi par le cadrage de la caméra). */
export const EGG_SCALE = 1.35;
/** Demi-hauteur et demi-largeur de l'œuf, en unités 3D (bulle comprise). */
export const EGG_HALF_HEIGHT = 1.3 * EGG_SCALE * 1.12;
export const EGG_HALF_WIDTH = 1.05 * EGG_SCALE * 1.12;

// Sur téléphone, moins de pas de calcul pour garder une animation fluide.
const COARSE = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
const STEPS = COARSE ? 28 : 44;

/* Forme d'œuf commune aux deux shaders : ellipsoïde allongé, plus étroit en haut,
   avec une ondulation douce qui fait "vivre" la surface. */
const shapeGLSL = /* glsl */ `
  uniform float uTime;
  uniform float uWobble;

  float eggWidth(float y) { return 1.0 - 0.11 * y; }

  float wobble(vec3 p) {
    return uWobble * sin(p.x * 3.1 + uTime * 1.7) * sin(p.y * 2.7 - uTime * 1.3) * sin(p.z * 3.3 + uTime * 1.1);
  }

  // Distance approximative à la surface (négative à l'intérieur).
  float eggSDF(vec3 p) {
    float w = eggWidth(p.y);
    return (length(vec3(p.x / w, p.y / 1.3, p.z / w)) - 1.0) * 0.9 - wobble(p);
  }
`;

const vertex = /* glsl */ `
  ${shapeGLSL}
  varying vec3 vObj;
  varying vec3 vNormalW;
  varying vec3 vViewW;

  void main() {
    vec3 s = normalize(position);
    float y = s.y * 1.3;
    float w = eggWidth(y);
    vec3 p = vec3(s.x * w, y, s.z * w);
    vec3 n = normalize(vec3(p.x / (w * w), p.y / 1.69, p.z / (w * w)));
    p += n * wobble(p);
    vObj = p;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * n);
    vViewW = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragment = /* glsl */ `
  ${shapeGLSL}
  #define STEPS ${STEPS}

  uniform vec3 uCamObj;
  uniform float uFlow;     // avancée du nuage (temps "intégré")
  uniform float uSpin;     // rotation du tourbillon intérieur
  uniform float uCore;     // intensité de la lumière centrale
  uniform float uDensity;
  uniform vec3 uCloud;
  uniform vec3 uShadow;
  uniform vec3 uCoreColor;
  uniform vec3 uRim;

  varying vec3 vObj;
  varying vec3 vNormalW;
  varying vec3 vViewW;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 3.1);
      a *= 0.5;
    }
    return v;
  }

  mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

  float density(vec3 p) {
    vec3 q = p;
    // Tourbillon : plus on est près de l'axe, plus ça tourne.
    q.xz *= rot(uSpin * (1.2 - 0.5 * length(p.xz)));
    q += vec3(0.0, -uFlow * 0.35, uFlow * 0.12);
    float n = fbm(q * 1.7);
    float inside = smoothstep(0.0, -0.25, eggSDF(p));
    return smoothstep(0.38, 0.78, n) * inside * uDensity;
  }

  void main() {
    vec3 dir = normalize(vObj - uCamObj);
    float stepLen = 2.9 / float(STEPS);
    // Léger décalage aléatoire du départ pour éviter les bandes visibles.
    vec3 p = vObj + dir * stepLen * hash(vObj * 91.7 + uTime);

    vec3 col = vec3(0.0);
    float T = 1.0; // transmittance

    for (int i = 0; i < STEPS; i++) {
      if (eggSDF(p) > 0.02 || T < 0.03) break;
      float r = length(p * vec3(1.0, 0.8, 1.0));
      float light = uCore * exp(-r * 2.3);

      // Halo de la lampe à travers la brume.
      col += T * uCoreColor * light * stepLen * 1.1;

      float d = density(p);
      if (d > 0.001) {
        float a = 1.0 - exp(-d * stepLen * 5.5);
        // Nuage éclairé de l'intérieur : clair près du cœur, bleuté vers les bords.
        vec3 c = mix(uShadow, uCloud, clamp(0.3 + light * 0.7, 0.0, 1.0));
        c += uCoreColor * light * 0.3;
        col += T * a * c;
        T *= 1.0 - a;
      }
      p += dir * stepLen;
    }

    // Surface de bulle : liseré lumineux et reflets irisés.
    float fres = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewW))), 2.6);
    vec3 irid = 0.5 + 0.5 * cos(6.2831 * (fres * 1.3 + vec3(0.0, 0.33, 0.67)));
    vec3 rim = uRim * fres * 1.2 + irid * fres * 0.25;

    // Petit reflet brillant, comme sur une bulle de savon.
    vec3 L = normalize(vec3(-0.5, 0.7, 0.6));
    vec3 H = normalize(L + normalize(vViewW));
    float spec = pow(max(dot(normalize(vNormalW), H), 0.0), 90.0) * 0.9;

    float alpha = clamp(1.0 - T + fres * 0.55 + spec, 0.0, 1.0);
    vec3 outCol = col + rim + vec3(spec);
    gl_FragColor = vec4(outCol, alpha);
  }
`;

interface Props {
  state: PhareState;
  reduced: boolean;
}

export function Egg({ state, reduced }: Props) {
  const mesh = useRef<Mesh>(null);
  const geometry = useMemo(() => new SphereGeometry(1, 128, 96), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uTime: { value: 0 },
          uWobble: { value: 0.02 },
          uCamObj: { value: new Vector3() },
          uFlow: { value: 0 },
          uSpin: { value: 0 },
          uCore: { value: 1 },
          uDensity: { value: 1 },
          uCloud: { value: new Color("#f6f3ff") },
          uShadow: { value: new Color("#4d67b3") },
          uCoreColor: { value: new Color("#ffd9a0") },
          uRim: { value: new Color("#a9c8ff") },
        },
        transparent: true,
        depthWrite: false,
        side: FrontSide,
      }),
    [],
  );

  // Valeurs lissées.
  const level = useRef(0);
  const core = useRef(1);
  const speed = useRef(0.15);
  const spinSpeed = useRef(0.05);
  const flow = useRef(0);
  const spin = useRef(0);
  const scale = useRef(1);
  const camObj = useMemo(() => new Vector3(), []);

  useFrame(({ clock, camera }, delta) => {
    const t = clock.elapsedTime;
    const amp = reduced ? 0.3 : 1;
    const now = performance.now();

    // 1. Signal d'entrée selon l'état (voix de l'utilisateur ou de Phare).
    let input = 0;
    if (state === "listening") {
      sampleMic(delta);
      // Les aigus (consonnes) rendent le nuage plus agité.
      const from = Math.floor(BAND_COUNT / 2);
      let highs = 0;
      for (let i = from; i < BAND_COUNT; i++) highs += audioBus.micBands[i];
      input = Math.min(1, audioBus.micLevel * 0.8 + (highs / (BAND_COUNT - from)) * 0.6);
    } else if (state === "speaking") {
      const sinceWord = now - audioBus.lastWordAt;
      const wordEnv = Math.exp(-sinceWord / 160);
      const synthetic =
        !audioBus.hasWordEvents || sinceWord > 900
          ? Math.max(0, Math.sin(t * 8.5)) * (0.55 + 0.45 * Math.sin(t * 2.3 + 1))
          : 0;
      input = Math.max(wordEnv, synthetic);
    }
    const kFast = 1 - Math.exp(-delta * 12);
    const kSlow = 1 - Math.exp(-delta * 3);
    level.current += (input - level.current) * kFast;
    const lv = level.current * amp;

    // 2. Cibles par état.
    const breath = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / 5); // cycle de 5 s
    let coreT = 1;
    let speedT = 0.15;
    let spinT = 0.05;
    let scaleT = 1;
    let wobbleT = 0.015;
    switch (state) {
      case "idle":
        coreT = 0.65 + 0.5 * breath * amp;
        scaleT = 1 + 0.025 * breath * amp;
        break;
      case "listening":
        coreT = 0.95 + lv * 1.6;
        speedT = 0.3 + lv * 1.4;
        spinT = 0.15 + lv * 0.6;
        scaleT = 1.02 + lv * 0.07;
        wobbleT = 0.02 + lv * 0.09;
        break;
      case "thinking":
        coreT = 1.15 + 0.2 * Math.sin(t * 5) * amp;
        speedT = 0.45;
        spinT = 1.6;
        scaleT = 1.01;
        wobbleT = 0.025;
        break;
      case "speaking":
        coreT = 1 + lv * 1.4;
        speedT = 0.35 + lv * 0.5;
        spinT = 0.25;
        scaleT = 1 + lv * 0.06;
        wobbleT = 0.02 + lv * 0.06;
        break;
    }
    if (reduced) {
      speedT *= 0.3;
      spinT *= 0.25;
      wobbleT *= 0.3;
    }

    core.current += (coreT - core.current) * (state === "idle" ? kSlow : kFast);
    speed.current += (speedT - speed.current) * kSlow;
    spinSpeed.current += (spinT - spinSpeed.current) * kSlow;
    scale.current += (scaleT - scale.current) * kFast;
    flow.current += delta * speed.current;
    spin.current += delta * spinSpeed.current;

    const u = material.uniforms;
    u.uTime.value = t;
    u.uFlow.value = flow.current;
    u.uSpin.value = spin.current;
    u.uCore.value = core.current;
    u.uWobble.value += (wobbleT - u.uWobble.value) * kFast;

    if (mesh.current) {
      const s = EGG_SCALE * scale.current;
      mesh.current.scale.setScalar(s);
      mesh.current.rotation.y = reduced ? 0 : Math.sin(t * 0.15) * 0.25;
      mesh.current.updateMatrixWorld();
      camObj.copy(camera.position);
      mesh.current.worldToLocal(camObj);
      u.uCamObj.value.copy(camObj);
    }
  });

  // Dessiné après les étoiles pour qu'elles ne passent pas devant.
  return <mesh ref={mesh} geometry={geometry} material={material} renderOrder={10} />;
}
