import { useEffect, useRef, useState } from "react";
import { nav, navInput } from "./nav";
import { Speaker, voice } from "../voice/speaker";
import { useVoiceStatus } from "../hooks/useVoiceStatus";
import { VoiceSettings } from "./VoiceSettings";

const COARSE = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/** Joystick tactile : on pousse le rond dans la direction où l'on veut aller. */
function Joystick() {
  const knob = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const R = 34;

  const move = (x: number, y: number) => {
    const o = origin.current;
    if (!o) return;
    let dx = x - o.x;
    let dy = y - o.y;
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    navInput.x = dx / R;
    navInput.y = dy / R;
    nav.moved = true;
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const end = () => {
    origin.current = null;
    navInput.x = navInput.y = 0;
    if (knob.current) knob.current.style.transform = "";
  };

  return (
    <div
      className="joystick"
      role="application"
      aria-label="Se déplacer : pousse le rond vers l'avant pour avancer"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const r = e.currentTarget.getBoundingClientRect();
        origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId };
        move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => move(e.clientX, e.clientY)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div ref={knob} className="joystick-knob" />
    </div>
  );
}

/** Boutons ▲ ▼ à maintenir pour monter ou descendre (téléphone). */
function Lift() {
  const hold = (dir: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      navInput.z = dir;
      nav.moved = true;
    },
    onPointerUp: () => (navInput.z = 0),
    onPointerCancel: () => (navInput.z = 0),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  return (
    <div className="lift">
      <button className="lift-btn" aria-label="Monter (maintenir)" {...hold(1)}>
        ▲
      </button>
      <button className="lift-btn" aria-label="Descendre (maintenir)" {...hold(-1)}>
        ▼
      </button>
    </div>
  );
}

/** Plein écran : proposé seulement là où le navigateur l'autorise (pas sur iPhone, par exemple). */
function useFullscreen() {
  const supported = typeof document !== "undefined" && !!document.fullscreenEnabled;
  const [active, setActive] = useState(false);
  useEffect(() => {
    const onChange = () => setActive(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggle = () => {
    const req = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    req?.catch(() => {
      /* refusé par le navigateur ou l'application : le bouton ne fait simplement rien */
    });
  };
  return { supported, active, toggle };
}

/** Couper / rétablir la voix. Rétablir fait dire une courte phrase : ça débloque le son et permet de vérifier. */
function VoiceToggle() {
  const status = useVoiceStatus();
  const on = status === "ok" || status === "unknown";
  const toggle = () => {
    if (on) {
      voice.setMuted(true);
      return;
    }
    voice.setMuted(false);
    const test = new Speaker(
      () => {},
      () => {},
    );
    test.push("Je suis là, Achille. ");
    test.finish();
  };
  return (
    <button
      className={`secondary ${status === "blocked" ? "warn" : ""}`}
      onClick={toggle}
      aria-pressed={on}
      title={status === "blocked" ? "Réactiver la voix" : on ? "Couper la voix" : "Rétablir la voix"}
    >
      <span aria-hidden>{status === "blocked" ? "🔈" : on ? "🔊" : "🔇"}</span>
      <span className="btn-label">{status === "blocked" ? "Réactiver la voix" : on ? "Voix" : "Voix coupée"}</span>
    </button>
  );
}

/** Aide à la navigation (qui s'efface une fois qu'on a bougé), plein écran et retour vers Phare. */
export function NavControls() {
  const [faded, setFaded] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fullscreen = useFullscreen();

  useEffect(() => {
    const id = window.setInterval(() => {
      if (nav.moved) {
        window.setTimeout(() => setFaded(true), 4000);
        window.clearInterval(id);
      }
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      <div className="nav-ui">
        <div className="nav-buttons">
          <VoiceToggle />
          <button
            className="secondary"
            onClick={() => setSettingsOpen((o) => !o)}
            aria-expanded={settingsOpen}
            title="Réglages de la voix"
          >
            <span aria-hidden>⚙</span>
            <span className="btn-label">Réglages</span>
          </button>
          {fullscreen.supported && (
            <button
              className="secondary"
              onClick={fullscreen.toggle}
              aria-pressed={fullscreen.active}
              title={fullscreen.active ? "Quitter le plein écran" : "Plein écran"}
            >
              <span aria-hidden>{fullscreen.active ? "⤡" : "⤢"}</span>
              <span className="btn-label">{fullscreen.active ? "Quitter" : "Plein écran"}</span>
            </button>
          )}
          <button className="secondary" onClick={() => nav.home()} title="Revenir devant Phare">
            <span aria-hidden>◎</span>
            <span className="btn-label">Revenir à Phare</span>
          </button>
          <button
            className="secondary"
            onClick={() => {
              setHelpOpen((o) => !o);
              setFaded(false);
            }}
            aria-expanded={helpOpen || !faded}
            title="Comment se déplacer"
          >
            <span aria-hidden>?</span>
          </button>
        </div>
        {settingsOpen && <VoiceSettings onClose={() => setSettingsOpen(false)} />}
        <p className={`nav-help ${faded && !helpOpen ? "faded" : ""}`} aria-hidden={faded && !helpOpen}>
          {COARSE ? (
            <>
              Glisse pour regarder autour.
              <br />
              Joystick pour avancer, ▲ ▼ pour monter ou descendre, pince pour foncer.
              <br />
              Plus loin = plus ancien.
            </>
          ) : (
            <>
              Glisse pour regarder autour.
              <br />
              <kbd>Z</kbd>
              <kbd>Q</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> ou flèches pour avancer, molette pour foncer,
              <br />
              <kbd>E</kbd> ou <kbd>Espace</kbd> pour monter, <kbd>A</kbd> ou <kbd>C</kbd> pour descendre,{" "}
              <kbd>Maj</kbd> pour aller vite.
              <br />
              Plus loin = plus ancien.
            </>
          )}
        </p>
      </div>
      {COARSE && <Joystick />}
      {COARSE && <Lift />}
    </>
  );
}
