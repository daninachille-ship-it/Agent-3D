import { Canvas } from "@react-three/fiber";
import { Sparkles, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Egg } from "./Egg";
import { Halo } from "./Halo";
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
      dpr={[1, 1.75]}
      camera={{ position: [0, -1.5, 11], fov: 40 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      aria-hidden
    >
      <color attach="background" args={["#071430"]} />

      <Stars radius={50} depth={30} count={reduced ? 500 : 1400} factor={2.5} saturation={0} fade speed={reduced ? 0 : 0.4} />

      <Halo />
      <Egg state={state} reduced={reduced} />
      {!reduced && <Sparkles count={40} scale={[7, 6, 4]} size={2} speed={0.25} opacity={0.35} color="#cfe0ff" />}
      <Beam state={state} reduced={reduced} />
      <CameraRig reduced={reduced} />

      <EffectComposer>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.6} luminanceSmoothing={0.25} />
        <Vignette offset={0.35} darkness={0.55} />
      </EffectComposer>
    </Canvas>
  );
}
