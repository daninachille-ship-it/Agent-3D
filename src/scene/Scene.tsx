import { useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Vector3 } from "three";
import { Hologram } from "./Hologram";
import { ConversationNodes } from "./ConversationNodes";
import { NodeLabels } from "./NodeLabels";
import { Navigator } from "./Navigator";
import { NavControls } from "./NavControls";
import { World } from "./World";
import { Orbits } from "./Orbits";
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

/** Un monde à explorer : Phare au centre, tes conversations en spirale dans la profondeur du temps. */
export function Scene({ state, reduced, conversations, onResume }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Ouvrir une conversation, c'est aussi voler jusqu'à elle.
  const select = useCallback((id: string | null) => {
    setSelected(id);
    const target = id ? nodeScreen.get(id)?.world : null;
    if (!target) return;
    const away = target.clone().setY(0).normalize();
    const viewpoint = target.clone().add(away.multiplyScalar(3)).add(new Vector3(0, 0.8, 4.5));
    nav.flyTo(viewpoint, target);
  }, []);

  return (
    <>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: homeFor(window.innerWidth / window.innerHeight).toArray(), fov: 55, near: 0.1, far: 400 }}
        onPointerMissed={(e) => {
          // Un clic dans le vide ferme la conversation ouverte (pas un glisser pour regarder).
          if (e.type === "click") setSelected(null);
        }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
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

        <EffectComposer>
          <Bloom mipmapBlur intensity={0.8} luminanceThreshold={0.7} luminanceSmoothing={0.2} />
          <Vignette offset={0.35} darkness={0.55} />
        </EffectComposer>
      </Canvas>
      <NodeLabels
        conversations={conversations}
        selected={selected}
        hovered={hovered}
        onSelect={select}
        onHover={setHovered}
        onResume={onResume}
      />
      <NavControls />
    </>
  );
}
