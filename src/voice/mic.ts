import { audioBus, BAND_COUNT } from "./audioBus";

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let stream: MediaStream | null = null;
let freq: Uint8Array<ArrayBuffer> | null = null;
let wave: Uint8Array<ArrayBuffer> | null = null;
let starting: Promise<void> | null = null;

/**
 * Sur Chrome Android, ouvrir le micro en parallèle de la reconnaissance vocale
 * peut couper cette dernière. On y simule donc le niveau à partir des résultats.
 */
export const canAnalyseMic =
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  !/Android/i.test(navigator.userAgent);

export function startMic(): Promise<void> {
  if (!canAnalyseMic || analyser) return Promise.resolve();
  if (starting) return starting;
  starting = (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      src.connect(analyser);
      freq = new Uint8Array(analyser.frequencyBinCount);
      wave = new Uint8Array(analyser.fftSize);
    } catch (err) {
      console.warn("Analyse du micro indisponible :", err);
      stopMic();
    } finally {
      starting = null;
    }
  })();
  return starting;
}

export function stopMic(): void {
  stream?.getTracks().forEach((t) => t.stop());
  ctx?.close().catch(() => {});
  stream = null;
  ctx = null;
  analyser = null;
  freq = null;
  wave = null;
  audioBus.micLevel = 0;
  audioBus.micBands.fill(0);
}

/** Appelé à chaque image par la scène : met à jour niveau et bandes. */
export function sampleMic(delta: number): void {
  if (analyser && ctx && freq && wave) {
    analyser.getByteTimeDomainData(wave);
    let sum = 0;
    for (let i = 0; i < wave.length; i++) {
      const v = (wave[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / wave.length);
    audioBus.micLevel = Math.min(1, rms * 5);

    analyser.getByteFrequencyData(freq);
    const binHz = ctx.sampleRate / analyser.fftSize;
    // Bandes logarithmiques de 90 Hz à 5 kHz : la plage utile de la voix.
    const lo = 90;
    const hi = 5000;
    for (let b = 0; b < BAND_COUNT; b++) {
      const f0 = lo * Math.pow(hi / lo, b / BAND_COUNT);
      const f1 = lo * Math.pow(hi / lo, (b + 1) / BAND_COUNT);
      const i0 = Math.max(1, Math.floor(f0 / binHz));
      const i1 = Math.max(i0 + 1, Math.ceil(f1 / binHz));
      let acc = 0;
      for (let i = i0; i < i1; i++) acc += freq[i];
      const v = acc / (i1 - i0) / 255;
      // Les aigus ont moins d'énergie : on les remonte un peu.
      audioBus.micBands[b] = Math.min(1, v * (1.2 + b * 0.12));
    }
    return;
  }

  // Mode simulé : une impulsion à chaque mot reconnu, qui retombe doucement.
  audioBus.fakeMicKick = Math.max(0, audioBus.fakeMicKick - delta * 1.8);
  const k = audioBus.fakeMicKick;
  const t = performance.now() / 1000;
  audioBus.micLevel = k;
  for (let b = 0; b < BAND_COUNT; b++) {
    audioBus.micBands[b] = k * (0.55 + 0.45 * Math.sin(t * 7 + b * 1.3));
  }
}
