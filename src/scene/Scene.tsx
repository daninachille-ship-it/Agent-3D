import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Lens } from "./Lens";
import { Beam } from "./Beam";
import { CameraRig } from "./CameraRig";
import type { PhareState } from "../voice/usePhare";

interface Props {
  state: PhareState;
  reduced: boolean;
}

export function Scene({ state, reduced }: Props) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, -1.5, 11], fov: 40 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      aria-hidden
    >
      <color attach="background" args={["#071430"]} />
      <ambientLight intensity={0.12} color="#8fb0ff" />
      <directionalLight position={[3, 4, 5]} intensity={0.6} color="#dfe8ff" />

      {/* Reflets du laiton : un petit studio de lumière calculé sur place (aucun téléchargement). */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="ring" intensity={1.8} color="#ffe2b0" position={[0, 0, 7]} scale={5} />
        <Lightformer intensity={2.2} color="#9fbfff" position={[-5, 3, 3]} scale={[4, 8, 1]} />
        <Lightformer intensity={2} color="#fff4e0" position={[5, -2, 4]} scale={[3, 6, 1]} />
        <Lightformer form="circle" intensity={1.2} color="#ffd9a0" position={[0, -5, 4]} scale={3} />
        <Lightformer intensity={0.6} color="#355a9c" position={[0, 6, -2]} scale={[10, 2, 1]} />
      </Environment>

      <Stars radius={50} depth={30} count={reduced ? 500 : 1400} factor={2.5} saturation={0} fade speed={reduced ? 0 : 0.4} />

      <Lens state={state} reduced={reduced} />
      <Beam state={state} reduced={reduced} />
      <CameraRig reduced={reduced} />

      <EffectComposer>
        <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.55} luminanceSmoothing={0.2} />
        <Vignette offset={0.35} darkness={0.55} />
      </EffectComposer>
    </Canvas>
  );
}
