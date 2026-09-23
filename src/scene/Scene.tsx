import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Sparkles, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Hologram } from "./Hologram";
import { ConversationNodes } from "./ConversationNodes";
import { NodeLabels } from "./NodeLabels";
import { CameraRig } from "./CameraRig";
import type { PhareState } from "../voice/usePhare";
import type { ConversationSummary } from "../hooks/useConversations";

interface Props {
  state: PhareState;
  reduced: boolean;
  conversations: ConversationSummary[];
  onResume: (id: string) => void;
}

export function Scene({ state, reduced, conversations, onResume }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <>
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, -1.5, 11], fov: 40 }}
      onPointerMissed={() => setSelected(null)}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#071430"]} />

      <Stars radius={50} depth={30} count={reduced ? 500 : 1400} factor={2.5} saturation={0} fade speed={reduced ? 0 : 0.4} />

      <Hologram state={state} reduced={reduced} />
      <ConversationNodes
        conversations={conversations}
        state={state}
        reduced={reduced}
        selected={selected}
        hovered={hovered}
        onSelect={setSelected}
        onHover={setHovered}
      />
      {!reduced && <Sparkles count={40} scale={[8, 6, 4]} size={2} speed={0.25} opacity={0.35} color="#bff2ff" />}
      <CameraRig reduced={reduced} />

      <EffectComposer>
        <Bloom mipmapBlur intensity={0.8} luminanceThreshold={0.7} luminanceSmoothing={0.2} />
        <Vignette offset={0.35} darkness={0.55} />
      </EffectComposer>
    </Canvas>
    <NodeLabels
      conversations={conversations}
      selected={selected}
      hovered={hovered}
      onSelect={setSelected}
      onHover={setHovered}
      onResume={onResume}
    />
    </>
  );
}
