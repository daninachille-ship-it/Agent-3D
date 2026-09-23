import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  CurvePath,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  MeshBasicMaterial,
  QuadraticBezierCurve3,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  TubeGeometry,
  Vector3,
} from "three";
import { audioBus, BAND_COUNT } from "../voice/audioBus";
import { sampleMic } from "../voice/mic";
import type { PhareState } from "../voice/usePhare";

/** Rayon de la sphère holographique. */
export const HOLO_RADIUS = 1.55;

const CYAN = new Color("#5cd0ff");

const noiseGLSL = /* glsl */ `
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
`;

/* --- Coque : remplissage translucide, grille de méridiens et balayage lumineux --- */

const shellVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const shellFragment = /* glsl */ `
  uniform float uScan;
  uniform float uScanAmt;
  uniform float uGlow;
  uniform vec3 uFill;
  uniform vec3 uLine;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;

  void main() {
    float facing = abs(dot(normalize(vN), normalize(vV)));
    // Liseré net, façon dessin animé.
    float rim = smoothstep(0.32, 0.18, facing);

    // Grille : 22 méridiens, 11 parallèles, traits fins et nets.
    vec2 g = vec2(vUv.x * 22.0, vUv.y * 11.0);
    vec2 d = abs(fract(g - 0.5) - 0.5) / fwidth(g);
    float line = 1.0 - clamp(min(d.x, d.y) - 0.4, 0.0, 1.0);

    // Balayage : une bande lumineuse qui tourne autour de la sphère (réflexion).
    float lon = vUv.x * 6.2831853;
    float dl = abs(mod(lon - uScan + 3.1415926, 6.2831853) - 3.1415926);
    float scan = exp(-dl * dl * 10.0) * uScanAmt;

    float face = gl_FrontFacing ? 1.0 : 0.4;
    vec3 col = mix(uFill, uLine, line * 0.75 + rim * 0.5) + uLine * scan * (0.4 + line);
    float a = (0.3 + rim * 0.4 + line * 0.35 + scan * 0.25) * face;
    gl_FragColor = vec4(col * uGlow, clamp(a, 0.0, 1.0));
  }
`;

/* --- Amibe : forme organique autour du cœur, qui ondule avec la voix --- */

const blobVertex = /* glsl */ `
  ${noiseGLSL}
  uniform float uTime;
  uniform float uAmp;
  uniform float uSpeed;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 n = normalize(position);
    float k = noise(n * 1.6 + vec3(uTime * uSpeed, uTime * uSpeed * 0.7, 0.0));
    float k2 = noise(n * 3.3 - vec3(0.0, uTime * uSpeed * 1.3, uTime * uSpeed));
    vec3 p = position * (1.0 + (k - 0.5) * uAmp * 1.6 + (k2 - 0.5) * uAmp * 0.6);
    vec4 world = modelMatrix * vec4(p, 1.0);
    vN = normalize(mat3(modelMatrix) * n);
    vV = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const blobFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uEdge;
  uniform float uGlow;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float facing = abs(dot(normalize(vN), normalize(vV)));
    // Deux aplats de couleur + un bord clair : rendu "cel shading".
    vec3 col = facing > 0.55 ? uColor * 1.15 : uColor * 0.9;
    col = mix(col, uEdge, smoothstep(0.28, 0.12, facing));
    gl_FragColor = vec4(col * uGlow, 0.82);
  }
`;

/** Arc de cercle 3D effilé aux deux bouts : une "traînée" liquide. */
function swooshGeometry(radius: number, span: number, thickness: number): TubeGeometry {
  const pts: Vector3[] = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * span;
    pts.push(new Vector3(Math.cos(a) * radius, Math.sin(a * 2.3) * 0.06, Math.sin(a) * radius));
  }
  const path = new CurvePath<Vector3>();
  for (let i = 0; i < n; i += 2) path.add(new QuadraticBezierCurve3(pts[i], pts[i + 1], pts[i + 2]));

  const segments = 40;
  const geo = new TubeGeometry(path, segments, thickness, 8, false);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const onCurve = new Vector3();
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    path.getPointAt(Math.min(1, Math.max(0, u)), onCurve);
    // Bouts arrondis, ventre épais : une goutte étirée plutôt qu'une aiguille.
    const taper = Math.pow(Math.sin(Math.PI * u), 0.35);
    v.fromBufferAttribute(pos, i).sub(onCurve).multiplyScalar(taper).add(onCurve);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  return geo;
}

