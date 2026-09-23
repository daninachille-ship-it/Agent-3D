import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, ConeGeometry, DoubleSide, Group, ShaderMaterial } from "three";
import type { PhareState } from "../voice/usePhare";

const LENGTH = 9;

const vertex = /* glsl */ `
  varying float vDist;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  uniform float uLength;
  void main() {
    vDist = length(position) / uLength;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  varying float vDist;
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  uniform float uOpacity;
  uniform vec3 uColor;
  void main() {
    float along = pow(1.0 - clamp(vDist, 0.0, 1.0), 1.6);
    float edge = pow(abs(dot(vNormalView, vViewDir)), 1.4);
    float a = along * edge * uOpacity;
    gl_FragColor = vec4(uColor * a * 1.6, a);
  }
`;

/** Faisceau de phare : deux cônes lumineux opposés qui tournent autour de la lentille. */
export function Beam({ state, reduced }: { state: PhareState; reduced: boolean }) {
  const group = useRef<Group>(null);
  const opacity = useRef(0);

  const geometry = useMemo(() => {
    const g = new ConeGeometry(1.1, LENGTH, 48, 1, true);
    // Sommet du cône au centre de la lentille, ouverture vers l'extérieur.
    g.translate(0, -LENGTH / 2, 0);
    return g;
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uOpacity: { value: 0 },
          uLength: { value: LENGTH },
          uColor: { value: new Color(1.0, 0.82, 0.5) },
        },
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
      }),
    [],
  );

  useFrame((_, delta) => {
    const target = state === "thinking" ? 1 : 0;
    opacity.current += (target - opacity.current) * (1 - Math.exp(-delta * 4));
    material.uniforms.uOpacity.value = opacity.current * 0.55;
    if (group.current) {
      group.current.visible = opacity.current > 0.01;
      group.current.rotation.z -= delta * (reduced ? 0.35 : 1.8);
    }
  });

  return (
    <group ref={group} position={[0, 0, 0.35]}>
      <mesh geometry={geometry} material={material} rotation={[0, 0, 0]} />
      <mesh geometry={geometry} material={material} rotation={[0, 0, Math.PI]} />
    </group>
  );
}
