import Echiquier from "@/components/Echiquier";

export const metadata = {
  title: "Échiquier jouable, Stockfish sur l'appareil",
  description:
    "Démonstration jouable : chess.js pour les règles, Stockfish 18 en WebAssembly pour l'adversaire, force réglable de 800 à 2400 Elo.",
};

export default function Accueil() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-emerald-800 uppercase dark:text-emerald-400">
          Démonstration technique
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          Échiquier jouable, moteur sur l&apos;appareil
        </h1>
        <p className="mt-3 max-w-2xl text-stone-600 dark:text-stone-400">
          Jouez une partie tout de suite. Les règles sont tenues par chess.js,
          l&apos;adversaire est Stockfish 18 compilé en WebAssembly, qui tourne
          dans votre navigateur : aucun serveur d&apos;analyse, donc aucun coût
          par partie et un jeu qui fonctionne hors ligne.
        </p>
      </header>

      <Echiquier />

      <section className="mt-14 border-t border-stone-300 pt-8 dark:border-stone-700">
        <h2 className="text-2xl font-semibold">Ce que cette page démontre</h2>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Force réellement réglable</dt>
            <dd className="mt-1 text-stone-600 dark:text-stone-400">
              Baisser la profondeur de recherche ne crée pas un adversaire
              faible, seulement un adversaire rapide qui reste imbattable sur
              deux coups. Sous 1320 Elo la force passe par Skill Level, qui fait
              commettre de vraies erreurs. Au dessus, par UCI_Elo. La bascule est
              couverte par des tests.
            </dd>
          </div>

          <div>
            <dt className="font-semibold">Interface qui ne gèle jamais</dt>
            <dd className="mt-1 text-stone-600 dark:text-stone-400">
              Le moteur tourne dans un Web Worker. Une recherche de 1200 ms sur
              le fil principal figerait la page pendant tout ce temps, et aucune
              animation ne rattrape ça.
            </dd>
          </div>

          <div>
            <dt className="font-semibold">Jouable de trois façons</dt>
            <dd className="mt-1 text-stone-600 dark:text-stone-400">
              Glisser déposer en Pointer Events, donc au doigt comme à la souris.
              L&apos;API Drag and Drop du HTML ne se déclenche pas au toucher.
              Appui simple sur la case de départ puis d&apos;arrivée. Et au
              clavier seul, chaque case étant un bouton nommé.
            </dd>
          </div>

          <div>
            <dt className="font-semibold">Utilisable sans voir l&apos;écran</dt>
            <dd className="mt-1 text-stone-600 dark:text-stone-400">
              Chaque case s&apos;annonce, par exemple « d1, dame blanche » ou
              « e4, case vide, coup possible ». L&apos;état de la partie est dans
              une région annoncée automatiquement, donc un mat ne se devine pas
              au silence.
            </dd>
          </div>

          <div>
            <dt className="font-semibold">Promotion traitée</dt>
            <dd className="mt-1 text-stone-600 dark:text-stone-400">
              Un pion sur la huitième rangée ouvre un vrai dialogue de choix, au
              lieu de promouvoir d&apos;office en dame. La sous promotion en
              cavalier gagne des parties, la supprimer se voit tout de suite.
            </dd>
          </div>

          <div>
            <dt className="font-semibold">FEN et PGN</dt>
            <dd className="mt-1 text-stone-600 dark:text-stone-400">
              La position courante est exportée en FEN, la partie en PGN, et une
              FEN arbitraire peut être chargée. C&apos;est ce qui permet ensuite
              de construire un système de problèmes tactiques sans retoucher le
              moteur.
            </dd>
          </div>
        </dl>

        <h2 className="mt-10 text-2xl font-semibold">
          Ce que cette page ne fait pas
        </h2>
        <p className="mt-2 max-w-3xl text-stone-600 dark:text-stone-400">
          Pas de comptes, pas de classement Elo persistant, pas de partie contre
          un autre joueur, pas d&apos;achats intégrés. C&apos;est volontaire :
          cette page démontre la couche qui décide de la qualité du jeu, le
          plateau et le moteur. Le reste est du travail connu, qui se chiffre une
          fois que la mécanique de jeu est arrêtée.
        </p>

        <h2 className="mt-10 text-2xl font-semibold">Version mobile</h2>
        <p className="mt-2 max-w-3xl text-stone-600 dark:text-stone-400">
          La même logique se transpose en React Native avec Expo : chess.js est
          du JavaScript pur et ne change pas d&apos;une ligne, Stockfish tourne
          dans une vue isolée, et le déplacement des pièces passe par Reanimated
          sur le fil natif, ce qui tient les 60 images par seconde pendant le
          glisser. Le résultat se publie sur les deux magasins depuis un seul
          code, avec des mises à jour livrées sans repasser par une revue.
        </p>

        <p className="mt-8 text-sm text-stone-600 dark:text-stone-400">
          Michael Sibony, développeur indépendant à Paris.{" "}
          <a
            className="font-semibold underline underline-offset-4"
            href="https://apps.apple.com/fr/app/mon-lien-immobilier/id6770486787"
          >
            Une application publiée sur l&apos;App Store
          </a>
          ,{" "}
          <a
            className="font-semibold underline underline-offset-4"
            href="https://github.com/michael-sibony"
          >
            du code public sur GitHub
          </a>
          .
        </p>
      </section>
    </main>
  );
}
