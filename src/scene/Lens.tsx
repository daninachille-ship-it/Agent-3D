import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Sprite,
  Vector2,
} from "three";
import { audioBus, RING_COUNT } from "../voice/audioBus";
import { sampleMic } from "../voice/mic";
import type { PhareState } from "../voice/usePhare";

const BRASS = new Color("#d6a44e");
const BRASS_DARK = new Color("#9c7431");
const GLOW = new Color("#ff9d42");
const LAMP = new Color("#ffe3a3");

const INNER_R = 0.55;
const STEP = 0.2;
const RIVETS = 24;
/** Nombre d'images de retard entre deux anneaux pour l'effet d'onde en parole. */
const RIPPLE_DELAY = 4;

/**
 * Profil d'un prisme de Fresnel : face verticale côté centre,
 * pente douce vers l'extérieur. Tourné autour de l'axe, il forme un anneau en relief.
 */
function prismRing(i: number): LatheGeometry {
  const rIn = INNER_R + i * STEP;
  const rOut = rIn + STEP * 0.9;
  const h = 0.1 + i * 0.018;
  const pts = [
    new Vector2(rIn, -0.04),
    new Vector2(rOut, -0.04),
    new Vector2(rOut, 0.015),
    new Vector2(rOut - 0.02, 0.03),
    new Vector2(rIn + 0.015, h),
    new Vector2(rIn, h - 0.01),
    new Vector2(rIn, -0.04),
  ];
  return new LatheGeometry(pts, 160);
}

function haloTexture(): CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,240,200,1)");
  grad.addColorStop(0.25, "rgba(255,200,120,0.45)");
  grad.addColorStop(0.6, "rgba(255,160,70,0.08)");
  grad.addColorStop(1, "rgba(255,140,60,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new CanvasTexture(c);
}

interface Props {
  state: PhareState;
  reduced: boolean;
}