/** Générateur pseudo-aléatoire stable : la disposition est la même à chaque chargement. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

interface Swoosh {
  geometry: TubeGeometry;
  tilt: [number, number, number];
  speed: number;
  phase: number;
}

interface Drop {
  pos: Vector3;
  size: number;
}

interface Props {
  state: PhareState;
  reduced: boolean;
}

export function Hologram({ state, reduced }: Props) {
  const shellGeo = useMemo(() => new SphereGeometry(HOLO_RADIUS, 72, 48), []);
  const shellMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: shellVertex,
        fragmentShader: shellFragment,
        uniforms: {
          uScan: { value: 0 },
          uScanAmt: { value: 0 },
          uGlow: { value: 1 },
          uFill: { value: new Color("#2f9fe0") },
          uLine: { value: new Color("#c9f3ff") },
        },
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    [],
  );

  const blobGeo = useMemo(() => new IcosahedronGeometry(0.62, 6), []);
  const blobMat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: blobVertex,
        fragmentShader: blobFragment,
        uniforms: {
          uTime: { value: 0 },
          uAmp: { value: 0.25 },
          uSpeed: { value: 0.2 },
          uGlow: { value: 1 },
          uColor: { value: new Color("#63d9ff") },
          uEdge: { value: new Color("#b8f0ff") },
        },
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  const swooshMat = useMemo(
    () => new MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.8, depthWrite: false }),
    [],
  );

  const halo = useMemo(() => {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.2, "rgba(200,245,255,0.8)");
    grad.addColorStop(0.5, "rgba(120,215,255,0.18)");
    grad.addColorStop(1, "rgba(80,190,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return new CanvasTexture(c);
  }, []);

  const { swooshes, drops } = useMemo(() => {
    const rnd = seeded(7);
    const swooshes: Swoosh[] = Array.from({ length: 11 }, () => ({
      geometry: swooshGeometry(1.8 + rnd() * 0.5, 0.3 + rnd() * 0.75, 0.06 + rnd() * 0.05),
      tilt: [(rnd() - 0.5) * 1.3, rnd() * Math.PI * 2, (rnd() - 0.5) * 1.3],
      speed: (0.15 + rnd() * 0.35) * (rnd() > 0.3 ? 1 : -1),
      phase: rnd() * Math.PI * 2,
    }));
    const drops: Drop[] = Array.from({ length: 16 }, () => {
      const theta = rnd() * Math.PI * 2;
      const phi = Math.acos(2 * rnd() - 1);
      const r = 1.75 + rnd() * 0.75;
      return {
        pos: new Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) * 0.8, r * Math.sin(phi) * Math.sin(theta)),
        size: 0.045 + rnd() * 0.06,
      };
    });
    return { swooshes, drops };
  }, []);

  const root = useRef<Group>(null);
  const swooshRefs = useRef<(Group | null)[]>([]);
  const dropsRef = useRef<Group>(null);
  const blobRef = useRef<Group>(null);
  const haloRef = useRef<Sprite>(null);
  const coreMat = useRef<MeshBasicMaterial>(null);

  // Valeurs lissées.
  const level = useRef(0);
  const glow = useRef(1);
  const orbit = useRef(0.3);
  const scanAmt = useRef(0);
  const scan = useRef(0);
  const spread = useRef(1);
  const blobAmp = useRef(0.25);
  const blobSpeed = useRef(0.2);
  const spin = useRef(new Float32Array(swooshes.length));
  const dropSpin = useRef(0);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const amp = reduced ? 0.3 : 1;
    const now = performance.now();

    // 1. Signal d'entrée : ta voix (écoute) ou celle de Phare (parole).
    let input = 0;
    if (state === "listening") {
      sampleMic(delta);
      const from = Math.floor(BAND_COUNT / 2);
      let highs = 0;
      for (let i = from; i < BAND_COUNT; i++) highs += audioBus.micBands[i];
      input = Math.min(1, audioBus.micLevel * 0.8 + (highs / (BAND_COUNT - from)) * 0.6);
    } else if (state === "speaking") {
      // Une impulsion par mot prononcé, qui retombe en douceur : Phare bouge au rythme des mots.
      input = Math.exp(-(now - audioBus.lastWordAt) / 260);
    }
    const kFast = 1 - Math.exp(-delta * 12);
    const kSlow = 1 - Math.exp(-delta * 3);
    // Montée rapide mais pas instantanée, retombée douce : un mouvement vivant, pas nerveux.
    const kRise = 1 - Math.exp(-delta * 22);
    const kFall = 1 - Math.exp(-delta * 5);
    level.current += (input - level.current) * (input > level.current ? kRise : kFall);
    audioBus.level = level.current;
    const lv = level.current * amp;

    // 2. Cibles par état.
    const breath = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / 5); // cycle de 5 s
    let glowT = 1;
    let orbitT = 0.3;
    let scanT = 0;
    let spreadT = 1;
    let ampT = 0.22;
    let speedT = 0.2;
    switch (state) {
      case "idle":
        glowT = 0.85 + 0.25 * breath * amp;
        spreadT = 1 + 0.02 * breath * amp;
        break;
      case "listening":
        glowT = 1.05 + lv * 0.6;
        orbitT = 0.5 + lv * 1.5;
        spreadT = 1.03 + lv * 0.12;
        ampT = 0.3 + lv * 0.9;
        speedT = 0.5 + lv * 1.5;
        break;
      case "thinking":
        glowT = 1.15;
        orbitT = 1.6;
        scanT = 1;
        ampT = 0.35;
        speedT = 0.9;
        break;
      case "speaking":
        glowT = 1.05 + lv * 0.55;
        orbitT = 0.5 + lv * 0.3;
        spreadT = 1 + lv * 0.09;
        ampT = 0.28 + lv * 0.6;
        speedT = 0.35 + lv * 0.25;
        break;
    }
    if (reduced) {
      orbitT *= 0.2;
      speedT *= 0.4;
      ampT = Math.min(ampT, 0.35);
    }

    glow.current += (glowT - glow.current) * (state === "idle" ? kSlow : kFast);
    orbit.current += (orbitT - orbit.current) * kSlow;
    scanAmt.current += (scanT - scanAmt.current) * kSlow;
    spread.current += (spreadT - spread.current) * kFast;
    blobAmp.current += (ampT - blobAmp.current) * kFast;
    blobSpeed.current += (speedT - blobSpeed.current) * kSlow;
    scan.current += delta * (reduced ? 0.8 : 2.4);

    shellMat.uniforms.uScan.value = scan.current;
    shellMat.uniforms.uScanAmt.value = scanAmt.current;
    shellMat.uniforms.uGlow.value = glow.current;

    blobMat.uniforms.uTime.value = t;
    blobMat.uniforms.uAmp.value = blobAmp.current;
    blobMat.uniforms.uSpeed.value = blobSpeed.current;
    blobMat.uniforms.uGlow.value = glow.current;

    swooshes.forEach((s, i) => {
      spin.current[i] += delta * s.speed * orbit.current * 2;
      const g = swooshRefs.current[i];
      if (g) {
        g.rotation.y = s.phase + spin.current[i];
        g.scale.setScalar(spread.current);
      }
    });
    dropSpin.current += delta * 0.25 * orbit.current;
    if (dropsRef.current) {
      dropsRef.current.rotation.y = dropSpin.current;
      dropsRef.current.scale.setScalar(spread.current);
    }

    if (root.current) {
      root.current.rotation.y = reduced ? 0 : Math.sin(t * 0.12) * 0.2;
      root.current.scale.setScalar(1 + lv * (state === "speaking" ? 0.06 : 0.04));
    }
    if (blobRef.current) blobRef.current.rotation.z = t * 0.08 * amp;
    if (haloRef.current) {
      const s = 1.1 + glow.current * 0.5 + lv * 0.6;
      haloRef.current.scale.set(s, s, 1);
    }
    if (coreMat.current) coreMat.current.color.setScalar(1.6 + glow.current + lv * 2);
  });

  return (
    <group ref={root}>
      {/* Cœur lumineux et son amibe (aplatie, face à la caméra) */}
      <group ref={blobRef} scale={[1, 1, 0.55]}>
        <mesh geometry={blobGeo} material={blobMat} renderOrder={2} />
      </group>
      <mesh renderOrder={3}>
        <sphereGeometry args={[0.24, 32, 32]} />
        <meshBasicMaterial ref={coreMat} color="white" toneMapped={false} />
      </mesh>
      <sprite ref={haloRef} renderOrder={4}>
        <spriteMaterial map={halo} blending={AdditiveBlending} depthWrite={false} transparent toneMapped={false} />
      </sprite>

      {/* Coque holographique */}
      <mesh geometry={shellGeo} material={shellMat} renderOrder={5} />

      {/* Traînées et gouttes en orbite */}
      {swooshes.map((s, i) => (
        <group key={i} rotation={s.tilt}>
          <group
            ref={(g) => {
              swooshRefs.current[i] = g;
            }}
          >
            <mesh geometry={s.geometry} material={swooshMat} renderOrder={6} />
          </group>
        </group>
      ))}
      <group ref={dropsRef}>
        {drops.map((d, i) => (
          <mesh key={i} position={d.pos} scale={[d.size * 1.8, d.size, d.size]} material={swooshMat} renderOrder={6}>
            <sphereGeometry args={[1, 12, 10]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
