/**
 * Petit "bus" partagé entre la voix et la scène 3D.
 * Ce sont des valeurs lues à chaque image par la scène : on évite
 * volontairement l'état React pour ne pas re-rendre 60 fois par seconde.
 */
export const RING_COUNT = 9;

export const audioBus = {
  /** Niveau global du micro, 0..1 */
  micLevel: 0,
  /** Énergie par anneau (du centre vers l'extérieur), 0..1 */
  micBands: new Float32Array(RING_COUNT),
  /** Instant (performance.now) du dernier mot prononcé par la synthèse vocale */
  lastWordAt: 0,
  /** Vrai si la synthèse a déjà émis des événements "mot" (certaines voix n'en émettent pas) */
  hasWordEvents: false,
  /** Impulsion "simulée" du micro quand l'analyse réelle n'est pas disponible */
  fakeMicKick: 0,
};
