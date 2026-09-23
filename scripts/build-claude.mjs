// Fabrique la version de Phare pour claude.ai : un seul fichier HTML, sans serveur.
// Le JavaScript et le CSS sont intégrés dans la page (claude.ai n'autorise pas d'autres sources).
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

execSync("npx vite build --mode artifact", { stdio: "inherit" });

const dir = "dist-claude";
const assets = readdirSync(path.join(dir, "assets"));
const js = assets.filter((f) => f.endsWith(".js")).map((f) => readFileSync(path.join(dir, "assets", f), "utf8"));
const css = assets.filter((f) => f.endsWith(".css")).map((f) => readFileSync(path.join(dir, "assets", f), "utf8"));
if (js.length !== 1) throw new Error(`Un seul fichier JS attendu, trouvé : ${js.length}`);

// claude.ai ajoute lui-même <!doctype>, <html>, <head> et <body> : on écrit seulement le contenu.
const safeJs = js[0].replace(/<\/script/gi, "<\\/script");
const page = `<title>Phare</title>
<meta name="theme-color" content="#071430">
<style>
${css.join("\n")}
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`;
const out = path.join(dir, "phare.html");
writeFileSync(out, page, "utf8");
console.log(`\n  ✔ ${out} (${(page.length / 1024).toFixed(0)} Kio)\n`);
