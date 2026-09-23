import type { Backend, Conversation, ConversationSummary, Health } from "./types";

/** Version locale : tout passe par le serveur Express (npm run dev). */
export const serverBackend: Backend = {
  kind: "server",
  voiceInput: true,

  async health(): Promise<Health> {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const data = (await res.json()) as { hasKey?: boolean };
      return res.ok ? (data.hasKey ? "ok" : "no-key") : "no-server";
    } catch {
      return "no-server";
    }
  },

  async chat(text, { signal, onDelta }) {
    let res: Response;
    try {
      res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal,
      });
    } catch (err) {
      if (signal.aborted) throw err;
      throw new Error("Je n'arrive pas à joindre mon serveur. Il est bien lancé ?");
    }
    if (!res.ok || !res.body) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? `Le serveur a répondu ${res.status}.`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      onDelta(chunk);
    }
    return full;
  },

  async listConversations() {
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      return res.ok ? ((await res.json()) as ConversationSummary[]) : [];
    } catch {
      return [];
    }
  },

  async newConversation() {
    await fetch("/api/conversations/new", { method: "POST" });
  },

  async resumeConversation(id) {
    const res = await fetch(`/api/conversations/${encodeURIComponent(id)}/resume`, { method: "POST" });
    return res.ok ? ((await res.json()) as Conversation) : null;
  },
};
