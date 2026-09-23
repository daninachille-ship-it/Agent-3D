import { useEffect, useRef } from "react";
import { nodeScreen } from "./nodeScreen";
import type { ConversationSummary } from "../hooks/useConversations";

interface Props {
  conversations: ConversationSummary[];
  selected: string | null;
  hovered: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? `aujourd'hui, ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
    : d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Étiquettes HTML posées au-dessus des bulles 3D : lisibles, cliquables
 * et accessibles au clavier (Tab), contrairement à un texte dessiné dans la 3D.
 */
export function NodeLabels({ conversations, selected, hovered, onSelect, onHover }: Props) {
  const refs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      for (const [id, el] of refs.current) {
        const p = nodeScreen.get(id);
        const shown = !!p && p.onScreen;
        el.style.visibility = shown ? "" : "hidden";
        if (!p || !shown) continue;
        el.style.transform = `translate(${p.x}px, ${p.y - p.size - 8}px) translate(-50%, -100%)`;
        // Les conversations proches affichent leur titre ; au loin, il s'efface.
        const near = Math.max(0, Math.min(1, (22 - p.dist) / 12));
        el.style.setProperty("--near", String(near));
        // Cliquable dès que l'étiquette est bien lisible.
        el.dataset.clickable = near > 0.35 ? "1" : "";
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="node-layer">
      {conversations.map((conv) => {
        const isOpen = selected === conv.id;
        const isHot = conv.current || hovered === conv.id || isOpen;
        return (
          <div
            key={conv.id}
            ref={(el) => {
              if (el) refs.current.set(conv.id, el);
              else refs.current.delete(conv.id);
            }}
            className={`node-label ${isHot ? "visible" : ""} ${isOpen ? "open" : ""}`}
          >
            <button
              className="node-title"
              onClick={() => onSelect(conv.id)}
              onFocus={() => onHover(conv.id)}
              onBlur={() => onHover(null)}
              aria-pressed={isOpen}
              aria-label={`Ouvrir la conversation : ${conv.title}${conv.current ? " (en cours)" : ""}`}
            >
              {conv.current ? "● " : ""}
              {conv.title}
              <span className="node-date">{shortDate(conv.updatedAt)}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
