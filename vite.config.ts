import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// En mode "mobile" on sert le site en HTTPS : le micro du téléphone
// n'est autorisé par Chrome que sur une page sécurisée.
// En mode "artifact" on fabrique la version pour claude.ai (voir scripts/build-claude.mjs).
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "mobile" ? [basicSsl()] : [])],
  ...(mode === "artifact" && {
    base: "./",
    build: { outDir: "dist-claude", assetsInlineLimit: 100_000_000, cssCodeSplit: false },
  }),
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
}));
