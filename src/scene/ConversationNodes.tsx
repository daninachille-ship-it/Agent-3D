import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { QuadraticBezierLine } from "@react-three/drei";
import { Group, Mesh, QuadraticBezierCurve3, Vector3 } from "three";
import { HOLO_RADIUS } from "./Hologram";
import { nodeScreen } from "./nodeScreen";
import type { ConversationSummary } from "../hooks/useConversations";
import type { PhareState } from "../voice/usePhare";

const ORBIT_RADIUS = 2.75;

interface Props {
  conversations: ConversationSummary[];
  state: PhareState;
  reduced: boolean;
  selected: string | null;
  hovered: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}

/**
 * Chaque conversation est une petite bulle en orbite, reliée au cœur par un fil lumineux.
 * La conversation en cours est la plus grosse ; son fil s'anime quand Phare réfléchit ou parle.
 */
export function ConversationNodes({ conversations, state, reduced, selected, hovered, onSelect, onHover }: Props) {
  const orbit = useRef<Group>(null);
  const nodeRefs = useRef(new Map<string, Mesh>());
  const world = useMemo(() => new Vector3(), []);
  const edge = useMemo(() => new Vector3(), []);
  const paused = hovered !== null || selected !== null;

  const layout = useMemo(() => {
    const n = conversations.length;
    return conversations.map((c, i) => {
      // La conversation en cours (index 0) devant, légèrement à droite ; les autres réparties autour.
      const angle = 0.35 + (i / Math.max(n, 1)) * Math.PI * 2;
      const end = new Vector3(Math.sin(angle) * ORBIT_RADIUS, 0, Math.cos(angle) * ORBIT_RADIUS);
      const start = end.clone().normalize().multiplyScalar(HOLO_RADIUS);
      const mid = start.clone().lerp(end, 0.5).add(new Vector3(0, 0.45, 0));
      return { conv: c, start, mid, end, curve: new QuadraticBezierCurve3(start, mid, end) };
    });
  }, [conversations]);

  const pulse = useRef<Mesh>(null);
  const flowing = state === "thinking" || state === "speaking";
  const current = layout.find((l) => l.conv.current);
  const lineRefs = useRef<Record<string, { material: { dashOffset: number } } | null>>({});

  useFrame(({ camera, size }, delta) => {
    if (orbit.current && !reduced && !paused) orbit.current.rotation.y += delta * 0.04;

    // Position à l'écran de chaque bulle, pour les étiquettes HTML.
    for (const [id, mesh] of nodeRefs.current) {
      mesh.getWorldPosition(world);
      const r = (mesh.geometry as unknown as { parameters: { radius: number } }).parameters.radius;
      edge.copy(world);
      edge.y += r;
      edge.project(camera);
      world.project(camera);
      nodeScreen.set(id, {
        x: ((world.x + 1) / 2) * size.width,
        y: ((1 - world.y) / 2) * size.height,
        size: Math.abs(edge.y - world.y) * (size.height / 2),
      });
    }
    const cur = current && lineRefs.current[current.conv.id];
    if (cur) cur.material.dashOffset -= delta * (flowing ? 1.6 : 0.25);
    if (pulse.current && current) {
      pulse.current.visible = flowing;
      if (flowing) {
        // Une étincelle qui file du cœur vers la bulle en cours.
        const u = (performance.now() / (reduced ? 2400 : 900)) % 1;
        current.curve.getPoint(u, pulse.current.position);
      }
    }
  });

  if (!layout.length) return null;

  return (
    // Anneau incliné vers la caméra : les bulles tournent autour de la sphère.
    <group rotation={[0.32, 0, 0]}>
      <group ref={orbit}>
        {layout.map(({ conv, start, mid, end }) => {
          const isOpen = selected === conv.id;
          const isHot = conv.current || hovered === conv.id || isOpen;
          const size = conv.current ? 0.2 : Math.min(0.1 + conv.count * 0.006, 0.16);
          return (
            <group key={conv.id}>
              <QuadraticBezierLine
                ref={(l) => {
                  lineRefs.current[conv.id] = l as unknown as { material: { dashOffset: number } } | null;
                }}
                start={start}
                mid={mid}
                end={end}
                color={conv.current ? "#bff2ff" : "#5cd0ff"}
                lineWidth={conv.current ? 2 : 1.2}
                transparent
                opacity={isHot ? 0.9 : 0.45}
                dashed={conv.current}
                dashSize={0.12}
                gapSize={0.06}
                depthWrite={false}
                renderOrder={7}
              />
              <mesh
                position={end}
                renderOrder={8}
                ref={(m) => {
                  if (m) nodeRefs.current.set(conv.id, m);
                  else {
                    nodeRefs.current.delete(conv.id);
                    nodeScreen.delete(conv.id);
                  }
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  onHover(conv.id);
                  document.body.style.cursor = "pointer";
                }}
                onPointerOut={() => {
                  onHover(null);
                  document.body.style.cursor = "";
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(isOpen ? null : conv.id);
                }}
              >
                <sphereGeometry args={[size, 24, 16]} />
                <meshBasicMaterial color={isHot ? "#c9f4ff" : "#5cd0ff"} transparent opacity={0.9} depthWrite={false} />
              </mesh>
              <mesh position={end} renderOrder={9}>
                <sphereGeometry args={[size * 0.4, 12, 8]} />
                <meshBasicMaterial color="white" toneMapped={false} />
              </mesh>
            </group>
          );
        })}
        <mesh ref={pulse} visible={false} renderOrder={10}>
          <sphereGeometry args={[0.06, 12, 8]} />
          <meshBasicMaterial color="white" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
