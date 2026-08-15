import type { MetadataRoute } from "next";

/**
 * Le plan du site, généré par Next à /sitemap.xml.
 *
 * Une seule page ici, mais robots.txt l'annonce : un robots.txt qui pointe vers
 * un plan de site absent est signalé comme invalide par les outils d'audit, et
 * c'est une incohérence gratuite.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://chess-mvp.vercel.app",
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
