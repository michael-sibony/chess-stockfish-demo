/**
 * Client du moteur Stockfish, côté navigateur.
 *
 * Stockfish tourne dans un Web Worker, donc sur un autre fil que l'interface.
 * C'est la condition pour garder l'échiquier fluide : une recherche à 1 200 ms
 * exécutée sur le fil principal gèlerait la page pendant tout ce temps, et
 * aucune animation ne rattrape ça.
 *
 * Le binaire embarqué est la variante « lite single » de Stockfish 18 : réseau
 * d'évaluation allégé et surtout mono fil. La version multi fils exige
 * SharedArrayBuffer, donc les en têtes Cross-Origin-Opener-Policy et
 * Cross-Origin-Embedder-Policy sur toute l'origine, ce qui casse au passage
 * l'intégration de la moindre ressource tierce. Pour un adversaire plafonné à
 * 2 400 Elo, le mono fil suffit largement et évite ce piège.
 *
 * Le dialogue se fait en UCI, un protocole en texte ligne par ligne.
 */

import { commandesUci, optionsPourElo } from "./niveaux";

const CHEMIN_MOTEUR = "/moteur/stockfish-18-lite-single.js";

export type Moteur = {
  /** Règle la force. À rappeler à chaque changement de niveau. */
  reglerForce(elo: number): void;
  /**
   * Demande le meilleur coup pour cette position, en notation UCI (« e2e4 »).
   * Résout avec null si le moteur ne propose rien, ce qui arrive sur une
   * position terminale.
   */
  meilleurCoup(fen: string, tempsMs: number): Promise<string | null>;
  arreter(): void;
};

export async function demarrerMoteur(): Promise<Moteur> {
  const worker = new Worker(CHEMIN_MOTEUR);

  const enAttente: Array<(ligne: string) => void> = [];
  worker.addEventListener("message", (evenement: MessageEvent) => {
    const ligne = String(evenement.data);
    // Copie avant parcours : un écouteur peut se retirer pendant la boucle.
    for (const ecouteur of [...enAttente]) ecouteur(ligne);
  });

  function ecouter(predicat: (ligne: string) => boolean): Promise<string> {
    return new Promise((resoudre) => {
      const ecouteur = (ligne: string) => {
        if (!predicat(ligne)) return;
        const index = enAttente.indexOf(ecouteur);
        if (index !== -1) enAttente.splice(index, 1);
        resoudre(ligne);
      };
      enAttente.push(ecouteur);
    });
  }

  function envoyer(commande: string) {
    worker.postMessage(commande);
  }

  // Poignée de main UCI. « uciok » puis « readyok » : sans attendre ces deux
  // accusés, les setoption envoyés trop tôt sont ignorés en silence.
  const pretUci = ecouter((l) => l.startsWith("uciok"));
  envoyer("uci");
  await pretUci;

  const pretMoteur = ecouter((l) => l.startsWith("readyok"));
  envoyer("isready");
  await pretMoteur;

  return {
    reglerForce(elo: number) {
      for (const commande of commandesUci(optionsPourElo(elo))) {
        envoyer(commande);
      }
    },

    async meilleurCoup(fen: string, tempsMs: number) {
      const reponse = ecouter((l) => l.startsWith("bestmove"));
      envoyer(`position fen ${fen}`);
      envoyer(`go movetime ${Math.max(50, Math.round(tempsMs))}`);
      const ligne = await reponse;

      // Format : « bestmove e2e4 ponder e7e5 », ou « bestmove (none) ».
      const coup = ligne.split(/\s+/)[1];
      return !coup || coup === "(none)" ? null : coup;
    },

    arreter() {
      envoyer("quit");
      worker.terminate();
    },
  };
}

/** Découpe un coup UCI en ses trois parties. « e7e8q » promeut en dame. */
export function decouperCoupUci(coup: string): {
  depuis: string;
  vers: string;
  promotion?: string;
} {
  return {
    depuis: coup.slice(0, 2),
    vers: coup.slice(2, 4),
    promotion: coup.length > 4 ? coup.slice(4, 5) : undefined,
  };
}
