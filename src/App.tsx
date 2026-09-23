import { useEffect, useRef, useState } from "react";
import { Scene } from "./scene/Scene";
import { usePhare, type PhareState } from "./voice/usePhare";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { useHealth } from "./hooks/useHealth";
import { audioBus } from "./voice/audioBus";

const STATE_LABEL: Record<PhareState, string> = {
  idle: "En veille",
  listening: "J'écoute…",
  thinking: "Je réfléchis…",
  speaking: "Je parle",
};

/**
 * Aperçu des animations sans micro : ajoute ?etat=veille, ecoute, reflexion ou parole à l'adresse.
 */
const PREVIEW: Record<string, PhareState> = {
  veille: "idle",
  ecoute: "listening",
  reflexion: "thinking",
  parole: "speaking",
};
const previewState = PREVIEW[new URLSearchParams(window.location.search).get("etat") ?? ""] ?? null;

/** Sur iPhone, le gyroscope demande une autorisation explicite après un geste. */
function askOrientationPermission() {
  const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
  DOE?.requestPermission?.().catch(() => {});
}

export function App() {
  const reduced = useReducedMotion();
  const phare = usePhare();
  const { state, pressStart, pressEnd, stop } = phare;
  const answerRef = useRef<HTMLParagraphElement>(null);
  const health = useHealth();
  const [draft, setDraft] = useState("");

  // En aperçu "écoute", on simule une voix pour faire réagir le nuage.
  useEffect(() => {
    if (previewState !== "listening") return;
    const id = window.setInterval(() => {
      if (Math.random() > 0.3) audioBus.fakeMicKick = 0.5 + Math.random() * 0.5;
    }, 180);
    return () => window.clearInterval(id);
  }, []);

  // Barre espace = appuyer pour parler, Échap = couper.
  useEffect(() => {
    const isTyping = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement && (e.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName));
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) pressStart();
      } else if (e.code === "Escape") {
        stop();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping(e)) {
        e.preventDefault();
        pressEnd();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [pressStart, pressEnd, stop]);

  // Garde la fin de la réponse visible.
  useEffect(() => {
    const el = answerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [phare.answerText]);

  const busy = state === "thinking" || state === "speaking";
  const shown = previewState ?? state;

  return (
    <main className={`app state-${shown}`}>
      <div className="scene">
        <Scene state={shown} reduced={reduced} />
      </div>

      <header className="top">
        <h1>Phare</h1>
        <span className="status" role="status" aria-live="polite">
          <span className="dot" /> {STATE_LABEL[shown]}
        </span>
      </header>

      <section className="subtitles" aria-live="polite">
        {phare.userText && <p className="user">« {phare.userText} »</p>}
        {phare.answerText && (
          <p className="answer" ref={answerRef}>
            {phare.answerText}
          </p>
        )}
        {phare.error && <p className="error">{phare.error}</p>}
        {health === "no-server" && (
          <p className="error">
            Le serveur de Phare ne répond pas. Dans le terminal, lance <code>npm run dev</code> et laisse la fenêtre
            ouverte.
          </p>
        )}
        {health === "no-key" && (
          <p className="error">
            Il manque la clé API. Dans le terminal : <code>Ctrl + C</code>, puis <code>npm run setup</code>, puis{" "}
            <code>npm run dev</code>.
          </p>
        )}
        {!window.isSecureContext && (
          <p className="error">
            Le micro ne marche que sur une page sécurisée. Sur téléphone, lance <code>npm run dev:mobile</code> et ouvre
            l'adresse en https.
          </p>
        )}
        {!phare.supported && (
          <p className="error">
            La reconnaissance vocale n'est pas disponible dans ce navigateur. Utilise Google Chrome sur ordinateur ou sur
            Android. Tu peux quand même écrire à Phare ci-dessous.
          </p>
        )}
      </section>

      <footer className="controls">
        <button
          className="secondary"
          onClick={() => phare.setWakeEnabled(!phare.wakeEnabled)}
          aria-pressed={phare.wakeEnabled}
          disabled={!phare.supported}
          title="Phare écoute en continu et se réveille quand tu dis « Phare »"
        >
          <span className={`switch ${phare.wakeEnabled ? "on" : ""}`} aria-hidden /> « Phare »
        </button>

        <button
          className={`talk ${state === "listening" ? "active" : ""}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            askOrientationPermission();
            pressStart();
          }}
          onPointerUp={pressEnd}
          onPointerCancel={pressEnd}
          onContextMenu={(e) => e.preventDefault()}
          disabled={!phare.supported}
          aria-label="Appuyer pour parler (ou barre espace)"
        >
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden>
            <path
              fill="currentColor"
              d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
            />
          </svg>
        </button>

        {busy ? (
          <button className="secondary stop" onClick={stop} aria-label="Couper (Échap)">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" />
            </svg>
            Couper
          </button>
        ) : (
          <button className="secondary" onClick={() => void phare.newConversation()}>
            Nouvelle conv.
          </button>
        )}
      </footer>

      <form
        className="type"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          setDraft("");
          (document.activeElement as HTMLElement | null)?.blur();
          void phare.ask(text);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ou écris à Phare…"
          aria-label="Écrire à Phare"
          enterKeyHint="send"
        />
      </form>

      <p className="hint">Maintiens le micro ou la barre espace pour parler · Échap pour couper</p>
    </main>
  );
}
