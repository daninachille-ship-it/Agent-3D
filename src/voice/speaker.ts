import { audioBus } from "./audioBus";

/** Nettoie le texte pour la lecture à voix haute. */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/[—–]/g, ", ")
    .replace(/[*_#`>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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
 * Découper en phrases évite aussi le bug de Chrome qui coupe les longues lectures.
 */
export class Speaker {
  private buffer = "";
  private pending = 0;
  private finished = false;
  private cancelled = false;
  private voice: SpeechSynthesisVoice | null = null;

  constructor(
    private onStart: () => void,
    private onDone: () => void,
  ) {}

  static get supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  /** Ajoute un morceau de texte reçu du serveur. */
  push(chunk: string): void {
    this.buffer += chunk;
    // Une phrase se termine par . ! ? … ou un retour à la ligne, suivi d'un espace.
    const re = /[^.!?…\n]+[.!?…]+["»)]?\s+|[^\n]+\n+/g;
    let consumed = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this.buffer))) {
      this.say(m[0]);
      consumed = re.lastIndex;
    }
    this.buffer = this.buffer.slice(consumed);
  }

  /** Plus rien n'arrivera : on lit ce qui reste. */
  finish(): void {
    if (this.buffer.trim()) this.say(this.buffer);
    this.buffer = "";
    this.finished = true;
    this.checkDone();
  }

  cancel(): void {
    this.cancelled = true;
    this.pending = 0;
    this.buffer = "";
    if (Speaker.supported) window.speechSynthesis.cancel();
  }

  private say(raw: string): void {
    const text = cleanForSpeech(raw);
    if (!text || this.cancelled || !Speaker.supported) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    this.voice ??= pickFrenchVoice();
    if (this.voice) u.voice = this.voice;
    u.rate = 1.05;
    u.onstart = () => {
      if (!this.cancelled) this.onStart();
    };
    u.onboundary = (e) => {
      if (e.name === "word" || e.name === undefined) {
        audioBus.lastWordAt = performance.now();
        audioBus.hasWordEvents = true;
      }
    };
    u.onend = u.onerror = () => {
      this.pending = Math.max(0, this.pending - 1);
      this.checkDone();
    };
    this.pending++;
    window.speechSynthesis.speak(u);
  }

  private checkDone(): void {
    if (this.cancelled) return;
    if (this.finished && this.pending === 0) this.onDone();
  }
}

// Chrome charge la liste des voix de façon asynchrone : on la "réveille" au démarrage.
if (Speaker.supported) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", () => window.speechSynthesis.getVoices());
}
