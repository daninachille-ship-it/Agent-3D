import { memo, useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Vector3 } from "three";
import { Hologram } from "./Hologram";
import { ConversationNodes } from "./ConversationNodes";
import { ConversationPanel } from "./ConversationPanel";
import { NodeLabels } from "./NodeLabels";
import { Navigator } from "./Navigator";
import { NavControls } from "./NavControls";
import { Orbits } from "./Orbits";
import { World } from "./World";
import { homeFor, nav } from "./nav";
import { nodeScreen } from "./nodeScreen";
import type { PhareState } from "../voice/usePhare";
import type { ConversationSummary } from "../hooks/useConversations";

interface Props {
  state: PhareState;
  reduced: boolean;
  conversations: ConversationSummary[];
  onResume: (id: string) => void;
}

const COARSE = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/**
 * Un monde à explorer : Phare au centre, tes conversations en spirale dans la profondeur du temps.
 * `memo` : la scène ne se recalcule pas à chaque mot affiché en sous-titre.
 */
export const Scene = memo(function Scene({ state, reduced, conversations, onResume }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  // Qualité adaptative : on baisse la résolution si l'appareil peine, on la remonte s'il a de la marge.
  const [dpr, setDpr] = useState(COARSE ? 1.25 : 1.5);

  // Ouvrir une conversation, c'est voler jusqu'à elle et afficher son contenu.
  const select = useCallback((id: string | null) => {
    setSelected(id);
    const target = id ? nodeScreen.get(id)?.world : null;
    if (!target) return;
    const away = target.clone().setY(0).normalize();
    const viewpoint = target.clone().add(away.multiplyScalar(3)).add(new Vector3(0, 0.8, 4.5));
    nav.flyTo(viewpoint, target);
  }, []);

  const selectedSummary = conversations.find((c) => c.id === selected) ?? null;

  return (
    <>
      <Canvas
        dpr={dpr}
        camera={{ position: homeFor(window.innerWidth / window.innerHeight).toArray(), fov: 55, near: 0.1, far: 400 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <PerformanceMonitor
          onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))}
          onIncline={() => setDpr((d) => Math.min(COARSE ? 1.5 : 2, d + 0.25))}
          flipflops={3}
          onFallback={() => setDpr(1)}
        />
        <color attach="background" args={["#071430"]} />

        <World reduced={reduced} />
        <Hologram state={state} reduced={reduced} />
        <Orbits state={state} reduced={reduced} />
        <ConversationNodes
          conversations={conversations}
          state={state}
          reduced={reduced}
          selected={selected}
          hovered={hovered}
          onSelect={select}
          onHover={setHovered}
        />
        <Navigator reduced={reduced} />

        <EffectComposer multisampling={COARSE ? 0 : 2}>
          <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.7} luminanceSmoothing={0.2} resolutionScale={0.5} />
          <Vignette offset={0.35} darkness={0.55} />
        </EffectComposer>
      </Canvas>
      <NodeLabels
        conversations={conversations}
        selected={selected}
        hovered={hovered}
        onSelect={select}
        onHover={setHovered}
      />
      <NavControls />
      <ConversationPanel
        summary={selectedSummary}
        onClose={() => setSelected(null)}
        onResume={(id) => {
          onResume(id);
        }}
      />
    </>
  );
});
