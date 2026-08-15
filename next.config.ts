import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sans cette ligne, Turbopack remonte l'arborescence, trouve le lockfile du
  // dossier parent et prend celui-ci pour racine du projet. Le build passe
  // quand même, mais la résolution des chemins devient dépendante de l'endroit
  // où le dépôt a été cloné, ce qui est exactement le genre de différence qui
  // ne se voit qu'en intégration continue.
  turbopack: { root: path.resolve(import.meta.dirname) },
};

export default nextConfig;
