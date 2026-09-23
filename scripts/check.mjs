// Vérifications avant le lancement, avec des messages clairs.
import { existsSync, readFileSync, readdirSync } from "node:fs";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 19) || (major === 22 && minor < 12)) {
  console.error(`\n  ✖ Node.js ${process.versions.node} est trop ancien.`);
  console.error("    Installe la version LTS depuis https://nodejs.org puis relance.\n");
  process.exit(1);
}

if (!existsSync("node_modules")) {
  console.error("\n  ✖ Les dépendances ne sont pas installées. Lance d'abord :  npm install\n");
  process.exit(1);
}

const hasKey = existsSync(".env") && /^ANTHROPIC_API_KEY\s*=\s*sk-ant-[A-Za-z0-9_-]{20,}\s*$/m.test(readFileSync(".env", "utf8"));
if (!hasKey) {
  const lookalikes = readdirSync(".").filter((f) => /^\.?env(\.example)?\.(txt|rtf)$|^env$/i.test(f));
  console.warn("\n  ⚠ Clé API absente : Phare s'affichera mais ne pourra pas répondre.");
  if (lookalikes.length) console.warn(`    J'ai trouvé "${lookalikes.join(", ")}" : l'éditeur de texte a changé le nom du fichier.`);
  console.warn("    Le plus simple : arrête (Ctrl + C) et lance   npm run setup\n");
}
