import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils, PerspectiveCamera } from "three";

/** Rayon de la lentille avec son cerclage, en unités 3D. */
const LENS_RADIUS = 2.6;

/**
 * Distance de caméra pour que la lentille tienne à l'écran,
 * et décalage vertical pour la placer au-dessus des sous-titres.
 */
function framing(camera: PerspectiveCamera, aspect: number) {
  const tanHalf = Math.tan(MathUtils.degToRad(camera.fov / 2));
  const byHeight = LENS_RADIUS / 0.62 / tanHalf; // ~62 % de la hauteur
  const byWidth = LENS_RADIUS / 0.9 / (tanHalf * aspect); // ~90 % de la largeur
  const distance = Math.max(byHeight, byWidth);
  // Centre de la lentille remonté d'environ 12 % de la hauteur d'écran.
  const shift = 0.24 * tanHalf * distance;
  return { distance, shift };
}

/**
 * Fait légèrement bouger la caméra avec la souris (ordinateur)
 * ou l'inclinaison du téléphone (gyroscope).
 */
export function CameraRig({ reduced }: { reduced: boolean }) {
  const tilt = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tilt.current = {
        x: MathUtils.clamp(e.gamma / 30, -1, 1),
        // On tient le téléphone incliné d'environ 45° en temps normal.
        y: MathUtils.clamp((e.beta - 45) / 30, -1, 1),
      };
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, []);

  useFrame((state, delta) => {
    const cam = state.camera as PerspectiveCamera;
    const { distance, shift } = framing(cam, state.size.width / state.size.height);
    const amp = reduced ? 0 : distance * 0.1;
    const src = tilt.current ?? state.pointer;
    const tx = src.x * amp;
    const ty = src.y * amp * 0.65 - shift;
    const k = 1 - Math.exp(-delta * 2.5);
    cam.position.x += (tx - cam.position.x) * k;
    cam.position.y += (ty - cam.position.y) * k;
    cam.position.z += (distance - cam.position.z) * Math.min(1, k * 3);
    cam.lookAt(0, -shift, 0);
  });

  return null;
}
