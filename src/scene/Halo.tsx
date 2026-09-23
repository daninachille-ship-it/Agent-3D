import { useMemo } from "react";
import { AdditiveBlending, CanvasTexture } from "three";

/** Lueur douce derrière l'œuf, pour l'ambiance. */
export function Halo() {
  const map = useMemo(() => {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(120,150,255,0.35)");
    grad.addColorStop(0.45, "rgba(80,110,220,0.12)");
    grad.addColorStop(1, "rgba(40,60,160,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return new CanvasTexture(c);
  }, []);

  return (
    <sprite position={[0, 0, -1.5]} scale={[9, 9, 1]}>
      <spriteMaterial map={map} blending={AdditiveBlending} depthWrite={false} transparent />
    </sprite>
  );
}
