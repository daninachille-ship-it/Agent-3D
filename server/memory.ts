import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

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

interface Store {
  conversations: Conversation[];
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "conversations.json");

let cache: Store | null = null;
// Les écritures sont enchaînées pour ne jamais écrire deux fois le fichier en même temps.
let writing: Promise<void> = Promise.resolve();

async function load(): Promise<Store> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, "utf8")) as Store;
  } catch {
    cache = { conversations: [] };
  }
  return cache;
}

function persist(store: Store): Promise<void> {
  writing = writing.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
    await fs.rename(tmp, FILE);
  });
  return writing;
}

export async function currentConversation(): Promise<Conversation> {
  const store = await load();
  const last = store.conversations.at(-1);
  if (last) return last;
  return newConversation();
}

export async function newConversation(): Promise<Conversation> {
  const store = await load();
  // Inutile d'empiler des conversations vides.
  const last = store.conversations.at(-1);
  if (last && last.messages.length === 0) return last;
  const conv: Conversation = { id: randomUUID(), startedAt: new Date().toISOString(), messages: [] };
  store.conversations.push(conv);
  await persist(store);
  return conv;
}

export async function appendExchange(userText: string, assistantText: string): Promise<void> {
  const store = await load();
  const conv = await currentConversation();
  const at = new Date().toISOString();
  conv.messages.push({ role: "user", content: userText, at }, { role: "assistant", content: assistantText, at });
  await persist(store);
}

export interface ConversationSummary {
  id: string;
  title: string;
  startedAt: string;
  updatedAt: string;
  count: number;
  current: boolean;
}

function titleOf(conv: Conversation): string {
  const first = conv.messages.find((m) => m.role === "user")?.content.trim();
  if (!first) return "Nouvelle conversation";
  const clean = first.replace(/\s+/g, " ");
  return clean.length > 42 ? `${clean.slice(0, 41).trimEnd()}…` : clean;
}

/** Les conversations les plus récentes d'abord, sans leurs messages. */
export async function listConversations(limit = 12): Promise<ConversationSummary[]> {
  const store = await load();
  const current = store.conversations.at(-1);
  return store.conversations
    .filter((c) => c.messages.length > 0 || c === current)
    .map((c) => ({
      id: c.id,
      title: titleOf(c),
      startedAt: c.startedAt,
      updatedAt: c.messages.at(-1)?.at ?? c.startedAt,
      count: c.messages.length,
      current: c === current,
    }))
    .sort((a, b) => (a.current ? -1 : b.current ? 1 : b.updatedAt.localeCompare(a.updatedAt)))
    .slice(0, limit);
}

/** Une conversation complète, pour la relire. */
export async function getConversation(id: string): Promise<Conversation | null> {
  return (await load()).conversations.find((c) => c.id === id) ?? null;
}

/** Reprend une ancienne conversation : elle redevient la conversation en cours. */
export async function resumeConversation(id: string): Promise<Conversation | null> {
  const store = await load();
  const i = store.conversations.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const [conv] = store.conversations.splice(i, 1);
  // La conversation vide laissée derrière ne sert plus à rien.
  const last = store.conversations.at(-1);
  if (last && last.messages.length === 0) store.conversations.pop();
  store.conversations.push(conv);
  await persist(store);
  return conv;
}
