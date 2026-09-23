import { Vector3 } from "three";

/** Point de départ : face à Phare, un peu en retrait (plus loin sur un écran en hauteur). */
export const HOME = new Vector3(0, 0.4, 8.5);
export function homeFor(aspect: number): Vector3 {
  return HOME.clone().setZ(HOME.z + Math.max(0, 1 - aspect) * 7);
}

/** Joystick tactile : x = pas de côté, y = avant (-1) / arrière (+1). Écrit par le joystick, lu par la caméra. */
export const navInput = { x: 0, y: 0 };

/** Ordres de vol envoyés par l'interface (bouton « Phare », clic sur une conversation). */
export const nav = {
  pending: null as { pos: Vector3; look: Vector3 } | "home" | null,
  /** Vrai dès que la personne s'est déplacée (pour masquer l'aide). */
  moved: false,
  flyTo(pos: Vector3, look: Vector3) {
    this.moved = true;
    this.pending = { pos: pos.clone(), look: look.clone() };
  },
  home() {
    this.pending = "home";
  },
};
