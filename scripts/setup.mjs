// Demande la clé API et écrit le fichier .env, sans passer par un éditeur de texte.
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const KEY_RE = /^sk-ant-[A-Za-z0-9_-]{20,}$/;

console.log("\n  Configuration de Phare\n");
console.log("  Colle ta clé API Anthropic (elle commence par sk-ant-), puis appuie sur Entrée.");
console.log("  Tu la trouves sur https://console.anthropic.com → API Keys.\n");

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
rl.setPrompt("  Clé : ");
rl.prompt();

let saved = false;
rl.on("line", (line) => {
  const key = line.trim().replace(/^["']|["']$/g, "");
  if (!KEY_RE.test(key)) {
    console.log("  Ça ne ressemble pas à une clé Anthropic (sk-ant-...). Réessaie.\n");
    rl.prompt();
    return;
  }
  let port = "3001";
  if (existsSync(".env")) {
    const m = readFileSync(".env", "utf8").match(/^PORT=(\d+)/m);
    if (m) port = m[1];
  }
  writeFileSync(".env", `ANTHROPIC_API_KEY=${key}\nPORT=${port}\n`, "utf8");
  saved = true;
  console.log("\n  ✔ Fichier .env créé. Lance maintenant :  npm run dev\n");
  rl.close();
});
rl.on("close", () => {
  if (!saved) {
    console.log("\n  Aucune clé enregistrée.\n");
    process.exitCode = 1;
  }
});
