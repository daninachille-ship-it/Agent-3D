import type { Vector3 } from "three";

/**
 * Chaque bulle de conversation vue depuis la caméra, mise à jour à chaque image :
 * position à l'écran (pixels), distance, visibilité, et position dans le monde (pour y voler).
 */
export const nodeScreen = new Map<
  string,
  { x: number; y: number; size: number; dist: number; onScreen: boolean; world: Vector3 }
>();
