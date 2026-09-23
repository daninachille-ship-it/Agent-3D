export type Health = "checking" | "ok" | "no-server" | "no-key" | "no-claude";

export interface ConversationSummary {
  id: string;
  title: string;
  startedAt: string;
  updatedAt: string;
  count: number;
  current: boolean;
}

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  at: string;
}

export interface Conversation {
  id: string;
  startedAt: string;
  messages: StoredMessage[];
}

/**
 * Là où Phare trouve son intelligence et sa mémoire :
 * - "server" : le petit serveur local (clé API dans .env) ;
 * - "claude" : la page publiée sur claude.ai, qui demande à Claude avec le compte de la personne.
 */
export interface Backend {
  kind: "server" | "claude";
  /** La reconnaissance vocale est-elle possible ici ? (claude.ai bloque le micro) */
  voiceInput: boolean;
  health(): Promise<Health>;
  /** Envoie la question ; `onDelta` reçoit la réponse morceau par morceau. Rejette une Error au message lisible. */
  chat(text: string, opts: { signal: AbortSignal; onDelta: (delta: string) => void }): Promise<string>;
  listConversations(): Promise<ConversationSummary[]>;
  newConversation(): Promise<void>;
  resumeConversation(id: string): Promise<Conversation | null>;
}
