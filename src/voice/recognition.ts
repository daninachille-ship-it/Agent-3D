/**
 * Accès minimal à la Web Speech API (reconnaissance vocale).
 * Chrome l'expose sous le nom "webkitSpeechRecognition".
 */
export interface RecognitionAlternative {
  transcript: string;
}
export interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative;
}
export interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: RecognitionResult };
}
export interface RecognitionErrorEvent {
  readonly error: string;
}
export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const recognitionSupported = getCtor() !== null;

export function createRecognition(continuous: boolean): Recognition {
  const Ctor = getCtor();
  if (!Ctor) throw new Error("Reconnaissance vocale non disponible");
  const rec = new Ctor();
  rec.lang = "fr-FR";
  rec.continuous = continuous;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  return rec;
}

/** Minuscule, sans accents ni ponctuation. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "Phare" est parfois transcrit "far" ou "fard" par la reconnaissance.
const WAKE_RE = /\b(phare|phares|far|fard)\b/;

/** Si le mot d'activation est présent, renvoie le texte qui le suit (éventuellement vide). */
export function afterWakeWord(text: string): string | null {
  const words = text.trim().split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (WAKE_RE.test(normalize(words[i]))) {
      return words
        .slice(i + 1)
        .join(" ")
        .replace(/^[,.!?;:\s]+/, "")
        .trim();
    }
  }
  return null;
}

export function recognitionErrorMessage(code: string): string | null {
  switch (code) {
    case "no-speech":
    case "aborted":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return "Le micro est bloqué. Autorise-le dans la barre d'adresse de Chrome.";
    case "audio-capture":
      return "Aucun micro détecté.";
    case "network":
      return "La reconnaissance vocale a besoin d'Internet.";
    default:
      return `Souci de reconnaissance vocale (${code}).`;
  }
}
