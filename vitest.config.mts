import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // Les tests portent sur les règles et sur la traduction Elo vers UCI, donc
    // sur du calcul pur. Aucun besoin de DOM, et l'environnement node démarre
    // en une fraction du temps de jsdom.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
