import { useEffect, useRef, useState } from "react";
import { nav, navInput } from "./nav";

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

/** Aide à la navigation (qui s'efface une fois qu'on a bougé) et bouton de retour vers Phare. */
export function NavControls() {
  const [faded, setFaded] = useState(false);

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
        <button className="secondary" onClick={() => nav.home()}>
          ◎ Revenir à Phare
        </button>
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
