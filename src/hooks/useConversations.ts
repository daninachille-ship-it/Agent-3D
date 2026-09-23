import { useCallback, useEffect, useState } from "react";
import { backend, type ConversationSummary } from "../backend";

export type { ConversationSummary };

/** Liste des conversations récentes (la conversation en cours en premier). */
export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  const refresh = useCallback(async () => {
    setConversations(await backend.listConversations().catch(() => []));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { conversations, refresh };
}
