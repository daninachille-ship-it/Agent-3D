import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry } from "three";
import { audioBus } from "../voice/audioBus";
import type { PhareState } from "../voice/usePhare";
import { ticksGeometry } from "./ticks";

/** Anneaux en orbite autour de Phare : rayon, inclinaison, vitesse propre. */
const RINGS = [
  { r: 2.35, tilt: [1.2, 0, 0.3] as const, speed: 0.35, beads: 2 },
  { r: 2.85, tilt: [0.4, 0.6, -0.9] as const, speed: -0.25, beads: 3 },
  { r: 3.35, tilt: [-0.8, 0.2, 0.5] as const, speed: 0.18, beads: 1 },
];

const RIPPLE_COUNT = 8;
const RIPPLE_LIFE = 1.4; // secondes

/**
 * Autour de Phare : une sphère armillaire (trois anneaux qui tournent chacun sur leur axe)
 * et des ondes qui partent de lui à chaque mot prononcé. Proches de lui, ces anneaux
 * donnent du relief dès qu'on se déplace.
 */
export function Orbits({ state, reduced }: { state: PhareState; reduced: boolean }) {
  const ringRefs = useRef<(Group | null)[]>([]);
  const tickGeos = useMemo(
    () => RINGS.map((r) => ticksGeometry(r.r, 48, { longEvery: 4, short: 0.07, long: 0.16, thickness: 0.012 })),
    [],
  );
  const spins = useRef(RINGS.map(() => 0));
  const speed = useRef(1);

  // Ondes : un petit réservoir d'anneaux réutilisés.
  const rippleGeo = useMemo(() => new RingGeometry(0.97, 1, 96), []);
  const rippleMats = useMemo(
    () =>
      Array.from(
        { length: RIPPLE_COUNT },
        () =>
          new MeshBasicMaterial({
            color: "#bff2ff",
            transparent: true,
            opacity: 0,
            side: DoubleSide,
            depthWrite: false,
            blending: AdditiveBlending,
          }),
      ),
    [],
  );
  const rippleRefs = useRef<(Mesh | null)[]>([]);
  const rippleAge = useRef(new Float32Array(RIPPLE_COUNT).fill(RIPPLE_LIFE));
  const lastWord = useRef(0);
  const nextRipple = useRef(0);

  useFrame(({ camera }, dt) => {
    const lv = audioBus.level;

    // Vitesse des anneaux selon l'état : ils s'emballent quand Phare réfléchit.
    const target = (state === "thinking" ? 3 : state === "listening" ? 1.6 : 1) + lv * 1.2;
    speed.current += (target - speed.current) * (1 - Math.exp(-dt * 2));
    const k = reduced ? 0.25 : 1;

    RINGS.forEach((ring, i) => {
      spins.current[i] += dt * ring.speed * speed.current * k;
      const g = ringRefs.current[i];
      if (g) {
        g.rotation.z = spins.current[i];
        g.scale.setScalar(1 + lv * 0.07 * (i + 1) * k);
      }
    });

    // Une nouvelle onde à chaque mot de Phare (ou pic de ta voix).
    // Une onde par mot, mais jamais plus de trois par seconde : lisible, pas frénétique.
    const wordNow =
      audioBus.lastWordAt !== lastWord.current && state === "speaking" && audioBus.lastWordAt - lastWord.current > 320;
    const micPeak = state === "listening" && lv > 0.55 && performance.now() - lastWord.current > 260;
    if (!reduced && (wordNow || micPeak)) {
      lastWord.current = wordNow ? audioBus.lastWordAt : performance.now();
      rippleAge.current[nextRipple.current] = 0;
      nextRipple.current = (nextRipple.current + 1) % RIPPLE_COUNT;
    } else if (wordNow) {
      lastWord.current = audioBus.lastWordAt;
    }

    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const age = (rippleAge.current[i] = Math.min(RIPPLE_LIFE, rippleAge.current[i] + dt));
      const m = rippleRefs.current[i];
      if (!m) continue;
      const p = age / RIPPLE_LIFE;
      m.visible = p < 1;
      m.scale.setScalar(1.7 + p * 4.5);
      m.quaternion.copy(camera.quaternion); // toujours face à toi
      rippleMats[i].opacity = (1 - p) ** 2 * 0.55;
    }
  });

  return (
    <group>
      {RINGS.map((ring, i) => (
        <group key={i} rotation={ring.tilt}>
          <group
            ref={(g) => {
              ringRefs.current[i] = g;
            }}
          >
            <mesh>
              <torusGeometry args={[ring.r, 0.016, 8, 200]} />
              <meshBasicMaterial color="#8fe0ff" transparent opacity={0.7} depthWrite={false} />
            </mesh>
            {/* Graduations le long de l'anneau (une seule géométrie fusionnée) */}
            <mesh geometry={tickGeos[i]}>
              <meshBasicMaterial color="#8fe0ff" transparent opacity={0.55} depthWrite={false} />
            </mesh>
            {/* Perles lumineuses qui voyagent avec l'anneau */}
            {Array.from({ length: ring.beads }, (_, b) => {
              const a = (b / ring.beads) * Math.PI * 2 + i;
              return (
                <mesh key={b} position={[Math.cos(a) * ring.r, Math.sin(a) * ring.r, 0]}>
                  <sphereGeometry args={[0.07, 16, 12]} />
                  <meshBasicMaterial color="white" toneMapped={false} />
                </mesh>
              );
            })}
          </group>
        </group>
      ))}

      {Array.from({ length: RIPPLE_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            rippleRefs.current[i] = m;
          }}
          geometry={rippleGeo}
          material={rippleMats[i]}
          visible={false}
          renderOrder={12}
        />
      ))}
    </group>
  );
}
