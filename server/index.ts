import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { PHARE_SYSTEM_PROMPT, nowContext } from "./prompt.js";
import { appendExchange, currentConversation, listConversations, newConversation } from "./memory.js";

const MODEL = "claude-sonnet-5";
// Nombre de messages récents renvoyés au modèle comme contexte.
const HISTORY_WINDOW = 30;

const hasKey = /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(process.env.ANTHROPIC_API_KEY ?? "");
if (!hasKey) {
  // On ne s'arrête pas : le site s'affiche quand même et explique quoi faire.
  console.warn("\n  ⚠ Clé API manquante ou invalide dans .env. Lance  npm run setup  pour la renseigner.\n");
}

const client = hasKey ? new Anthropic() : null;
const app = express();
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL, hasKey });
});

app.get("/api/history", async (_req, res) => {
  res.json(await currentConversation());
});

app.get("/api/conversations", async (_req, res) => {
  res.json(await listConversations());
});

app.post("/api/conversations/new", async (_req, res) => {
  res.json(await newConversation());
});

/**
 * Envoie la question à Claude et renvoie la réponse en flux texte,
 * morceau par morceau, pour que Phare commence à parler au plus vite.
 */
app.post("/api/chat", async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    res.status(400).json({ error: "Message vide." });
    return;
  }
  if (!client) {
    res.status(503).json({ error: "Je n'ai pas de clé API. Lance npm run setup dans le terminal, puis relance Phare." });
    return;
  }

  const conv = await currentConversation();
  const history: Anthropic.MessageParam[] = conv.messages
    .slice(-HISTORY_WINDOW)
    .map((m) => ({ role: m.role, content: m.content }));

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 2048,
    // Effort bas : réponses vocales courtes, on privilégie la rapidité.
    output_config: { effort: "low" },
    system: `${PHARE_SYSTEM_PROMPT}\n\n${nowContext()}`,
    messages: [...history, { role: "user", content: text }],
  });

  let answer = "";
  let started = false;
  stream.on("text", (delta) => {
    if (!started) {
      started = true;
      res.status(200).setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
    }
    answer += delta;
    res.write(delta);
  });

  // Si le navigateur coupe (bouton "couper"), on arrête aussi la génération.
  res.on("close", () => {
    if (!res.writableFinished) stream.abort();
  });

  try {
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal" && !answer) {
      answer = "Je préfère ne pas répondre à ça.";
      res.status(200).type("text/plain").write(answer);
    }
    res.end();
    if (answer.trim()) await appendExchange(text, answer.trim());
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError) return;
    const message = describeError(err);
    console.error("Erreur API :", err);
    if (!started) res.status(502).json({ error: message });
    else res.end(`\n${message}`);
  }
});

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Ma clé API est refusée. Vérifie le fichier .env.";
  if (err instanceof Anthropic.RateLimitError) return "Trop de demandes d'un coup, réessaie dans un instant.";
  if (err instanceof Anthropic.APIConnectionError) return "Je n'arrive pas à joindre le serveur d'Anthropic. Vérifie la connexion.";
  if (err instanceof Anthropic.APIError) return `Petit souci côté API (${err.status ?? "?"}). Réessaie.`;
  return "Une erreur inattendue est survenue.";
}

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`\n  ✦ Serveur de Phare prêt sur http://localhost:${port} (modèle ${MODEL})\n`);
});
