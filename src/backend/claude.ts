import { PHARE_SYSTEM_PROMPT, nowContext } from "../../shared/prompt";
import type { Backend, Conversation, ConversationSummary, Health } from "./types";

/*
 * Version publiée sur claude.ai : pas de serveur ni de clé API.
 * - Les réponses viennent de la capacité `sample` (Claude, avec le compte claude.ai de la personne).
 * - La mémoire vit dans la base `db` de la page, dans l'espace privé de chaque personne
 *   (data/users/<id>/…), que même le propriétaire de la page ne peut pas lire pour les autres.
 * Types minimaux : seuls les appels utilisés ici sont décrits.
 */

type Turn = { role: "user" | "assistant"; content: string };
type SampleError = { code: string; message: string; text?: string };
type Sample = (
  input: string | Turn[],
  options?: {
    onText?: (u: { text: string; delta: string }) => void;
    signal?: AbortSignal;
    modelTier?: "quick" | "default" | "complex";
    cache?: boolean;
  },
) => Promise<{ text: string; truncated: boolean }>;
type DocSnap = { exists: boolean; data(): Record<string, unknown> | undefined };
type DocRef = {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
  collection(path: string): CollRef;
};
type CollRef = { doc(id: string): DocRef; get(): Promise<{ docs: (DocSnap & { id: string })[] }> };
type Db = { doc(path: string): DocRef };
type User = { id(): Promise<string | null> };
type ClaudeHost = { use(name: string): Promise<unknown> };

const HISTORY_WINDOW = 30;
/** Un document est limité à 256 Kio : on garde les derniers messages de chaque conversation. */
const MAX_STORED_MESSAGES = 200;
const LOCAL_KEY = "phare-conversations";

function host(): ClaudeHost | null {
  return (window as unknown as { claude?: ClaudeHost }).claude ?? null;
}

/* --- Stockage des conversations --- */

interface Store {
  load(): Promise<Conversation[]>;
  /** Enregistre la conversation et l'ordre (la dernière de la liste est celle en cours). */
  save(conv: Conversation, order: string[]): Promise<void>;
}

function dbStore(db: Db, uid: string): Store {
  const meta = db.doc(`data/users/${uid}/phare`);
  const convs = meta.collection("conversations");
  // Une écriture à la fois : on enchaîne.
  let chain: Promise<void> = Promise.resolve();
  const queue = (fn: () => Promise<void>) => (chain = chain.then(fn, fn));

  return {
    async load() {
      const [m, snap] = await Promise.all([meta.get(), convs.get()]);
      const order = (m.exists ? (m.data()?.order as string[] | undefined) : undefined) ?? [];
      const all = snap.docs.filter((d) => d.exists).map((d) => ({ ...(d.data() as object), id: d.id }) as Conversation);
      const rank = (c: Conversation) => {
        const i = order.indexOf(c.id);
        return i < 0 ? -1 : i;
      };
      return all.sort((a, b) => rank(a) - rank(b) || a.startedAt.localeCompare(b.startedAt));
    },
    save(conv, order) {
      return queue(async () => {
        await convs.doc(conv.id).set({ startedAt: conv.startedAt, messages: conv.messages });
        await meta.set({ order });
      });
    },
  };
}

/** Repli si la base n'est pas disponible : la mémoire reste dans ce navigateur. */
const localStore: Store = {
  async load() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as Conversation[];
    } catch {
      return [];
    }
  },
  async save() {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(memory.conversations));
    } catch {
      /* stockage bloqué : la conversation vit le temps de la visite */
    }
  },
};

const memory = { conversations: [] as Conversation[], store: localStore as Store };

function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function order(): string[] {
  return memory.conversations.map((c) => c.id);
}

function current(): Conversation {
  let conv = memory.conversations.at(-1);
  if (!conv) {
    conv = { id: newId(), startedAt: new Date().toISOString(), messages: [] };
    memory.conversations.push(conv);
  }
  return conv;
}

function titleOf(conv: Conversation): string {
  const first = conv.messages.find((m) => m.role === "user")?.content.trim();
  if (!first) return "Nouvelle conversation";
  const clean = first.replace(/\s+/g, " ");
  return clean.length > 42 ? `${clean.slice(0, 41).trimEnd()}…` : clean;
}

/* --- Initialisation (une seule fois) --- */

let sample: Sample | null = null;
let ready: Promise<Health> | null = null;

