import { BoxGeometry, BufferGeometry, Matrix4 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Graduations autour d'un cercle, fusionnées en UNE seule géométrie :
 * un seul objet à dessiner au lieu de dizaines (bien plus fluide, surtout sur téléphone).
 */
export function ticksGeometry(
  radius: number,
  count: number,
  opts: { longEvery: number; short: number; long: number; thickness: number },
): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const m = new Matrix4();
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    const len = k % opts.longEvery ? opts.short : opts.long;
    const g = new BoxGeometry(len, opts.thickness, opts.thickness);
    m.makeRotationZ(a).setPosition(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    g.applyMatrix4(m);
    parts.push(g);
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}
