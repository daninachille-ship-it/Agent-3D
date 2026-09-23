import { useEffect, useRef, useState } from "react";
import { backend } from "../backend";
import type { Conversation } from "../backend/types";
import type { ConversationSummary } from "../hooks/useConversations";

interface Props {
  summary: ConversationSummary | null;
  onClose: () => void;
  onResume: (id: string) => void;
}

function when(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}, ${time}`;
}

/** Le contenu d'une conversation, à relire ; on peut la reprendre d'un bouton. */
export function ConversationPanel({ summary, onClose, onResume }: Props) {
  const [conv, setConv] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const id = summary?.id ?? null;
  const count = summary?.count ?? 0;

  // Recharge quand on change de conversation ou quand elle s'allonge.
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    void backend.getConversation(id).then((c) => {
      if (!alive) return;
      setConv(c);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id, count]);

  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conv]);

  if (!summary) return null;
  const messages = conv?.id === summary.id ? conv.messages : [];

  return (
    <aside className="panel" aria-label={`Conversation : ${summary.title}`}>
      <header className="panel-head">
        <div>
          <p className="panel-kicker">{summary.current ? "Conversation en cours" : when(summary.updatedAt)}</p>
          <h2 className="panel-title">{summary.title}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer la conversation">
          ×
        </button>
      </header>

      <ol className="panel-messages" ref={list}>
        {loading && !messages.length && <li className="panel-empty">Chargement…</li>}
        {!loading && !messages.length && (
          <li className="panel-empty">Rien encore ici. Pose ta première question à Phare.</li>
        )}
        {messages.map((m, i) => (
          <li key={i} className={`msg msg-${m.role}`}>
            <span className="msg-who">
              {m.role === "user" ? "Toi" : "Phare"} · {when(m.at)}
            </span>
            <p>{m.content}</p>
          </li>
        ))}
      </ol>

      <footer className="panel-foot">
        {summary.current ? (
          <button
            className="primary"
            onClick={() => {
              onClose();
              document.getElementById("ask-input")?.focus();
            }}
          >
            Continuer cette conversation
          </button>
        ) : (
          <button className="primary" onClick={() => onResume(summary.id)}>
            Reprendre cette conversation
          </button>
        )}
      </footer>
    </aside>
  );
}
