/**
 * Réglage de la force du moteur.
 *
 * C'est le point que la plupart des intégrations de Stockfish ratent. Baisser la
 * profondeur de recherche ne produit pas un adversaire faible, il produit un
 * adversaire fort qui joue vite : à profondeur 2 le moteur reste tactiquement
 * imbattable sur deux coups et donne l'impression d'un mur, pas d'un débutant.
 *
 * Stockfish expose deux réglages différents pour cela :
 *
 *   Skill Level, de 0 à 20, qui introduit des erreurs volontaires en écartant
 *   parfois le meilleur coup au profit d'un coup un peu moins bon. C'est ce qui
 *   donne un adversaire crédible en dessous du niveau club.
 *
 *   UCI_LimitStrength avec UCI_Elo, qui vise un Elo cible. La borne basse de
 *   Stockfish est 1320 : en dessous, le réglage n'a plus d'effet et il faut
 *   repasser par Skill Level.
 *
 * D'où la bascule ci-dessous. Elle est testée, parce qu'une erreur ici ne casse
 * rien de visible : le moteur répond, le jeu tourne, et l'adversaire est
 * simplement au mauvais niveau pendant des mois.
 */

export type Niveau = {
  /** Identifiant stable, utilisé côté interface. */
  id: string;
  /** Libellé montré au joueur. */
  nom: string;
  /** Elo visé. Indicatif en dessous de 1320, voir plus bas. */
  elo: number;
  /** Temps de réflexion accordé au moteur, en millisecondes. */
  tempsMs: number;
};

export const NIVEAUX: readonly Niveau[] = [
  { id: "debutant", nom: "Débutant", elo: 800, tempsMs: 200 },
  { id: "amateur", nom: "Amateur", elo: 1100, tempsMs: 300 },
  { id: "club", nom: "Joueur de club", elo: 1500, tempsMs: 500 },
  { id: "avance", nom: "Avancé", elo: 1900, tempsMs: 800 },
  { id: "expert", nom: "Expert", elo: 2400, tempsMs: 1200 },
] as const;

/** Bornes de UCI_Elo dans Stockfish. En dessous de 1320 le réglage ne fait plus rien. */
export const ELO_MINIMUM_MOTEUR = 1320;
export const ELO_MAXIMUM_MOTEUR = 3190;

export type OptionUci = { nom: string; valeur: string | number };

/**
 * Traduit un Elo visé en options UCI.
 *
 * Au dessus de la borne du moteur, on lui demande directement de se limiter à
 * cet Elo. En dessous, on repasse par Skill Level, interpolé linéairement entre
 * 0 à 400 Elo et 20 à la borne, puis borné pour rester dans la plage acceptée.
 */
export function optionsPourElo(elo: number): OptionUci[] {
  if (!Number.isFinite(elo)) {
    throw new Error(`Elo invalide : ${elo}`);
  }

  if (elo >= ELO_MINIMUM_MOTEUR) {
    return [
      { nom: "UCI_LimitStrength", valeur: "true" },
      { nom: "UCI_Elo", valeur: Math.min(Math.round(elo), ELO_MAXIMUM_MOTEUR) },
    ];
  }

  const ELO_PLANCHER = 400;
  const proportion =
    (elo - ELO_PLANCHER) / (ELO_MINIMUM_MOTEUR - ELO_PLANCHER);
  const niveau = Math.round(proportion * 20);

  return [
    { nom: "UCI_LimitStrength", valeur: "false" },
    { nom: "Skill Level", valeur: Math.max(0, Math.min(20, niveau)) },
  ];
}

/** Met les options au format texte du protocole UCI. */
export function commandesUci(options: readonly OptionUci[]): string[] {
  return options.map((o) => `setoption name ${o.nom} value ${o.valeur}`);
}

export function niveauParId(id: string): Niveau {
  const trouve = NIVEAUX.find((n) => n.id === id);
  if (!trouve) {
    throw new Error(`Niveau inconnu : ${id}`);
  }
  return trouve;
}
