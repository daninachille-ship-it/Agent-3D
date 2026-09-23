import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// En mode "mobile" on sert le site en HTTPS : le micro du téléphone
// n'est autorisé par Chrome que sur une page sécurisée.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "mobile" ? [basicSsl()] : [])],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
}));
