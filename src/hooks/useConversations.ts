import { useCallback, useEffect, useState } from "react";

export interface ConversationSummary {
  id: string;
  title: string;
  startedAt: string;
  updatedAt: string;
  count: number;
  current: boolean;
}

/** Liste des conversations récentes (la conversation en cours en premier). */
export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (res.ok) setConversations((await res.json()) as ConversationSummary[]);
    } catch {
      /* serveur absent : le bandeau de diagnostic s'en charge */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { conversations, refresh };
}
