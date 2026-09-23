import { audioBus } from "./audioBus";

/** Nettoie le texte pour la lecture à voix haute. */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/[—–]/g, ", ")
    .replace(/[*_#`>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const supported = typeof window !== "undefined" && "speechSynthesis" in window;

/** Délai au-delà duquel une phrase qui n'a pas commencé est considérée comme bloquée. */
const START_TIMEOUT_MS = 3000;

/** Durée estimée d'un mot prononcé (ms) : plus il est long, plus il dure. */
function wordDuration(word: string, rate: number): number {
  return (110 + word.replace(/[^\p{L}\p{N}]/gu, "").length * 58) / rate;
}

/* --- État de la voix, partagé avec l'interface --- */

/** "ok" : on entend Phare ; "blocked" : le navigateur refuse le son ; "muted" : coupé par toi. */
export type VoiceStatus = "unknown" | "ok" | "blocked" | "muted";
let status: VoiceStatus = supported ? "unknown" : "blocked";
const listeners = new Set<(s: VoiceStatus) => void>();

function setStatus(s: VoiceStatus) {
  if (s === status) return;
  status = s;
  listeners.forEach((l) => l(s));
}

export const voice = {
  get status() {
    return status;
  },
  subscribe(fn: (s: VoiceStatus) => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /**
   * À appeler DIRECTEMENT dans un clic ou un toucher (Envoyer, micro, bouton voix) :
   * les navigateurs, surtout sur téléphone, n'autorisent la voix qu'après un geste.
   */
  unlock() {
    if (!supported || status === "muted") return;
    try {
      window.speechSynthesis.resume();
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch {
      /* ignoré : la vraie phrase dira si ça marche */
    }
  },
  setMuted(muted: boolean) {
    if (muted) {
      if (supported) window.speechSynthesis.cancel();
      setStatus("muted");
    } else {
      setStatus(supported ? "unknown" : "blocked");
      voice.unlock();
    }
  },
};

function pickFrenchVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const fr = voices.filter((v) => v.lang?.toLowerCase().startsWith("fr"));
  const frFR = fr.filter((v) => v.lang.replace("_", "-").toLowerCase() === "fr-fr");
  const pool = frFR.length ? frFR : fr;
  return (
    pool.find((v) => /google/i.test(v.name)) ??
    pool.find((v) => /natural|premium|enhanced/i.test(v.name)) ??
    pool[0] ??
    null
  );
}

/**
 * Lit la réponse phrase par phrase, au fur et à mesure qu'elle arrive.
 * Chaque mot fait "pulser" Phare (audioBus.lastWordAt) : grâce aux événements de la voix
 * quand elle en donne, sinon par une estimation de la durée de chaque mot.
 * Si le son est bloqué ou coupé, Phare "parle" quand même visuellement, au même rythme.
 */
export class Speaker {
  private queue: string[] = [];
  private playing = false;
  private finished = false;
  private cancelled = false;
  private started = false;
  private timers: number[] = [];
  private voice: SpeechSynthesisVoice | null = null;
  private readonly rate = 1.05;

  constructor(
    private onStart: () => void,
    private onDone: () => void,
  ) {}

  static get supported(): boolean {
    return supported;
  }

  /** Ajoute un morceau de texte reçu. */
  push(chunk: string): void {
    this.buffer += chunk;
    // Une phrase se termine par . ! ? … ou un retour à la ligne, suivi d'un espace.
    const re = /[^.!?…\n]+[.!?…]+["»)]?\s+|[^\n]+\n+/g;
    let consumed = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this.buffer))) {
      this.enqueue(m[0]);
      consumed = re.lastIndex;
    }
    this.buffer = this.buffer.slice(consumed);
  }
  private buffer = "";

  /** Plus rien n'arrivera : on lit ce qui reste. */
  finish(): void {
    if (this.buffer.trim()) this.enqueue(this.buffer);
    this.buffer = "";
    this.finished = true;
    this.next();
  }

  cancel(): void {
    this.cancelled = true;
    this.queue = [];
    this.buffer = "";
    this.clearTimers();
    if (supported) window.speechSynthesis.cancel();
  }

  private enqueue(raw: string) {
    const text = cleanForSpeech(raw);
    if (!text || this.cancelled) return;
    this.queue.push(text);
    this.next();
  }

  private clearTimers() {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
  }

  private markStarted() {
    if (!this.started && !this.cancelled) {
      this.started = true;
      this.onStart();
    }
  }

  /** Fait pulser Phare sur chaque mot de `text`, à partir de maintenant. Renvoie la durée totale. */
  private pulseWords(text: string, rate: number): number {
    let t = 0;
    for (const word of text.split(/\s+/)) {
      this.timers.push(
        window.setTimeout(() => {
          audioBus.lastWordAt = performance.now();
        }, t),
      );
      t += wordDuration(word, rate);
    }
    return t;
  }

  private next() {
    if (this.playing || this.cancelled) return;
    const text = this.queue.shift();
    if (!text) {
      if (this.finished) this.onDone();
      return;
    }
    this.playing = true;
    const done = () => {
      this.clearTimers();
      this.playing = false;
      this.next();
    };
    if (status === "blocked" || status === "muted" || !supported) this.playSilently(text, done);
    else this.playAloud(text, done);
  }

  /** Sans son : Phare "parle" en rythme, pendant la durée estimée de la phrase. */
  private playSilently(text: string, done: () => void) {
    this.markStarted();
    const total = this.pulseWords(text, this.rate);
    this.timers.push(window.setTimeout(done, total + 250));
  }

  private playAloud(text: string, done: () => void) {
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    this.voice ??= pickFrenchVoice();
    if (this.voice) u.voice = this.voice;
    u.rate = this.rate;

    let began = false;
    let realBoundaries = false;
    let finished = false;
    const end = () => {
      if (finished) return;
      finished = true;
      done();
    };

    // Si la phrase ne démarre jamais, le son est bloqué : on continue sans.
    const watchdog = window.setTimeout(() => {
      if (began || this.cancelled) return;
      finished = true;
      synth.cancel();
      setStatus("blocked");
      this.playSilently(text, () => {
        this.playing = false;
        this.next();
      });
    }, START_TIMEOUT_MS);

    u.onstart = () => {
      began = true;
      window.clearTimeout(watchdog);
      setStatus("ok");
      this.markStarted();
      // En attendant (ou à défaut) des vrais événements "mot", on estime le rythme.
      this.pulseWords(text, this.rate);
    };
    u.onboundary = (e) => {
      if (e.name !== "word" && e.name !== undefined) return;
      if (!realBoundaries) {
        realBoundaries = true;
        this.clearTimers(); // les vrais mots remplacent l'estimation
      }
      audioBus.lastWordAt = performance.now();
    };
    u.onend = () => {
      window.clearTimeout(watchdog);
      end();
    };
    u.onerror = (e) => {
      window.clearTimeout(watchdog);
      if (e.error === "interrupted" || e.error === "canceled" || this.cancelled) return end();
      // "not-allowed" & co : le navigateur refuse le son.
      setStatus("blocked");
      finished = true;
      this.clearTimers();
      this.playSilently(text, () => {
        this.playing = false;
        this.next();
      });
    };

    synth.resume(); // Chrome reste parfois en pause
    synth.speak(u);
  }
}

// Chrome charge la liste des voix de façon asynchrone : on la "réveille" au démarrage.
if (supported) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", () => window.speechSynthesis.getVoices());
}
