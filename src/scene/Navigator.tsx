import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { homeFor, nav, navInput } from "./nav";
import { backend } from "../backend";

const LOOK_SPEED = 0.0042;
const WALK_SPEED = 6;
const RUN_SPEED = 16;
/** Vol libre : on peut aller partout, au-dessus comme en dessous du sol, dans une grande bulle. */
const WORLD_RADIUS = 160;
/** Sans micro (version en ligne), la barre espace sert à monter. */
const SPACE_TO_FLY = !backend.voiceInput;

function isTyping(e: KeyboardEvent) {
  const t = e.target;
  return t instanceof HTMLElement && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName));
}

function anglesTo(from: Vector3, to: Vector3) {
  const d = to.clone().sub(from).normalize();
  return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(Math.max(-1, Math.min(1, d.y))) };
}

/**
 * Caméra libre : on regarde en glissant, on avance au clavier, à la molette,
 * au joystick ou en pinçant. Les vols (vers une conversation, retour à Phare) sont animés.
 */
export function Navigator({ reduced }: { reduced: boolean }) {
  const { camera, gl, size } = useThree();
  const s = useRef({
    pos: homeFor(size.width / size.height),
    vel: new Vector3(),
    yaw: 0,
    pitch: -0.03,
    boost: 0, // élan donné par la molette ou le pincement
    keys: new Set<string>(),
    fly: null as null | { from: Vector3; to: Vector3; y0: number; y1: number; p0: number; p1: number; t: number },
  });

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none";
    const st = s.current;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;

    const pinchDist = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) pinch = pinchDist();
    };
    const onMove = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      if (pointers.size === 1) {
        st.yaw -= (e.clientX - p.x) * LOOK_SPEED;
        st.pitch = Math.max(-1.35, Math.min(1.35, st.pitch - (e.clientY - p.y) * LOOK_SPEED));
        st.fly = null;
        nav.moved = true;
      }
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 2) {
        const d = pinchDist();
        st.boost += (d - pinch) * 0.04;
        pinch = d;
        st.fly = null;
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 2) pinch = pinchDist();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      st.boost += -e.deltaY * 0.012;
      st.fly = null;
      nav.moved = true;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      st.keys.add(e.code);
      if (/^(Arrow|KeyW|KeyA|KeyS|KeyD|KeyQ|KeyE|KeyC|PageUp|PageDown)/.test(e.code) || (SPACE_TO_FLY && e.code === "Space")) {
        st.fly = null;
        nav.moved = true;
        if (e.code.startsWith("Arrow") || e.code.startsWith("Page") || e.code === "Space") e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => st.keys.delete(e.code);
    const onBlur = () => st.keys.clear();

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [gl]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const st = s.current;

    // Nouvel ordre de vol.
    if (nav.pending) {
      const { pos, look } =
        nav.pending === "home"
          ? { pos: homeFor(state.size.width / state.size.height), look: new Vector3(0, 0, 0) }
          : nav.pending;
      nav.pending = null;
      const a = anglesTo(pos, look);
      // Tourner par le plus court chemin.
      let y1 = a.yaw;
      while (y1 - st.yaw > Math.PI) y1 -= Math.PI * 2;
      while (y1 - st.yaw < -Math.PI) y1 += Math.PI * 2;
      st.fly = { from: st.pos.clone(), to: pos, y0: st.yaw, y1, p0: st.pitch, p1: a.pitch, t: reduced ? 1 : 0 };
      st.vel.set(0, 0, 0);
      st.boost = 0;
    }

    if (st.fly) {
      const f = st.fly;
      // Durée réelle, même si l'affichage rame.
      f.t = Math.min(1, f.t + Math.min(rawDt, 0.25) / 1.6);
      const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2; // accélère puis freine
      st.pos.lerpVectors(f.from, f.to, e);
      st.yaw = f.y0 + (f.y1 - f.y0) * e;
      st.pitch = f.p0 + (f.p1 - f.p0) * e;
      if (f.t >= 1) st.fly = null;
    } else {
      const k = st.keys;
      const fwd = new Vector3(-Math.sin(st.yaw) * Math.cos(st.pitch), Math.sin(st.pitch), -Math.cos(st.yaw) * Math.cos(st.pitch));
      const right = new Vector3(Math.cos(st.yaw), 0, -Math.sin(st.yaw));
      const f =
        (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) - navInput.y;
      const r =
        (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0) + navInput.x;
      // Sur un clavier AZERTY, KeyQ/KeyE sont les touches A et E.
      const up = k.has("KeyE") || k.has("PageUp") || (SPACE_TO_FLY && k.has("Space"));
      const down = k.has("KeyQ") || k.has("KeyC") || k.has("PageDown");
      const u = (up ? 1 : 0) - (down ? 1 : 0) + navInput.z;
      const speed = k.has("ShiftLeft") || k.has("ShiftRight") ? RUN_SPEED : WALK_SPEED;
      const target = fwd.multiplyScalar(f).add(right.multiplyScalar(r)).add(new Vector3(0, u, 0)).multiplyScalar(speed);
      st.vel.lerp(target, 1 - Math.exp(-dt * 6));
      st.pos.addScaledVector(st.vel, dt);

      // Élan de la molette / du pincement, qui s'amortit.
      const step = st.boost * (1 - Math.exp(-dt * 5));
      st.boost -= step;
      st.pos.add(
        new Vector3(-Math.sin(st.yaw) * Math.cos(st.pitch), Math.sin(st.pitch), -Math.cos(st.yaw) * Math.cos(st.pitch)).multiplyScalar(step),
      );

      if (st.pos.length() > WORLD_RADIUS) st.pos.setLength(WORLD_RADIUS);
    }

    camera.position.copy(st.pos);
    camera.rotation.set(st.pitch, st.yaw, 0, "YXZ");
  });

  return null;
}
