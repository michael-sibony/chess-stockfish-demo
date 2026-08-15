"use client";

/**
 * L'échiquier jouable.
 *
 * Trois façons de jouer un coup, volontairement, parce qu'aucune ne couvre tout
 * le monde à elle seule :
 *
 *   au clavier, chaque case est un bouton nommé, on sélectionne puis on valide,
 *   au doigt ou à la souris, par glisser déposer en Pointer Events,
 *   au doigt aussi, par simple appui sur la case de départ puis d'arrivée.
 *
 * Le glisser déposer passe par les Pointer Events et non par l'API Drag and Drop
 * du HTML, qui ne se déclenche pas au toucher. Un échiquier mobile qui ne réagit
 * qu'à la souris est un échiquier mobile qui ne marche pas.
 */

import { Chess, type Square } from "chess.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  casesDepuis,
  etatPartie,
  glyphe,
  libelleCase,
  type Piece,
} from "@/lib/echiquier";
import { demarrerMoteur, decouperCoupUci, type Moteur } from "@/lib/moteur";
import { NIVEAUX, niveauParId } from "@/lib/niveaux";

type Promotion = { depuis: Square; vers: Square };
type Glisse = { depuis: Square; x: number; y: number; piece: Piece };

/**
 * Habillage des pièces.
 *
 * Les glyphes Unicode blancs (♙, ♖) sont dessinés en contour, pas en aplat :
 * coloriés en blanc sur une case claire, il ne reste qu'une ombre portée et la
 * pièce devient illisible. Un contour foncé posé au trait règle le problème
 * sans changer de jeu de glyphes, et sans faire reposer la lecture sur la
 * seule luminosité de la case.
 */
const STYLE_PIECE: Record<"w" | "b", React.CSSProperties> = {
  w: {
    color: "#ffffff",
    WebkitTextStroke: "0.055em #1c1917",
    paintOrder: "stroke fill",
  },
  b: {
    color: "#1c1917",
    WebkitTextStroke: "0.03em rgba(255,255,255,.45)",
    paintOrder: "stroke fill",
  },
};

const PIECES_PROMOTION = [
  { code: "q", nom: "Dame" },
  { code: "r", nom: "Tour" },
  { code: "b", nom: "Fou" },
  { code: "n", nom: "Cavalier" },
] as const;

const POSITION_DEPART = new Chess().fen();