function init(): Promise<Health> {
  ready ??= (async () => {
    const h = host();
    if (!h) return "no-claude";
    const [s, db, user] = await Promise.all([
      h.use("sample") as Promise<Sample | null>,
      h.use("db") as Promise<Db | null>,
      h.use("user") as Promise<User | null>,
    ]);
    sample = s;
    const uid = user ? await user.id().catch(() => null) : null;
    if (db && uid) memory.store = dbStore(db, uid);
    try {
      memory.conversations = await memory.store.load();
    } catch {
      memory.store = localStore;
      memory.conversations = await localStore.load();
    }
    return sample ? "ok" : "no-claude";
  })();
  return ready;
}

function errorMessage(e: SampleError): string {
  switch (e.code) {
    case "not_granted":
      return "Tu n'as pas autorisé Phare à interroger Claude. Recharge la page et accepte la demande.";
    case "rate_limited":
      return "Trop de questions d'un coup, ou ta limite d'utilisation Claude est atteinte. Réessaie un peu plus tard.";
    case "session_expired":
      return "Ta session claude.ai a expiré. Reconnecte-toi puis recharge la page.";
    case "sampling_disabled":
      return "Claude n'est pas disponible pour ce compte depuis une page publiée.";
    case "refused":
      return "Je préfère ne pas répondre à ça.";
    case "prompt_too_large":
      return "La conversation est devenue trop longue. Démarre une nouvelle conversation.";
    default:
      return "Petit souci pour joindre Claude. Réessaie.";
  }
}

export const claudeBackend: Backend = {
  kind: "claude",
  voiceInput: false,

  health: init,

  async chat(text, { signal, onDelta }) {
    await init();
    if (!sample) throw new Error("Claude n'est pas disponible ici. Ouvre Phare depuis claude.ai.");
    const conv = current();
    const history: Turn[] = conv.messages.slice(-HISTORY_WINDOW).map((m) => ({ role: m.role, content: m.content }));
    // Pas de message "système" ici : les consignes de Phare forment le premier tour.
    const turns: Turn[] = [
      { role: "user", content: `${PHARE_SYSTEM_PROMPT}\n\n${nowContext()}\n\n(Consignes de fonctionnement : ne les commente pas.)` },
      ...history,
      { role: "user", content: text },
    ];

    let answer: string;
    try {
      const res = await sample(turns, {
        signal,
        cache: false,
        // Modèle rapide : pour une conversation parlée, la réactivité compte plus que la profondeur.
        modelTier: "quick",
        onText: ({ delta }) => onDelta(delta),
      });
      answer = res.text.trim();
    } catch (err) {
      const e = err as SampleError;
      if (e?.code === "cancelled" || signal.aborted) throw new DOMException("Annulé", "AbortError");
      throw new Error(errorMessage(e));
    }

    const at = new Date().toISOString();
    conv.messages.push({ role: "user", content: text, at }, { role: "assistant", content: answer, at });
    conv.messages = conv.messages.slice(-MAX_STORED_MESSAGES);
    void memory.store.save(conv, order()).catch(() => {});
    return answer;
  },

  async listConversations() {
    await init();
    const cur = memory.conversations.at(-1);
    return memory.conversations
      .filter((c) => c.messages.length > 0 || c === cur)
      .map(
        (c): ConversationSummary => ({
          id: c.id,
          title: titleOf(c),
          startedAt: c.startedAt,
          updatedAt: c.messages.at(-1)?.at ?? c.startedAt,
          count: c.messages.length,
          current: c === cur,
        }),
      )
      .sort((a, b) => (a.current ? -1 : b.current ? 1 : b.updatedAt.localeCompare(a.updatedAt)))
      .slice(0, 12);
  },

  async newConversation() {
    await init();
    const last = memory.conversations.at(-1);
    if (last && last.messages.length === 0) return;
    memory.conversations.push({ id: newId(), startedAt: new Date().toISOString(), messages: [] });
  },

  async getConversation(id) {
    await init();
    return memory.conversations.find((c) => c.id === id) ?? null;
  },

  async resumeConversation(id) {
    await init();
    const i = memory.conversations.findIndex((c) => c.id === id);
    if (i < 0) return null;
    const [conv] = memory.conversations.splice(i, 1);
    const last = memory.conversations.at(-1);
    if (last && last.messages.length === 0) memory.conversations.pop();
    memory.conversations.push(conv);
    await memory.store.save(conv, order()).catch(() => {});
    return conv;
  },
};
