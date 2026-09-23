import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Line, QuadraticBezierLine } from "@react-three/drei";
import { CatmullRomCurve3, Group, Mesh, QuadraticBezierCurve3, Vector3 } from "three";
import { HOLO_RADIUS } from "./Hologram";
import { nodeScreen } from "./nodeScreen";
import type { ConversationSummary } from "../hooks/useConversations";
import type { PhareState } from "../voice/usePhare";

/** Au-delà de ce déplacement du pointeur (px), un clic est un glisser pour regarder : on l'ignore. */
const DRAG_TOLERANCE = 6;

/**
 * Position d'une conversation dans le monde. La profondeur, c'est le temps :
 * la conversation en cours est près de Phare, les plus anciennes s'enfoncent en spirale.
 */
export function timelinePosition(i: number): Vector3 {
  // La conversation en cours flotte en haut à droite de Phare, au-delà de ses anneaux.
  if (i === 0) return new Vector3(2.6, 1.9, -1.2);
  // Les autres s'écartent en spirale large : de l'air entre chaque bulle et chaque fil.
  const angle = 0.5 + i * 1.05;
  const r = 6.5 + i * 0.7;
  return new Vector3(Math.cos(angle) * r, 1 + Math.sin(i * 1.3) * 2.6, -3 - i * 8.5);
}

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
 * Chaque conversation est une petite sphère holographique, reliée au cœur de Phare par un fil de lumière,
 * et à la suivante par le fil du temps.
 */
export function ConversationNodes({ conversations, state, reduced, selected, hovered, onSelect, onHover }: Props) {
  const nodeRefs = useRef(new Map<string, Mesh>());
  const groupRefs = useRef(new Map<string, Group>());
  const tmp = useMemo(() => new Vector3(), []);
  const edge = useMemo(() => new Vector3(), []);

  const layout = useMemo(
    () =>
      conversations.map((c, i) => {
        const end = timelinePosition(i);
        const start = end.clone().normalize().multiplyScalar(HOLO_RADIUS);
        const mid = start.clone().lerp(end, 0.5).add(new Vector3(0, 1.4 + i * 0.15, 0));
        const size = c.current ? 0.42 : Math.min(0.28 + c.count * 0.01, 0.5);
        return { conv: c, start, mid, end, size, curve: new QuadraticBezierCurve3(start, mid, end) };
      }),
    [conversations],
  );

  // Le fil du temps : de Phare, à travers chaque conversation, jusqu'au plus ancien souvenir.
  const timeThread = useMemo(() => {
    if (layout.length < 2) return null;
    const curve = new CatmullRomCurve3([new Vector3(0, 0, 0), ...layout.map((l) => l.end)]);
    return curve.getPoints(layout.length * 24);
  }, [layout]);

  const pulse = useRef<Mesh>(null);
  const flowing = state === "thinking" || state === "speaking";
  const current = layout.find((l) => l.conv.current);
  const lineRefs = useRef<Record<string, { material: { dashOffset: number } } | null>>({});

  useFrame(({ camera, size, clock }, delta) => {
    const t = clock.elapsedTime;
    // Oublie les conversations qui ne sont plus affichées.
    for (const id of nodeScreen.keys()) if (!layout.some((l) => l.conv.id === id)) nodeScreen.delete(id);
    for (const { conv, end, size: r } of layout) {
      const g = groupRefs.current.get(conv.id);
      if (g && !reduced) {
        g.position.y = end.y + Math.sin(t * 0.6 + end.z) * 0.12;
        g.rotation.y += delta * 0.25;
      }
      const mesh = nodeRefs.current.get(conv.id);
      if (!mesh) continue;
      // Position à l'écran, pour les étiquettes HTML.
      mesh.getWorldPosition(tmp);
      const world = tmp.clone();
      const dist = camera.position.distanceTo(world);
      edge.copy(world);
      edge.y += r;
      edge.project(camera);
      tmp.project(camera);
      nodeScreen.set(conv.id, {
        x: ((tmp.x + 1) / 2) * size.width,
        y: ((1 - tmp.y) / 2) * size.height,
        size: Math.abs(edge.y - tmp.y) * (size.height / 2),
        dist,
        onScreen: tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1,
        world,
      });
    }
    const cur = current && lineRefs.current[current.conv.id];
    if (cur) cur.material.dashOffset -= delta * (flowing ? 1.6 : 0.25);
    if (pulse.current && current) {
      pulse.current.visible = flowing;
      if (flowing) {
        const u = (performance.now() / (reduced ? 2400 : 900)) % 1;
        current.curve.getPoint(u, pulse.current.position);
      }
    }
  });

  if (!layout.length) return null;

  const click = (id: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > DRAG_TOLERANCE) return;
    onSelect(id);
  };

  return (
    <group>
      {timeThread && (
        <Line points={timeThread} color="#5cd0ff" lineWidth={1} transparent opacity={0.18} dashed dashSize={0.5} gapSize={0.4} />
      )}
      {layout.map(({ conv, start, mid, end, size }) => {
        const isOpen = selected === conv.id;
        const isHot = conv.current || hovered === conv.id || isOpen;
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
              lineWidth={conv.current ? 1.6 : 1}
              transparent
              opacity={isHot ? 0.85 : 0.22}
              dashed={conv.current}
              dashSize={0.2}
              gapSize={0.1}
              depthWrite={false}
              renderOrder={7}
            />
            <group
              position={end}
              ref={(g) => {
                if (g) groupRefs.current.set(conv.id, g);
                else groupRefs.current.delete(conv.id);
              }}
              scale={hovered === conv.id || isOpen ? 1.15 : 1}
            >
              {/* Coque en fil de fer, comme une mini-sphère holographique */}
              <mesh
                ref={(m) => {
                  // React rappelle ce ref à chaque rendu : on ne touche pas à nodeScreen ici,
                  // sinon un clic pendant ce court instant ne trouverait plus la bulle.
                  if (m) nodeRefs.current.set(conv.id, m);
                  else nodeRefs.current.delete(conv.id);
                }}
                renderOrder={8}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  onHover(conv.id);
                  document.body.style.cursor = "pointer";
                }}
                onPointerOut={() => {
                  onHover(null);
                  document.body.style.cursor = "";
                }}
                onClick={click(conv.id)}
              >
                <icosahedronGeometry args={[size, 1]} />
                <meshBasicMaterial color={isHot ? "#c9f4ff" : "#5cd0ff"} wireframe transparent opacity={0.85} />
              </mesh>
              <mesh renderOrder={8}>
                <sphereGeometry args={[size * 0.85, 24, 16]} />
                <meshBasicMaterial color="#2f9fe0" transparent opacity={0.28} depthWrite={false} />
              </mesh>
              <mesh renderOrder={9}>
                <sphereGeometry args={[size * 0.3, 16, 12]} />
                <meshBasicMaterial color="white" toneMapped={false} />
              </mesh>
            </group>
          </group>
        );
      })}
      <mesh ref={pulse} visible={false} renderOrder={10}>
        <sphereGeometry args={[0.07, 12, 8]} />
        <meshBasicMaterial color="white" toneMapped={false} />
      </mesh>
    </group>
  );
}