export default function Echiquier() {
  /**
   * La partie est stockée comme une position de départ plus la liste des coups,
   * pas comme une FEN courante.
   *
   * Une FEN ne contient pas l'historique. En repartant d'elle à chaque coup, la
   * notation et le PGN se réinitialisaient silencieusement : la partie
   * affichait « 1. e5 » après 1. e4 e5, parce que le coup des noirs devenait le
   * premier coup d'une partie neuve. Rejouer la liste depuis le départ coûte
   * quelques microsecondes et rend l'annulation triviale.
   */
  const [fenInitiale, setFenInitiale] = useState(POSITION_DEPART);
  const [coups, setCoups] = useState<string[]>([]);
  const [selection, setSelection] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [glisse, setGlisse] = useState<Glisse | null>(null);
  const [idNiveau, setIdNiveau] = useState("club");
  const [reflechit, setReflechit] = useState(false);
  const [moteurPret, setMoteurPret] = useState(false);
  const [erreurMoteur, setErreurMoteur] = useState<string | null>(null);

  // Le moteur est gardé sous forme de promesse plutôt que d'instance. Rien
  // n'a donc besoin de surveiller un état « prêt » : une réponse demandée
  // pendant le chargement attend simplement que Stockfish soit là.
  const moteur = useRef<Promise<Moteur> | null>(null);

  // Jeton de position. Il est incrémenté à chaque rupture décidée par le
  // joueur, nouvelle partie, retour en arrière, chargement d'une FEN. Un coup
  // calculé pour une position abandonnée porte un jeton périmé et n'est pas
  // appliqué. Sans cela, annuler pendant que le moteur réfléchit fait
  // apparaître son coup une seconde plus tard, sur le mauvais échiquier.
  const jeton = useRef(0);
  const reglage = useRef(niveauParId(idNiveau));

  const partie = useMemo(() => {
    const echiquier = new Chess(fenInitiale);
    for (const coup of coups) echiquier.move(coup);
    return echiquier;
  }, [fenInitiale, coups]);

  const fen = partie.fen();
  const historique = coups;
  const niveau = niveauParId(idNiveau);

  // Le niveau est recopié dans une ref pour que la recherche en cours lise la
  // valeur du moment sans que `repondre` ait à se recréer à chaque changement,
  // ce qui invaliderait aussi `jouer` à chaque fois.
  useEffect(() => {
    reglage.current = niveau;
  }, [niveau]);
  const terminee = partie.isGameOver();
  const auxBlancs = partie.turn() === "w";

  // Démarrage du moteur, une seule fois. Le worker est arrêté au démontage,
  // sinon un rechargement à chaud laisse un Stockfish orphelin par sauvegarde.
  useEffect(() => {
    const promesse = demarrerMoteur();
    moteur.current = promesse;

    promesse.then(
      () => setMoteurPret(true),
      (e: unknown) =>
        setErreurMoteur(
          e instanceof Error ? e.message : "Le moteur n'a pas démarré.",
        ),
    );

    return () => {
      moteur.current = null;
      promesse.then((m) => m.arreter()).catch(() => {});
    };
  }, []);

  /**
   * Fait répondre le moteur, si c'est bien à lui de jouer.
   *
   * Appelée explicitement après un coup du joueur plutôt que déclenchée par un
   * effet sur la position : un effet qui joue des coups se redéclenche à chaque
   * cause imprévue, y compris un simple remontage du composant.
   */
  const repondre = useCallback(async (position: string) => {
    const echiquier = new Chess(position);
    if (echiquier.turn() !== "b" || echiquier.isGameOver()) return;

    const instance = await moteur.current;
    if (!instance) return;

    const monJeton = jeton.current;
    setReflechit(true);
    try {
      // Réglé juste avant chaque recherche : le joueur peut changer de niveau
      // au milieu de la partie, et le coup suivant doit déjà en tenir compte.
      instance.reglerForce(reglage.current.elo);
      const coup = await instance.meilleurCoup(
        position,
        reglage.current.tempsMs,
      );
      if (!coup || monJeton !== jeton.current) return;

      // Le moteur parle en UCI, « e7e5 ». La notation affichée et le PGN sont
      // en algébrique, « e5 ». La conversion passe par chess.js, qui seul
      // connaît le contexte nécessaire pour lever une ambiguïté du type « Nbd2 ».
      const { depuis, vers, promotion: promo } = decouperCoupUci(coup);
      const joue = echiquier.move({ from: depuis, to: vers, promotion: promo });
      setCoups((precedents) => [...precedents, joue.san]);
    } finally {
      setReflechit(false);
    }
  }, []);

  const jouer = useCallback(
    (depuis: Square, vers: Square, promotionChoisie?: string) => {
      const essai = new Chess(fen);
      let san: string;
      try {
        const coup = essai.move({
          from: depuis,
          to: vers,
          promotion: promotionChoisie,
        });
        if (!coup) return false;
        san = coup.san;
      } catch {
        // chess.js lève sur un coup illégal. Ce n'est pas une anomalie ici :
        // le joueur a simplement relâché la pièce sur une mauvaise case.
        return false;
      }
      setCoups((precedents) => [...precedents, san]);
      setSelection(null);
      void repondre(essai.fen());
      return true;
    },
    [fen, repondre],
  );

  const destinations = useMemo(() => {
    if (!selection) return new Set<string>();
    return new Set(
      partie
        .moves({ square: selection, verbose: true })
        .map((coup) => coup.to as string),
    );
  }, [partie, selection]);

  const demandePromotion = useCallback(
    (depuis: Square, vers: Square) =>
      partie
        .moves({ square: depuis, verbose: true })
        .some((coup) => coup.to === vers && coup.promotion),
    [partie],
  );

  const tenterCoup = useCallback(
    (depuis: Square, vers: Square) => {
      if (demandePromotion(depuis, vers)) {
        setPromotion({ depuis, vers });
        return;
      }
      jouer(depuis, vers);
    },
    [demandePromotion, jouer],
  );

  const activerCase = useCallback(
    (nom: Square) => {
      if (terminee || !auxBlancs || reflechit) return;

      if (selection && destinations.has(nom)) {
        tenterCoup(selection, nom);
        return;
      }
      const piece = partie.get(nom);
      setSelection(piece && piece.color === "w" ? nom : null);
    },
    [
      auxBlancs,
      destinations,
      partie,
      reflechit,
      selection,
      tenterCoup,
      terminee,
    ],
  );

  // --- Glisser déposer ------------------------------------------------------

  const debuterGlisse = useCallback(
    (evenement: React.PointerEvent, nom: Square) => {
      if (terminee || !auxBlancs || reflechit) return;
      const piece = partie.get(nom);
      if (!piece || piece.color !== "w") return;

      evenement.currentTarget.setPointerCapture(evenement.pointerId);
      setSelection(nom);
      setGlisse({
        depuis: nom,
        x: evenement.clientX,
        y: evenement.clientY,
        piece: { type: piece.type, couleur: piece.color },
      });
    },
    [auxBlancs, partie, reflechit, terminee],
  );

  const suivreGlisse = useCallback(
    (evenement: React.PointerEvent) => {
      if (!glisse) return;
      setGlisse({ ...glisse, x: evenement.clientX, y: evenement.clientY });
    },
    [glisse],
  );

  const terminerGlisse = useCallback(
    (evenement: React.PointerEvent) => {
      if (!glisse) return;
      const depuis = glisse.depuis;
      setGlisse(null);

      // La pièce flottante suit le pointeur mais ne doit pas intercepter le
      // relâchement : elle porte pointer-events none, donc elementFromPoint
      // renvoie bien la case en dessous.
      const sous = document.elementFromPoint(
        evenement.clientX,
        evenement.clientY,
      );
      const cible = sous?.closest<HTMLElement>("[data-case]")?.dataset.case;
      if (cible && cible !== depuis) tenterCoup(depuis, cible as Square);
    },
    [glisse, tenterCoup],
  );

  // --- Commandes ------------------------------------------------------------

  const nouvellePartie = useCallback(() => {
    jeton.current += 1;
    setFenInitiale(POSITION_DEPART);
    setCoups([]);
    setSelection(null);
    setPromotion(null);
    setReflechit(false);
  }, []);

  const annulerCoup = useCallback(() => {
    jeton.current += 1;
    // Deux demi coups : le mien et la réponse du moteur. Sans les deux, on
    // rend la main au joueur alors que c'est toujours aux noirs.
    setCoups((precedents) => precedents.slice(0, -2));
    setSelection(null);
    setReflechit(false);
  }, []);

  const chargerFen = useCallback(
    (valeur: string) => {
      let chargee: Chess;
      try {
        chargee = new Chess(valeur.trim());
      } catch {
        return false;
      }
      jeton.current += 1;
      setFenInitiale(chargee.fen());
      setCoups([]);
      setSelection(null);
      setReflechit(false);
      // Une position chargée peut être au trait des noirs : dans ce cas le
      // moteur doit jouer sans attendre un coup du joueur.
      void repondre(chargee.fen());
      return true;
    },
    [repondre],
  );

  const cases = casesDepuis(partie);
  const etat = etatPartie(partie);
  const dernierCoup = historique.at(-1);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex flex-col gap-3">
        {/* Pas de role="grid" : ce rôle promet une navigation aux flèches en
            deux dimensions, que cette démonstration n'implémente pas. Annoncer
            une sémantique qu'on ne tient pas dessert l'utilisateur davantage
            que de s'en tenir à des boutons correctement nommés. */}
        <div
          role="group"
          aria-label="Échiquier, rangée 8 en haut, colonne a à gauche"
          className="grid aspect-square w-full max-w-[min(88vw,32rem)] grid-cols-8 overflow-hidden rounded-lg border-2 border-stone-700 shadow-lg"
          style={{ touchAction: "none" }}
        >
          {cases.map((c) => {
            const estSelection = selection === c.nom;
            const estCible = destinations.has(c.nom);
            const enCoursDeGlisse = glisse?.depuis === c.nom;

            return (
              <button
                key={c.nom}
                type="button"
                data-case={c.nom}
                aria-label={
                  estCible
                    ? `${libelleCase(c)}, coup possible`
                    : libelleCase(c)
                }
                aria-pressed={estSelection}
                onPointerDown={(e) => debuterGlisse(e, c.nom)}
                onPointerMove={suivreGlisse}
                onPointerUp={terminerGlisse}
                onClick={() => activerCase(c.nom)}
                className={[
                  "relative flex items-center justify-center text-[clamp(1.5rem,7vw,2.6rem)] leading-none select-none",
                  "focus-visible:z-10 focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-sky-600",
                  c.sombre ? "bg-stone-500" : "bg-stone-200",
                  estSelection ? "ring-4 ring-inset ring-amber-500" : "",
                ].join(" ")}
              >
                {c.piece && !enCoursDeGlisse && (
                  <span aria-hidden="true" style={STYLE_PIECE[c.piece.couleur]}>
                    {glyphe(c.piece)}
                  </span>
                )}

                {/* Pastille des coups possibles. Décorative : l'information est
                    déjà dans le libellé de la case, donc elle ne repose pas sur
                    la seule couleur. */}
                {estCible && (
                  <span
                    aria-hidden="true"
                    className={
                      c.piece
                        ? "absolute inset-1 rounded-full border-4 border-emerald-700/70"
                        : "absolute h-1/4 w-1/4 rounded-full bg-emerald-700/70"
                    }
                  />
                )}
              </button>
            );
          })}
        </div>

        <p aria-hidden="true" className="text-sm text-stone-600 dark:text-stone-400">
          Vous jouez les blancs. Cliquez une pièce puis sa destination, ou
          faites la glisser. Au clavier, tabulation puis entrée.
        </p>
      </div>

      <aside className="flex w-full flex-col gap-5 lg:max-w-sm">
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900"
        >
          <p className="text-lg font-semibold">{etat}</p>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            {erreurMoteur
              ? `Moteur indisponible : ${erreurMoteur}`
              : !moteurPret
                ? "Chargement du moteur Stockfish."
                : reflechit
                  ? "Le moteur réfléchit."
                  : dernierCoup
                    ? `Dernier coup joué : ${dernierCoup}.`
                    : "Partie prête."}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-semibold" htmlFor="niveau">
            Force de l&apos;adversaire
          </label>
          <select
            id="niveau"
            value={idNiveau}
            onChange={(e) => setIdNiveau(e.target.value)}
            aria-describedby="niveau-aide"
            className="min-h-11 rounded-lg border border-stone-400 bg-white px-3 py-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-stone-950"
          >
            {NIVEAUX.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nom}, environ {n.elo} Elo
              </option>
            ))}
          </select>
          <span id="niveau-aide" className="text-sm text-stone-600 dark:text-stone-400">
            Modifiable en cours de partie. Sous 1320 Elo la force passe par
            Skill Level, au dessus par UCI_Elo.
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={nouvellePartie}
            className="min-h-11 rounded-lg bg-stone-900 px-4 font-semibold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:bg-stone-100 dark:text-stone-900"
          >
            Nouvelle partie
          </button>
          <button
            type="button"
            onClick={annulerCoup}
            disabled={historique.length < 2 || reflechit}
            className="min-h-11 rounded-lg border border-stone-400 px-4 font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-50"
          >
            Annuler mon coup
          </button>
        </div>

        <Notation historique={historique} />
        <ZoneFen fen={fen} onCharger={chargerFen} pgn={partie.pgn()} />
      </aside>

      {glisse && (
        <span
          aria-hidden="true"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 text-5xl"
          style={{ left: glisse.x, top: glisse.y }}
        >
          <span style={STYLE_PIECE[glisse.piece.couleur]}>
            {glyphe(glisse.piece)}
          </span>
        </span>
      )}

      {promotion && (
        <DialoguePromotion
          onChoisir={(code) => {
            jouer(promotion.depuis, promotion.vers, code);
            setPromotion(null);
          }}
          onAnnuler={() => {
            setPromotion(null);
            setSelection(null);
          }}
        />
      )}
    </div>
  );
}

