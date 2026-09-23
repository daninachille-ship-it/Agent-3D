import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils, PerspectiveCamera } from "three";
import { EGG_HALF_HEIGHT, EGG_HALF_WIDTH } from "./Egg";

/**
 * Distance de caméra pour que l'œuf tienne à l'écran,
 * et décalage vertical pour la placer au-dessus des sous-titres.
 */
function framing(camera: PerspectiveCamera, aspect: number) {
  const tanHalf = Math.tan(MathUtils.degToRad(camera.fov / 2));
  const byHeight = EGG_HALF_HEIGHT / 0.6 / tanHalf; // ~60 % de la hauteur
  const byWidth = EGG_HALF_WIDTH / 0.75 / (tanHalf * aspect); // ~75 % de la largeur
  const distance = Math.max(byHeight, byWidth);
  // Centre de l'œuf remonté d'environ 12 % de la hauteur d'écran.
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
