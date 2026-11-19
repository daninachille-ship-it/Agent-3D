// Single source of truth for timing, shared by the picture (director) and the soundtrack generator.
export const DURATION = 75;
export const BPM = 120;

export const TABLEAUX = [30, 32, 34, 36, 38, 40.5]; // seq 4 mini-scenes start times

export const SEGMENTS = [
  { t0: 0, t1: 4.85, shot: 'earth' },
  { t0: 4.85, t1: 5.25, from: 'earth', to: 'old', mode: 1 },
  { t0: 5.25, t1: 19.55, shot: 'old' },
  { t0: 19.55, t1: 20.45, from: 'old', to: 'kaz', mode: 2 },
  { t0: 20.45, t1: 29.75, shot: 'kaz' },
  { t0: 29.75, t1: 30.25, from: 'kaz', to: 'gallery', mode: 3 },
  { t0: 30.25, t1: 42.7, shot: 'gallery' },
  { t0: 42.7, t1: 43.2, from: 'gallery', to: 'map1', mode: 5 },
  { t0: 43.2, t1: 44.7, shot: 'map1' },
  { t0: 44.7, t1: 45.15, from: 'map1', to: 'wieliczka', mode: 5 },
  { t0: 45.15, t1: 49.1, shot: 'wieliczka' },
  { t0: 49.1, t1: 49.6, from: 'wieliczka', to: 'map2', mode: 0 },
  { t0: 49.6, t1: 50.2, shot: 'map2' },
  { t0: 50.2, t1: 50.9, from: 'map2', to: 'memorial', mode: 4 },
  { t0: 50.9, t1: 54.6, shot: 'memorial' },
  { t0: 54.6, t1: 55.5, from: 'memorial', to: 'late', mode: 4 },
  { t0: 55.5, t1: 75.01, shot: 'late' },
];

// Big hits: camera shake + flash + bass impact in the score
export const IMPACTS = [
  { t: 5.05, k: 1.0 }, { t: 5.5, k: 1.0 }, { t: 6.0, k: 0.8 }, { t: 6.75, k: 0.5 },
  { t: 8.5, k: 0.7 }, { t: 10.0, k: 0.7 }, { t: 11.5, k: 0.7 }, { t: 13.0, k: 0.6 }, { t: 18.0, k: 0.9 },
  { t: 20.0, k: 0.6 }, { t: 30.0, k: 0.8 }, { t: 32, k: 0.5 }, { t: 34, k: 0.5 }, { t: 36, k: 0.5 }, { t: 38, k: 0.5 }, { t: 40.5, k: 0.5 },
  { t: 43.0, k: 0.6 }, { t: 45.0, k: 0.7 }, { t: 47.0, k: 0.4 },
  { t: 65.5, k: 1.0 }, { t: 66.0, k: 0.7 }, { t: 68.5, k: 0.6 }, { t: 69.5, k: 0.6 }, { t: 70.5, k: 0.7 }, { t: 72.0, k: 1.0 },
];
// Whooshes (start, end) for transitions & fast camera moves
export const WHOOSHES = [
  [3.6, 5.05], [7.8, 8.6], [9.2, 9.9], [13.8, 14.6], [15.8, 16.8], [19.2, 20.2], [26.0, 26.8], [29.5, 30.1],
  [31.6, 32.05], [33.6, 34.05], [35.6, 36.05], [37.6, 38.05], [40.1, 40.55], [42.5, 43.1], [44.5, 45.1], [45.2, 46.8], [64.4, 65.5], [66.5, 68.0],
];
// Section markers for the score
export const SECTIONS = {
  intro: [0, 5.05], eruption: [5.05, 8.5], oldTown: [8.5, 20], kazimierz: [20, 30], experiences: [30, 43],
  wieliczka: [43, 49.2], memorial: [49.2, 55.2], march: [55.2, 65.5], finale: [65.5, 75],
};
