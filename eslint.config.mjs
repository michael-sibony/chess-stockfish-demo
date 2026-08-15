import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Stockfish est vendu tel quel, c'est un binaire compilé par Emscripten.
    // Le passer au linter n'a aucun sens : ce n'est pas du code que l'on écrit.
    "public/moteur/**",
  ]),
]);

export default eslintConfig;
