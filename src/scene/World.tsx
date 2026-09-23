import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Grid, Stars } from "@react-three/drei";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, Points } from "three";

/** Profondeurs des portails : ils jalonnent la spirale du temps. */
const PORTALS = [
  { z: -18, r: 9, tilt: 0.15 },
  { z: -42, r: 13, tilt: -0.2 },
  { z: -70, r: 18, tilt: 0.1 },
];

/**
 * Le décor : sol holographique infini, poussière lumineuse à toutes les distances
 * (c'est elle qui donne la sensation de profondeur quand on bouge), portails au loin, étoiles.
 */
export function World({ reduced }: { reduced: boolean }) {
  const dust = useMemo(() => {
    const n = 2200;
    const pos = new Float32Array(n * 3);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rnd() - 0.5) * 110;
      pos[i * 3 + 1] = -3.5 + rnd() * 30;
      pos[i * 3 + 2] = 30 - rnd() * 120;
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    return g;
  }, []);

  const dustRef = useRef<Points>(null);
  const portals = useRef<Group>(null);

  useFrame((_, dt) => {
    if (reduced) return;
    if (dustRef.current) dustRef.current.rotation.y += dt * 0.004;
    portals.current?.children.forEach((p, i) => {
      p.rotation.z += dt * (i % 2 ? -0.05 : 0.04);
    });
  });

  return (
    <>
      <fog attach="fog" args={["#071430", 18, 95]} />
      <Stars radius={140} depth={40} count={reduced ? 800 : 2000} factor={4} saturation={0} fade speed={reduced ? 0 : 0.3} />

      {/* Sol holographique : le repère qui permet de sentir qu'on avance. */}
      <Grid
        position={[0, -4, 0]}
        args={[10, 10]}
        infiniteGrid
        cellSize={1}
        cellThickness={0.6}
        cellColor="#17436b"
        sectionSize={5}
        sectionThickness={1.1}
        sectionColor="#2d8fd6"
        fadeDistance={85}
        fadeStrength={1.6}
      />

      <points ref={dustRef} geometry={dust}>
        <pointsMaterial
          size={0.07}
          color="#a8e4ff"
          transparent
          opacity={0.75}
          sizeAttenuation
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>

      <group ref={portals}>
        {PORTALS.map((p, i) => (
          <group key={i} position={[0, 2, p.z]} rotation={[p.tilt, 0, 0]}>
            <mesh>
              <torusGeometry args={[p.r, 0.05, 8, 160]} />
              <meshBasicMaterial color="#5cd0ff" transparent opacity={0.45} depthWrite={false} />
            </mesh>
            <mesh>
              <torusGeometry args={[p.r * 1.06, 0.02, 6, 160]} />
              <meshBasicMaterial color="#bff2ff" transparent opacity={0.25} depthWrite={false} />
            </mesh>
            {/* Graduations autour du portail, comme un cadran. */}
            {Array.from({ length: 36 }, (_, k) => {
              const a = (k / 36) * Math.PI * 2;
              return (
                <mesh key={k} position={[Math.cos(a) * p.r * 1.12, Math.sin(a) * p.r * 1.12, 0]} rotation={[0, 0, a]}>
                  <boxGeometry args={[k % 3 ? 0.35 : 0.8, 0.04, 0.04]} />
                  <meshBasicMaterial color="#5cd0ff" transparent opacity={0.4} depthWrite={false} />
                </mesh>
              );
            })}
          </group>
        ))}
      </group>
    </>
  );
}
