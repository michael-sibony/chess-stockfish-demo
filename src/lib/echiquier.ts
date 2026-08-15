/**
 * Représentation de l'échiquier pour l'affichage et pour l'accessibilité.
 *
 * chess.js tient les règles. Ce fichier ne fait que traduire son état en
 * quelque chose qu'on peut peindre à l'écran et surtout annoncer à voix haute.
 * Un échiquier n'est pas une image : c'est une grille de 64 cases nommées, et
 * un joueur non voyant doit pouvoir en parcourir chaque case et entendre ce
 * qu'elle contient.
 */

import type { Chess, Color, PieceSymbol, Square } from "chess.js";

export const COLONNES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const RANGEES = [8, 7, 6, 5, 4, 3, 2, 1] as const;

export type Piece = { type: PieceSymbol; couleur: Color };

export type CaseEchiquier = {
  nom: Square;
  piece: Piece | null;
  /** Vrai pour les cases foncées. a1 est foncée, d'où la parité ci-dessous. */
  sombre: boolean;
};

const NOMS_PIECES: Record<PieceSymbol, string> = {
  p: "pion",
  n: "cavalier",
  b: "fou",
  r: "tour",
  q: "dame",
  k: "roi",
};

/**
 * Le féminin de « dame » et de « tour » oblige à accorder la couleur, et le
 * féminin de « blanc » n'est pas « blance ». Les formes sont écrites, pas
 * fabriquées en ajoutant un « e ».
 */
const NOMS_COULEURS: Record<Color, { masculin: string; feminin: string }> = {
  w: { masculin: "blanc", feminin: "blanche" },
  b: { masculin: "noir", feminin: "noire" },
};

const PIECES_FEMININES: ReadonlySet<PieceSymbol> = new Set(["q", "r"]);

function couleurAccordee(type: PieceSymbol, couleur: Color): string {
  const formes = NOMS_COULEURS[couleur];
  return PIECES_FEMININES.has(type) ? formes.feminin : formes.masculin;
}

export function nomPiece(piece: Piece): string {
  return `${NOMS_PIECES[piece.type]} ${couleurAccordee(piece.type, piece.couleur)}`;
}

/**
 * Libellé lu par une synthèse vocale.
 *
 * La case est nommée en premier parce que c'est ce que le joueur cherche quand
 * il parcourt la grille au clavier.
 */
export function libelleCase(caseEchiquier: CaseEchiquier): string {
  if (!caseEchiquier.piece) {
    return `${caseEchiquier.nom}, case vide`;
  }
  return `${caseEchiquier.nom}, ${nomPiece(caseEchiquier.piece)}`;
}

/**
 * a1 est foncée, h1 est claire. La somme de l'indice de colonne et du numéro de
 * rangée est donc impaire sur les cases foncées, et non paire : a1 donne 0 + 1.
 * Test en premier, parce qu'un échiquier aux couleurs inversées se voit à
 * l'œil mais se démontre mal une fois qu'on s'y est habitué.
 */
export function estSombre(colonne: string, rangee: number): boolean {
  const indexColonne = COLONNES.indexOf(colonne as (typeof COLONNES)[number]);
  return (indexColonne + rangee) % 2 === 1;
}

/**
 * Les 64 cases, dans l'ordre de lecture depuis le point de vue des blancs :
 * rangée 8 en haut, colonne a à gauche.
 */
export function casesDepuis(partie: Chess): CaseEchiquier[] {
  const cases: CaseEchiquier[] = [];
  for (const rangee of RANGEES) {
    for (const colonne of COLONNES) {
      const nom = `${colonne}${rangee}` as Square;
      const trouvee = partie.get(nom);
      cases.push({
        nom,
        piece: trouvee ? { type: trouvee.type, couleur: trouvee.color } : null,
        sombre: estSombre(colonne, rangee),
      });
    }
  }
  return cases;
}

/** Le glyphe Unicode de la pièce. Décoratif : il est doublé du libellé textuel. */
export function glyphe(piece: Piece): string {
  const glyphes: Record<Color, Record<PieceSymbol, string>> = {
    w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
    b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
  };
  return glyphes[piece.couleur][piece.type];
}

/**
 * Décrit l'état de la partie en une phrase.
 *
 * Sert au bandeau visible et à la région annoncée automatiquement, pour que la
 * fin de partie ne soit pas une information réservée à ceux qui regardent.
 */
export function etatPartie(partie: Chess): string {
  if (partie.isCheckmate()) {
    const perdant = partie.turn() === "w" ? "blancs" : "noirs";
    const gagnant = partie.turn() === "w" ? "noirs" : "blancs";
    return `Échec et mat, les ${perdant} sont mat, les ${gagnant} gagnent.`;
  }
  if (partie.isStalemate()) return "Pat, la partie est nulle.";
  if (partie.isInsufficientMaterial()) {
    return "Matériel insuffisant, la partie est nulle.";
  }
  if (partie.isThreefoldRepetition()) {
    return "Triple répétition, la partie est nulle.";
  }
  if (partie.isDraw()) return "Partie nulle.";

  const trait = partie.turn() === "w" ? "blancs" : "noirs";
  return partie.isCheck()
    ? `Échec au roi, aux ${trait} de jouer.`
    : `Aux ${trait} de jouer.`;
}
