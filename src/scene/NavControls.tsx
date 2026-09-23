import { useEffect, useRef, useState } from "react";
import { nav, navInput } from "./nav";
import { Speaker, voice } from "../voice/speaker";
import { useVoiceStatus } from "../hooks/useVoiceStatus";

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
    <button className={`secondary ${status === "blocked" ? "warn" : ""}`} onClick={toggle} aria-pressed={on}>
      {status === "blocked" ? "🔈 Réactiver la voix" : on ? "🔊 Voix" : "🔇 Voix coupée"}
    </button>
  );
}

/** Aide à la navigation (qui s'efface une fois qu'on a bougé), plein écran et retour vers Phare. */
export function NavControls() {
  const [faded, setFaded] = useState(false);
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
          {fullscreen.supported && (
            <button className="secondary" onClick={fullscreen.toggle} aria-pressed={fullscreen.active}>
              {fullscreen.active ? "⤡ Quitter le plein écran" : "⤢ Plein écran"}
            </button>
          )}
          <button className="secondary" onClick={() => nav.home()}>
            ◎ Revenir à Phare
          </button>
        </div>
        <p className={`nav-help ${faded ? "faded" : ""}`} aria-hidden={faded}>
          {COARSE ? (
            <>
              Glisse pour regarder autour.
              <br />
              Joystick pour avancer, pince pour foncer.
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
              <kbd>A</kbd>/<kbd>E</kbd> pour descendre/monter, <kbd>Maj</kbd> pour courir.
              <br />
              Plus loin = plus ancien.
            </>
          )}
        </p>
      </div>
      {COARSE && <Joystick />}
    </>
  );
}