function Notation({ historique }: { historique: string[] }) {
  const paires: Array<[string, string | undefined]> = [];
  for (let i = 0; i < historique.length; i += 2) {
    paires.push([historique[i], historique[i + 1]]);
  }

  return (
    <div>
      <h2 className="font-semibold">Notation</h2>
      <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-stone-300 dark:border-stone-700">
        {paires.length === 0 ? (
          <p className="p-3 text-sm text-stone-600 dark:text-stone-400">
            Aucun coup joué.
          </p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">
              Coups de la partie en notation algébrique
            </caption>
            <thead>
              <tr className="bg-stone-100 dark:bg-stone-900">
                <th scope="col" className="px-3 py-2 text-left">
                  Coup
                </th>
                <th scope="col" className="px-3 py-2 text-left">
                  Blancs
                </th>
                <th scope="col" className="px-3 py-2 text-left">
                  Noirs
                </th>
              </tr>
            </thead>
            <tbody>
              {paires.map(([blanc, noir], index) => (
                <tr key={index} className="border-t border-stone-200 dark:border-stone-800">
                  <th scope="row" className="px-3 py-1 text-left font-normal tabular-nums">
                    {index + 1}
                  </th>
                  <td className="px-3 py-1">{blanc}</td>
                  <td className="px-3 py-1">{noir ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ZoneFen({
  fen,
  pgn,
  onCharger,
}: {
  fen: string;
  pgn: string;
  onCharger: (valeur: string) => boolean;
}) {
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setErreur(onCharger(saisie) ? null : "Cette position FEN est invalide.");
      }}
    >
      <h2 className="font-semibold">Position, FEN et PGN</h2>

      <label className="text-sm" htmlFor="fen-actuel">
        FEN de la position courante
      </label>
      <output
        id="fen-actuel"
        className="rounded-lg border border-stone-300 bg-stone-50 p-2 font-mono text-xs break-all dark:border-stone-700 dark:bg-stone-900"
      >
        {fen}
      </output>

      <label className="text-sm" htmlFor="fen-charger">
        Charger une position
      </label>
      <input
        id="fen-charger"
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        aria-invalid={erreur ? "true" : undefined}
        aria-describedby={erreur ? "fen-erreur" : undefined}
        className="min-h-11 rounded-lg border border-stone-400 px-3 font-mono text-xs focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-600 aria-invalid:border-2 aria-invalid:border-red-700"
      />
      {erreur && (
        <span id="fen-erreur" role="alert" className="text-sm font-semibold text-red-700">
          {erreur}
        </span>
      )}

      <button
        type="submit"
        className="min-h-11 self-start rounded-lg border border-stone-400 px-4 font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
      >
        Charger cette position
      </button>

      {pgn && (
        <details className="mt-1">
          <summary className="cursor-pointer text-sm font-semibold">
            Voir le PGN
          </summary>
          <p className="mt-2 rounded-lg border border-stone-300 bg-stone-50 p-2 font-mono text-xs break-all dark:border-stone-700 dark:bg-stone-900">
            {pgn}
          </p>
        </details>
      )}
    </form>
  );
}

function DialoguePromotion({
  onChoisir,
  onAnnuler,
}: {
  onChoisir: (code: string) => void;
  onAnnuler: () => void;
}) {
  const premier = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    premier.current?.focus();
    const surEchap = (e: KeyboardEvent) => {
      if (e.key === "Escape") onAnnuler();
    };
    document.addEventListener("keydown", surEchap);
    return () => document.removeEventListener("keydown", surEchap);
  }, [onAnnuler]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-promotion"
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-stone-900"
      >
        <h2 id="titre-promotion" className="text-lg font-semibold">
          Promotion du pion
        </h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          Votre pion atteint la huitième rangée. Choisissez la pièce.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {PIECES_PROMOTION.map((piece, index) => (
            <button
              key={piece.code}
              ref={index === 0 ? premier : undefined}
              type="button"
              onClick={() => onChoisir(piece.code)}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-stone-400 px-4 font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
            >
              <span aria-hidden="true" className="text-2xl">
                {glyphe({
                  type: piece.code as Piece["type"],
                  couleur: "w",
                })}
              </span>
              {piece.nom}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onAnnuler}
          className="mt-4 min-h-11 text-sm font-semibold underline underline-offset-4"
        >
          Annuler ce coup
        </button>
      </div>
    </div>
  );
}
