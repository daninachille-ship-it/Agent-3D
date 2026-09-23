/**
 * Petit "bus" partagé entre la voix et la scène 3D.
 * Ce sont des valeurs lues à chaque image par la scène : on évite
 * volontairement l'état React pour ne pas re-rendre 60 fois par seconde.
 */
export const BAND_COUNT = 9;

export const audioBus = {
  /** Niveau global du micro, 0..1 */
  micLevel: 0,
  /** Énergie par bande de fréquence (graves vers aigus), 0..1 */
  micBands: new Float32Array(BAND_COUNT),
  /** Instant (performance.now) du dernier mot prononcé par la synthèse vocale */
  lastWordAt: 0,
  /** Intensité actuelle de la voix (la tienne ou celle de Phare), 0..1, lissée : lue par tout le décor. */
  level: 0,
  /** Impulsion "simulée" du micro quand l'analyse réelle n'est pas disponible */
  fakeMicKick: 0,
};
