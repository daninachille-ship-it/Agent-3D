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

export async function listConversations(): Promise<Conversation[]> {
  return (await load()).conversations;
}
