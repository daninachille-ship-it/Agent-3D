import { useEffect, useRef } from "react";
import { nodeScreen } from "./nodeScreen";
import type { ConversationSummary } from "../hooks/useConversations";

interface Props {
  conversations: ConversationSummary[];
  selected: string | null;
  hovered: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onResume: (id: string) => void;
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
export function NodeLabels({ conversations, selected, hovered, onSelect, onHover, onResume }: Props) {
  const refs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      for (const [id, el] of refs.current) {
        const p = nodeScreen.get(id);
        if (!p) continue;
        el.style.transform = `translate(${p.x}px, ${p.y - p.size - 8}px) translate(-50%, -100%)`;
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
              onClick={() => onSelect(isOpen ? null : conv.id)}
              onFocus={() => onHover(conv.id)}
              onBlur={() => onHover(null)}
              aria-expanded={isOpen}
              aria-label={`Conversation : ${conv.title}${conv.current ? " (en cours)" : ""}`}
            >
              {conv.current ? "● " : ""}
              {conv.title}
            </button>
            {isOpen && (
              <div className="node-details">
                <span>
                  {shortDate(conv.updatedAt)} · {Math.ceil(conv.count / 2)} échange{conv.count > 2 ? "s" : ""}
                </span>
                {conv.current ? (
                  <em>Conversation en cours</em>
                ) : (
                  <button
                    className="node-resume"
                    onClick={() => {
                      onSelect(null);
                      onResume(conv.id);
                    }}
                  >
                    Reprendre
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