export function Lens({ state, reduced }: Props) {
  const rings = useMemo(() => Array.from({ length: RING_COUNT }, (_, i) => prismRing(i)), []);
  const ringMats = useMemo(
    () =>
      rings.map(
        () =>
          new MeshStandardMaterial({
            color: BRASS,
            metalness: 1,
            roughness: 0.24,
            emissive: GLOW,
            emissiveIntensity: 0,
          }),
      ),
    [rings],
  );
  const halo = useMemo(haloTexture, []);

  const ringRefs = useRef<(Mesh | null)[]>([]);
  const lampMat = useRef<MeshStandardMaterial>(null);
  const light = useRef<PointLight>(null);
  const haloRef = useRef<Sprite>(null);

  // Valeurs lissées par anneau.
  const z = useRef(new Float32Array(RING_COUNT));
  const glow = useRef(new Float32Array(RING_COUNT));
  const history = useRef(new Float32Array(RING_COUNT * RIPPLE_DELAY + 1));
  const lamp = useRef(1);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const amp = reduced ? 0.35 : 1;
    const now = performance.now();

    if (state === "listening") sampleMic(delta);

    // Enveloppe de parole : impulsion à chaque mot, ou rythme simulé si la voix n'en fournit pas.
    let speech = 0;
    if (state === "speaking") {
      const sinceWord = now - audioBus.lastWordAt;
      const wordEnv = Math.exp(-sinceWord / 160);
      const synthetic =
        !audioBus.hasWordEvents || sinceWord > 900
          ? Math.max(0, Math.sin(t * 8.5)) * (0.55 + 0.45 * Math.sin(t * 2.3 + 1))
          : 0;
      speech = Math.max(wordEnv, synthetic);
    }
    // Historique pour propager l'onde du centre vers l'extérieur.
    const hist = history.current;
    hist.copyWithin(1, 0);
    hist[0] = speech;

    let lampTarget: number;
    switch (state) {
      case "idle":
        // Respiration lente (cycle de 5 s).
        lampTarget = 1.6 + 1.2 * (0.5 + 0.5 * Math.sin((t * Math.PI * 2) / 5)) * amp;
        break;
      case "listening":
        lampTarget = 2.2 + audioBus.micLevel * 3 * amp;
        break;
      case "thinking":
        lampTarget = 3 + 0.6 * Math.sin(t * 6) * amp;
        break;
      case "speaking":
        lampTarget = 2.4 + speech * 2.2 * amp;
        break;
    }
    const kFast = 1 - Math.exp(-delta * 14);
    const kSlow = 1 - Math.exp(-delta * 5);
    lamp.current += (lampTarget - lamp.current) * (state === "idle" ? kSlow : kFast);

    for (let i = 0; i < RING_COUNT; i++) {
      let zt = 0;
      let gt = 0;
      if (state === "listening") {
        const band = audioBus.micBands[i];
        zt = band * 0.28 * amp;
        gt = band * 1.4;
      } else if (state === "speaking") {
        const v = hist[i * RIPPLE_DELAY];
        zt = v * 0.18 * amp;
        gt = v * 1.1;
      } else if (state === "thinking") {
        const w = 0.5 + 0.5 * Math.sin(t * 4 - i * 0.7);
        zt = w * 0.05 * amp;
        gt = w * 0.35;
      } else {
        gt = 0.06 * (lamp.current - 1.6);
      }
      z.current[i] += (zt - z.current[i]) * kFast;
      glow.current[i] += (gt - glow.current[i]) * kFast;

      const mesh = ringRefs.current[i];
      if (mesh) {
        // Dans le repère de l'anneau, l'axe Y pointe vers la caméra.
        mesh.position.y = z.current[i];
        const s = 1 + z.current[i] * 0.12;
        mesh.scale.set(s, 1, s);
      }
      ringMats[i].emissiveIntensity = glow.current[i];
    }

    if (lampMat.current) lampMat.current.emissiveIntensity = lamp.current * 1.4;
    if (light.current) light.current.intensity = lamp.current * 2.2;
    if (haloRef.current) {
      const s = 1.6 + lamp.current * 0.35;
      haloRef.current.scale.set(s, s, 1);
    }
  });

  return (
    <group>
      {/* Plaque de fond */}
      <mesh position={[0, 0, -0.08]}>
        <circleGeometry args={[2.55, 96]} />
        <meshStandardMaterial color="#0b1830" metalness={0.6} roughness={0.55} />
      </mesh>

      {/* Anneaux de Fresnel en laiton (axe tourné vers la caméra) */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        {rings.map((geo, i) => (
          <mesh
            key={i}
            ref={(m) => {
              ringRefs.current[i] = m;
            }}
            geometry={geo}
            material={ringMats[i]}
          />
        ))}
      </group>

      {/* Cerclage extérieur et rivets */}
      <mesh>
        <torusGeometry args={[2.45, 0.1, 24, 160]} />
        <meshStandardMaterial color={BRASS_DARK} metalness={1} roughness={0.35} />
      </mesh>
      {Array.from({ length: RIVETS }, (_, i) => {
        const a = (i / RIVETS) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 2.45, Math.sin(a) * 2.45, 0.09]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial color={BRASS} metalness={1} roughness={0.25} />
          </mesh>
        );
      })}

      {/* Lampe centrale */}
      <mesh position={[0, 0, 0.12]}>
        <sphereGeometry args={[0.3, 48, 48]} />
        <meshStandardMaterial ref={lampMat} color={LAMP} emissive={LAMP} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      {/* Globe de verre */}
      <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <sphereGeometry args={[0.44, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial
          transparent
          opacity={0.18}
          roughness={0}
          metalness={0}
          clearcoat={1}
          color="#cfe4ff"
        />
      </mesh>
      <sprite ref={haloRef} position={[0, 0, 0.5]}>
        <spriteMaterial map={halo} blending={AdditiveBlending} depthWrite={false} transparent toneMapped={false} />
      </sprite>
      <pointLight ref={light} position={[0, 0, 0.7]} color="#ffc676" distance={7} decay={1.6} />
    </group>
  );
}
