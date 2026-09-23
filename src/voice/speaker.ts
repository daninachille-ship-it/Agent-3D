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

/**
 * Vitesse de la voix, en millisecondes par caractère (à vitesse 1). Valeur de départ prudente,
 * puis recalée sur la durée réelle de chaque phrase prononcée : l'animation suit TA voix.
 */
let msPerChar = 78;

/** Durée estimée d'un mot prononcé (ms) : proportionnelle à sa longueur, espace compris. */
function wordDuration(word: string, rate: number): number {
  return ((word.replace(/[^\p{L}\p{N}]/gu, "").length + 1.3) * msPerChar) / rate;
}

/** Après une phrase lue sans événements "mot" : on apprend la vraie vitesse de la voix. */
function calibrate(text: string, elapsedMs: number, rate: number) {
  const chars = text.replace(/\s+/g, " ").length;
  if (chars < 12 || elapsedMs < 400) return;
  const measured = (elapsedMs * rate) / chars;
  msPerChar = Math.min(140, Math.max(45, msPerChar * 0.5 + measured * 0.5));
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

/* --- Choix de la voix --- */

export interface VoicePrefs {
  /** Voix choisie à la main (sinon : la meilleure voix féminine trouvée). */
  voiceURI: string | null;
  rate: number;
  pitch: number;
}

const PREFS_KEY = "phare-voice";
const DEFAULT_PREFS: VoicePrefs = { voiceURI: null, rate: 1, pitch: 1 };

function loadPrefs(): VoicePrefs {
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<VoicePrefs>) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

let prefs = loadPrefs();

export function getVoicePrefs(): VoicePrefs {
  return prefs;
}

export function setVoicePrefs(patch: Partial<VoicePrefs>): void {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* réglage gardé le temps de la visite */
  }
}

// Voix connues pour être féminines, et les plus naturelles (Edge « Natural », Apple « Premium »…).
const FEMALE = /denise|vivienne|eloise|éloïse|julie|hortense|am[ée]lie|audrey|aur[ée]lie|marie|l[ée]a\b|chantal|sylvie|c[ée]line|virginie|brigitte|coralie|jacqueline|google fran[çc]ais|google french/i;
const MALE = /thomas|henri|paul|r[ée]my|jacques|nicolas|daniel|antoine|j[ée]r[ôo]me|guillaume|mathieu|yves|fabrice|alain|claude\b|gr[ée]goire|damien|olivier/i;
const HUMAN = /natural|neural|online|premium|enhanced|am[ée]lior[ée]e?/i;

function score(v: SpeechSynthesisVoice): number {
  const lang = v.lang?.replace("_", "-").toLowerCase() ?? "";
  let s = lang === "fr-fr" ? 4 : lang.startsWith("fr") ? 2 : -100;
  if (HUMAN.test(v.name)) s += 6;
  if (FEMALE.test(v.name)) s += 5;
  if (MALE.test(v.name)) s -= 8;
  if (!v.localService) s += 1; // les voix en ligne sont souvent plus naturelles
  return s;
}

export interface VoiceOption {
  uri: string;
  label: string;
  female: boolean;
}

/** Les voix françaises de l'appareil, les plus naturelles et féminines d'abord. */
export function listFrenchVoices(): VoiceOption[] {
  if (!supported) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang?.toLowerCase().startsWith("fr"))
    .sort((a, b) => score(b) - score(a))
    .map((v) => ({
      uri: v.voiceURI,
      label: v.name.replace(/^Microsoft\s+/, "").replace(/\s+-\s+.*$/, ""),
      female: FEMALE.test(v.name),
    }));
}

function pickFrenchVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const chosen = prefs.voiceURI ? voices.find((v) => v.voiceURI === prefs.voiceURI) : undefined;
  if (chosen) return chosen;
  const best = voices.filter((v) => v.lang?.toLowerCase().startsWith("fr")).sort((a, b) => score(b) - score(a))[0];
  return best ?? null;
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
  private readonly rate = prefs.rate;
  private readonly pitch = prefs.pitch;

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
    u.pitch = this.pitch;

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

    let startedAt = 0;
    u.onstart = () => {
      began = true;
      startedAt = performance.now();
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
      if (began && !realBoundaries) calibrate(text, performance.now() - startedAt, this.rate);
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
